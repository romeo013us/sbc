'use strict';
// Trusted provider observations only. No publisher, payment mutation or auto-migration.
const channels=['facebook','instagram','linkedin','google_business'],fields=['impressions','reactions','comments','shares','clicks'];
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_:/.-]{1,255}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),slug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const epoch=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x?Date.parse(x):NaN;
const clockOK=x=>Number.isSafeInteger(x)&&x>=0&&x<=8640000000000000;
const sqlTime=x=>new Date(x).toISOString().replace('T',' ').replace('Z','');
const count=x=>x===null||(typeof x==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(x)&&BigInt(x)<=18446744073709551615n);
const decimal=x=>typeof x==='string'&&/^[1-9][0-9]{0,64}$/.test(x);
function createAnalyticsWriter({conn,tenantId,accounts,assertWriter,readMetrics,clock=Date.now}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!accounts||!Object.keys(accounts).length||Object.entries(accounts).some(([k,v])=>!channels.includes(k)||!ref(v))||typeof conn?.execute!=='function'||![assertWriter,readMetrics,clock].every(f=>typeof f==='function'))throw Error('INVALID_ANALYTICS_CONFIG');
 const pinned=Object.freeze({...accounts});let busy=false,halted=false;
 async function guard(){if(await assertWriter()!==true)throw Error('ANALYTICS_WRITER_REQUIRED');}
 async function recordObservation(channel,postRef){
  if(halted)throw Error('ANALYTICS_RECONCILIATION_REQUIRED');if(busy||!Object.hasOwn(pinned,channel)||!ref(postRef))throw Error('INVALID_ANALYTICS_REQUEST');busy=true;let writing=false;
  try{
   await guard();const m=await readMetrics({channel,accountRef:pinned[channel],postRef}),n=clock(),measured=epoch(m?.measuredAt);
   if(!m||m.channel!==channel||m.accountRef!==pinned[channel]||m.postRef!==postRef||!clockOK(n)||!Number.isFinite(measured)||measured>n||n-measured>300000||fields.some(k=>!count(m[k]))||fields.every(k=>m[k]===null))throw Error('ANALYTICS_OBSERVATION_INVALID');
   const values=fields.map(k=>m[k]);await guard();writing=true;
   const [r]=await conn.execute('INSERT INTO sbc_core_marketing_analytics (tenant_id,channel,provider_post_ref,measured_at,impressions,reactions,comments,shares,clicks,observed_at) SELECT ?,?,?,?,?,?,?,?,?,? FROM sbc_core_marketing_publication_receipts p WHERE p.tenant_id=? AND p.channel=? AND p.provider_post_ref=? AND p.account_ref=? AND p.published_at<=? AND IS_USED_LOCK(?)=CONNECTION_ID()',[tenantId,channel,postRef,sqlTime(measured),...values,sqlTime(n),tenantId,channel,postRef,pinned[channel],sqlTime(measured),'sbc:runtime:writer:v1']);
   writing=false;if(r.affectedRows!==1)throw Error('ANALYTICS_WRITE_NOT_CONFIRMED');return {status:'ANALYTICS_RECORDED',publicationReady:false};
  }catch(e){if(writing)halted=true;throw e;}finally{busy=false;}
 }
 return Object.freeze({recordObservation});
}
const POSTS=`SELECT CAST(p.tenant_id AS CHAR) AS tenantId,p.channel,p.provider_post_ref AS postRef,p.slug AS campaignSlug,p.sha256 AS assetSha256,CONCAT(LEFT(DATE_FORMAT(m.measured_at,'%Y-%m-%dT%H:%i:%s.%f'),23),'Z') AS measuredAt,
 CAST(m.impressions AS CHAR) AS impressions,CAST(m.reactions AS CHAR) AS reactions,CAST(m.comments AS CHAR) AS comments,CAST(m.shares AS CHAR) AS shares,CAST(m.clicks AS CHAR) AS clicks
 FROM (SELECT * FROM sbc_core_marketing_publication_receipts WHERE tenant_id=? AND published_at>=? AND published_at<=? ORDER BY channel,provider_post_ref LIMIT 501) p
 LEFT JOIN sbc_core_marketing_analytics m ON m.tenant_id=p.tenant_id AND m.channel=p.channel AND m.provider_post_ref=p.provider_post_ref AND m.measured_at=(SELECT MAX(x.measured_at) FROM sbc_core_marketing_analytics x WHERE x.tenant_id=p.tenant_id AND x.channel=p.channel AND x.provider_post_ref=p.provider_post_ref AND x.measured_at<=?) ORDER BY p.channel,p.provider_post_ref LIMIT 501`;
const REVENUE=`SELECT p.channel,t.currency,CAST(COUNT(*) AS CHAR) AS captureCount,CAST(SUM(t.amount_minor) AS CHAR) AS grossMinor
 FROM sbc_core_marketing_publication_receipts p JOIN sbc_core_campaign_registry c ON c.tenant_ref=CONCAT('sbc:',p.tenant_id) AND c.channel=p.channel AND c.campaign_slug=p.slug AND c.asset_sha256=p.sha256 AND c.provider_post_ref=p.provider_post_ref AND c.published_at=p.published_at
 JOIN sbc_core_campaign_ledger_attributions a ON a.tenant_ref=c.tenant_ref AND a.channel=c.channel AND a.campaign_slug=c.campaign_slug AND a.asset_sha256=c.asset_sha256
 JOIN sbc_core_transactions_ledger t ON t.tenant_ref=a.tenant_ref AND t.event_key=a.event_key AND t.provider=a.provider AND t.environment=a.environment AND t.account_id=a.account_id
 WHERE p.tenant_id=? AND p.published_at>=? AND p.published_at<=? AND t.provider='square' AND t.environment='production' AND t.kind='capture' AND t.occurred_at>=p.published_at AND t.occurred_at<=? GROUP BY p.channel,t.currency ORDER BY p.channel,t.currency LIMIT 501`;
async function summarizePerformance(pool,{tenantId,days=30,now=Date.now()}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!Number.isInteger(days)||days<1||days>90||!clockOK(now)||now<days*86400000)throw Error('INVALID_ANALYTICS_REPORT');
 const start=sqlTime(now-days*86400000),end=sqlTime(now),params=[tenantId,start,end,end];
 const [posts]=await pool.execute({sql:POSTS,timeout:3000},params);
 if(!Array.isArray(posts)||posts.length>500)throw Error('ANALYTICS_REPORT_LIMIT');const seen=new Set(),grouped=new Map();
 for(const r of posts){const key=r.channel+':'+r.postRef;if(r.tenantId!==String(tenantId)||!channels.includes(r.channel)||!ref(r.postRef)||!slug(r.campaignSlug)||!hash(r.assetSha256)||seen.has(key)||fields.some(k=>!count(r[k]))||(r.measuredAt===null?fields.some(k=>r[k]!==null):!Number.isFinite(epoch(r.measuredAt))||epoch(r.measuredAt)>now))throw Error('INVALID_ANALYTICS_ROW');seen.add(key);
  if(!grouped.has(r.channel))grouped.set(r.channel,{channel:r.channel,posts:0,metrics:Object.fromEntries(fields.map(k=>[k,{observedPosts:0,total:0n}]))});const g=grouped.get(r.channel);g.posts++;for(const k of fields)if(r[k]!==null){g.metrics[k].observedPosts++;g.metrics[k].total+=BigInt(r[k]);}
 }
 const [captures]=await pool.execute({sql:REVENUE,timeout:3000},params);if(!Array.isArray(captures)||captures.length>500)throw Error('ANALYTICS_REPORT_LIMIT');const revenueKeys=new Set();
 const squareCaptures=captures.map(r=>{const key=r.channel+':'+r.currency;if(!channels.includes(r.channel)||!grouped.has(r.channel)||typeof r.currency!=='string'||!/^[A-Z]{3}$/.test(r.currency)||!decimal(r.captureCount)||!decimal(r.grossMinor)||revenueKeys.has(key))throw Error('INVALID_ANALYTICS_REVENUE');revenueKeys.add(key);return {channel:r.channel,currency:r.currency,captureCount:r.captureCount,grossMinor:r.grossMinor};});
 return {days,asOf:new Date(now).toISOString(),metricBasis:'latest_lifetime_observations_for_publication_cohort',revenueBasis:'gross_attributed_square_captures_for_publication_cohort',netRevenueAvailable:false,causalProof:false,channels:[...grouped.values()].map(g=>({channel:g.channel,posts:g.posts,metrics:Object.fromEntries(fields.map(k=>{const m=g.metrics[k];return [k,{observedPosts:m.observedPosts,total:m.observedPosts?String(m.total):null,complete:m.observedPosts===g.posts}];}))})),squareCaptures};
}
module.exports={createAnalyticsWriter,summarizePerformance};
