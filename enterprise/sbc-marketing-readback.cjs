'use strict';

// Only SBC's own four business accounts. Client accounts have separate authorization.
const CHANNELS = {
  facebook: { name:'Facebook', connector:'facebook_organic', account:'1473280249199334',
    fields:'account_id,post_id,post_created_time,permalink_url,media_type,full_picture,is_published' },
  instagram: { name:'Instagram', connector:'instagram', account:'17841459553160540',
    reportingAccount:'29180247671583580', handle:'successful_by_choice_miami',
    fields:'account_id,media_owner_username,media_id,timestamp,media_permalink,media_type,media_product_type,media_url' },
  linkedin: { name:'LinkedIn', connector:'linkedin_organic', account:'146995513',
    fields:'account_id,post_id,share_id,share_owner,share_activity,share_published_time,share_post_type,share_image_url' },
  google: { name:'Google Business Profile', connector:'google_my_business', account:'locations/3970405300470441047',
    fields:'account_id,post_id,post_create_time,post_search_url,post_state,post_media_format,post_media_google_url' }
};
const easternDate = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'});
function businessDate(time) { return easternDate.format(new Date(time)); }

function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const time = Date.parse(day + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === day;
}
function instant(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 1e12 && value < 1e13) return value;
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return NaN;
  return Date.parse(value);
}
function httpsUrl(raw, hosts) {
  if (typeof raw !== 'string' || raw.length > 4096) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    return !hosts || hosts.includes(u.hostname) ? u.href : '';
  } catch { return ''; }
}
function ownsPublishingAccount(platform, id) {
  if (typeof id !== 'string' || !Object.hasOwn(CHANNELS,platform)) return false;
  const config = CHANNELS[platform];
  if (platform === 'google' && /^\d+$/.test(id)) id = 'locations/'+id;
  return id === config.account || id === config.reportingAccount;
}
function normalizedPost(platform, row) {
  const config = CHANNELS[platform];
  let id, link, when, photo;
  if (platform === 'instagram') {
    // The current Instagram login and Windsor media reporting use different numeric IDs.
    if (![config.account,config.reportingAccount].includes(row.account_id) || row.media_owner_username !== config.handle) return;
    id = row.media_id;
    if (typeof id !== 'string' || !/^\d+$/.test(id)) return;
    link = httpsUrl(row.media_permalink,['instagram.com','www.instagram.com']);
    when = row.timestamp;
    photo = row.media_product_type === 'FEED' && row.media_type === 'IMAGE' && httpsUrl(row.media_url);
  } else {
    if (row.account_id !== config.account) return;
    id = row.post_id;
    if (platform === 'facebook') {
      if (typeof id !== 'string' || !id.startsWith(config.account+'_') || !/^\d+_\d+$/.test(id)) return;
      link = httpsUrl(row.permalink_url,['facebook.com','www.facebook.com','m.facebook.com']);
      when = row.post_created_time;
      photo = ['true','1'].includes(String(row.is_published).toLowerCase()) &&
        String(row.media_type).toLowerCase() === 'photo' && httpsUrl(row.full_picture);
    } else if (platform === 'google') {
      if (typeof id !== 'string' || !/^accounts\/\d+\/locations\/\d+\/localPosts\/\d+$/.test(id) || !id.includes('/'+config.account+'/localPosts/')) return;
      link = httpsUrl(row.post_search_url,['local.google.com','www.google.com','search.google.com','maps.google.com']);
      when = row.post_create_time;
      photo = row.post_state === 'LIVE' && row.post_media_format === 'PHOTO' && httpsUrl(row.post_media_google_url);
    } else {
      if (row.share_owner !== 'urn:li:organization:'+config.account) return;
      // The content URL of a share can point to the advertised website.
      id = [row.post_id,row.share_id].find(v => typeof v === 'string' && /^urn:li:(?:share|ugcPost):\d+$/.test(v));
      if (!id) return;
      const activity = typeof row.share_activity === 'string' && /^urn:li:activity:\d+$/.test(row.share_activity) ? row.share_activity : id;
      link = 'https://www.linkedin.com/feed/update/' + activity + '/';
      when = row.share_published_time;
      photo = ['image','multiimage'].includes(String(row.share_post_type).toLowerCase()) && httpsUrl(row.share_image_url);
    }
  }
  return {id,link,time:instant(when),photo:Boolean(photo)};
}
function reconcileChannel(platform, payload, day, now) {
  if (!payload || payload.error || (payload.status && payload.status !== 'done') || !Array.isArray(payload.data)) throw Error('PROVIDER_DATA_UNAVAILABLE');
  const posts = new Map();
  let unresolved = 0;
  for (const row of payload.data) {
    if (!row || typeof row !== 'object' || !Object.values(row).some(Boolean)) continue;
    const post = normalizedPost(platform, row);
    if (!post || !Number.isFinite(post.time)) { unresolved++; continue; }
    if (businessDate(post.time) !== day || post.time > now) continue;
    if (!post.link || !post.photo) { unresolved++; continue; }
    posts.set(post.id,{id:post.id,link:post.link,publishedAt:new Date(post.time).toISOString()});
  }
  const receipts = [...posts.values()].sort((a,b) => a.publishedAt.localeCompare(b.publishedAt));
  return {receipts, unresolved, status:receipts.length ? 'READ_BACK' : unresolved ? 'INCONCLUSIVE' : 'NO_READBACK'};
}

function createReadback({getKey,request=fetch,clock=Date.now}) {
  // Coalesce owner refreshes. Each Eastern date uses at most four requests per minute.
  const cache = new Map();
  async function snapshot(day, now) {
    let key;
    try { key = await getKey(); } catch { /* Report unavailable access without exposing credentials. */ }
    const nextUtcDate = new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
    const utcToday = new Date(now).toISOString().slice(0,10);
    const channels = await Promise.all(Object.entries(CHANNELS).map(async ([platform, config]) => {
      const base = {platform, name:config.name, target:2};
      if (!key) return {...base,status:'ACCESS_UNCONFIGURED',receipts:[]};
      try {
        const url = new URL('https://connectors.windsor.ai/'+config.connector);
        url.search = new URLSearchParams({api_key:key,select_accounts:config.account,fields:config.fields,
          date_from:day,date_to:nextUtcDate < utcToday ? nextUtcDate : utcToday}).toString();
        const r = await request(url, {method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
        if (!r.ok) return {...base,status:'PROVIDER_UNAVAILABLE',http:r.status,receipts:[]};
        return {...base,...reconcileChannel(platform,await r.json(),day,now)};
      } catch { return {...base,status:'PROVIDER_UNAVAILABLE',receipts:[]}; }
    }));
    return {day,timezone:'America/New_York',observedAt:new Date(now).toISOString(),channels};
  }
  return function read(day) {
    const now = clock();
    if (!validDay(day) || day > businessDate(now) || Date.parse(day+'T00:00:00Z') < now-32*86400000) throw Error('INVALID_REPORT_DATE');
    for (const [key,item] of cache) if (item.until <= now) cache.delete(key);
    if (!cache.has(day)) cache.set(day,{until:now+60000,value:snapshot(day,now)});
    return cache.get(day).value;
  };
}
module.exports = {CHANNELS,ownsPublishingAccount,businessDate,validDay,normalizedPost,reconcileChannel,createReadback};
