'use strict';
// Read-only projection of trusted operator evidence. No scheduling or publication authority.
const FORMATS=Object.freeze(['square','landscape','portrait']);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v);
const version=v=>Number.isSafeInteger(v)&&v>=1;
function projectInventory({campaigns,assets,usedSourceIds,logoSha256,now=Date.now()}={}){
 if(!Array.isArray(campaigns)||campaigns.length>63||campaigns.some(c=>!slug(c?.slug))||!Array.isArray(assets)||assets.length>189||!Array.isArray(usedSourceIds)||usedSourceIds.length>100000||!usedSourceIds.every(hash)||!hash(logoSha256)||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_INVENTORY_INPUT');
 const planned=new Set(campaigns.map(c=>c.slug)),used=new Set(usedSourceIds),byKey=new Map(),digests=new Set(),sourceOwners=new Map();
 if(planned.size!==campaigns.length)throw Error('INVENTORY_CONFLICT');
 for(const a of assets){
  if(!a||!planned.has(a.slug)||!FORMATS.includes(a.format)||![a.sha256,a.sourceAssetId,a.logoSha256].every(hash)||!version(a.reviewVersion)||!version(a.currentReviewVersion)||!['approved','rejected','unreviewed'].includes(a.reviewState))throw Error('INVALID_INVENTORY_ASSET');
  const key=a.slug+':'+a.format;if(byKey.has(key)||digests.has(a.sha256)||(sourceOwners.has(a.sourceAssetId)&&sourceOwners.get(a.sourceAssetId)!==a.slug))throw Error('INVENTORY_CONFLICT');byKey.set(key,a);digests.add(a.sha256);sourceOwners.set(a.sourceAssetId,a.slug);
 }
 const states={missing:0,previously_used:0,logo_mismatch:0,review_required:0,final_review_required:0,readback_required:0,media_verified:0},rows=[];
 for(const campaign of campaigns)for(const format of FORMATS){
  const a=byKey.get(campaign.slug+':'+format);let state='missing';
  if(a){const at=Date.parse(a.verifiedAt);state=used.has(a.sourceAssetId)?'previously_used':a.logoSha256!==logoSha256?'logo_mismatch':a.reviewState!=='approved'||a.currentReviewVersion!==a.reviewVersion?'review_required':a.finalApprovedSha256!==a.sha256?'final_review_required':!Number.isFinite(at)||new Date(at).toISOString()!==a.verifiedAt||at>now||now-at>3600000?'readback_required':'media_verified';}
  states[state]++;rows.push({slug:campaign.slug,format,state,sha256:a?.sha256||null});
 }
 return {schemaVersion:1,planned:rows.length,states,rows,publicationReady:false,requiresTrustedEvidence:true};
}
// Eastern civil-date scheduling; no publish, reservation, or catch-up authority.
function planReplenishment({bank,assets,usedSourceIds,logoSha256,now=Date.now(),days=3}={}){
 const invalid=()=>{throw Error('INVALID_CAMPAIGN_SCHEDULE');};
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!bank||!Array.isArray(bank.holiday)||!Array.isArray(bank.campaigns)||bank.holiday.length>3||bank.campaigns.length>60||!validDate(bank.firstEvergreenDate)||!Number.isInteger(days)||days<1||days>7||!Number.isSafeInteger(now)||now<0)invalid();
 const addDay=(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const today=parts.year+'-'+parts.month+'-'+parts.day,localNow=today+'T'+parts.hour+':'+parts.minute,end=addDay(today,days);
 const slots=[...bank.holiday.map(c=>({slug:c?.slug,date:c?.date,slot:c?.slot})),...bank.campaigns.map(c=>{if(!Number.isInteger(c?.day)||c.day<1||c.day>30)invalid();return {slug:c.slug,date:addDay(bank.firstEvergreenDate,c.day-1),slot:c.slot};})];
 const seen=new Set();for(const c of slots){if(!slug(c.slug)||!validDate(c.date)||!['10:00','22:00'].includes(c.slot)||seen.has(c.date+'T'+c.slot))invalid();seen.add(c.date+'T'+c.slot);}
 const projected=projectInventory({campaigns:slots,assets,usedSourceIds,logoSha256,now});
 const rows=new Map(projected.rows.map(r=>[r.slug+':'+r.format,r]));
 const actions={missing:'produce',previously_used:'replace_used_creative',logo_mismatch:'correct_logo',review_required:'review_source',final_review_required:'review_final_bytes',readback_required:'verify_public_bytes',media_verified:'verify_before_publish'};
 const feedTasks=[],optionalTasks=[];
 for(const c of slots.sort((a,b)=>(a.date+'T'+a.slot).localeCompare(b.date+'T'+b.slot))){const dueLocal=c.date+'T'+c.slot;if(dueLocal<localNow||c.date>=end)continue;
  for(const format of FORMATS){const r=rows.get(c.slug+':'+format);(format==='portrait'?optionalTasks:feedTasks).push({...r,dueLocal,action:actions[r.state]});}
 }
 return {schemaVersion:1,timezone:'America/New_York',throughExclusive:end,feedTasks,optionalTasks,publicationReady:false};
}
module.exports={projectInventory,planReplenishment};
