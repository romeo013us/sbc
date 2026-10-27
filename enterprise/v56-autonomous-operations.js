'use strict';

const MAX_BATCH = 500;
const STOP_STATUSES = new Set(['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified','DNC']);
const OPEN_QUOTE_STATUSES = new Set(['Won','Paid','Lost','Cancelled']);

function clean(v, max=500){ return String(v ?? '').trim().slice(0,max); }
function digits(v){ return clean(v,80).replace(/\D/g,''); }
function normalizePhone(v){
  const d=digits(v);
  if(!d) return '';
  if(d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if(d.length===11 && d.startsWith('1')) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return clean(v,80);
}
function normalizeEmail(v){ return clean(v,255).toLowerCase(); }
function normalizeBusiness(v){ return clean(v,255).replace(/\s+/g,' '); }
function canonicalKey(r){
  const b=normalizeBusiness(r.businessName||r.business_name||r.company||r.name).toLowerCase().replace(/[^a-z0-9]/g,'');
  const p=digits(r.phone);
  const e=normalizeEmail(r.email);
  return e ? `e:${e}` : p ? `p:${p}` : b ? `b:${b}` : '';
}
function opportunityScore(r){
  let score=0;
  if(r.businessName) score+=15;
  if(r.contactName) score+=10;
  if(r.phone) score+=20;
  if(r.email) score+=20;
  if(r.website) score+=5;
  if(!r.website) score+=15;
  if(r.industry) score+=5;
  if(r.address) score+=5;
  if(r.dealValue>0) score+=5;
  return Math.max(0,Math.min(100,score));
}
function temperature(score){ return score>=75?'hot':score>=50?'warm':'cold'; }
function mapRow(r,source,batchId){
  const out={
    businessName:normalizeBusiness(r.businessName||r.business_name||r.business||r.company||r.companyName||r['Business Name']||r['Company Name']||r.name),
    contactName:clean(r.contactName||r.contact_name||r.contact||r.owner||r.ownerName||r['Contact Name']||r['Owner Name'],255),
    phone:normalizePhone(r.phone||r.Phone||r['Phone Number']||r.phone_number||r.number),
    email:normalizeEmail(r.email||r.Email||r['Email Address']),
    website:clean(r.website||r.Website||r['Web Address']||r.url,500),
    address:clean(r.address||r.Address,500),
    industry:clean(r.industry||r.Industry||r.type||r.Type||r['Type / Industry']||r.category,160),
    notes:clean(r.notes||r.Notes||r.comments,4000),
    source:clean(source||r.source||'Lorna Bulk Import',120),
    batchId:clean(batchId,100)
  };
  out.dealValue=Math.max(0,Math.min(999999999,Number(r.dealValue||r.deal_value||0)||0));
  out.opportunityScore=opportunityScore(out);
  out.leadTemperature=temperature(out.opportunityScore);
  out.websiteStatus=out.website?clean(r.websiteStatus||r.website_status||'Present',80):'No Website';
  return out;
}
function summarizeRows(rows,existing=[]){
  const seen=new Set(); const result=[]; const duplicates=[]; const invalid=[];
  const existingKeys=new Set(existing.map(c=>canonicalKey(c)).filter(Boolean));
  for(const raw of Array.isArray(rows)?rows.slice(0,MAX_BATCH):[]){
    const r=mapRow(raw,raw?.source||'Lorna Bulk Import',raw?.batchId||'');
    if(!r.businessName&&!r.email&&!r.phone){invalid.push({reason:'missing identity/contact',row:raw});continue;}
    const key=canonicalKey(r);
    if(key&&(seen.has(key)||existingKeys.has(key))){duplicates.push(r);continue;}
    if(key)seen.add(key);
    result.push(r);
  }
  const counts={received:Array.isArray(rows)?Math.min(rows.length,MAX_BATCH):0,valid:result.length,duplicates:duplicates.length,invalid:invalid.length,hot:result.filter(x=>x.leadTemperature==='hot').length,warm:result.filter(x=>x.leadTemperature==='warm').length,cold:result.filter(x=>x.leadTemperature==='cold').length};
  return {rows:result,duplicates,invalid,counts};
}
function capacitySnapshot(db){
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const capacity=Math.max(1,Number(process.env.SBC_SALES_DAILY_CAPACITY||30));
  const active=customers.filter(c=>!STOP_STATUSES.has(String(c.status||'')));
  const hot=active.filter(c=>String(c.leadTemperature||'').toLowerCase()==='hot');
  const warm=active.filter(c=>String(c.leadTemperature||'').toLowerCase()==='warm');
  const ready=active.filter(c=>['Sales Ready','Qualified','Contacted'].includes(String(c.status||''))||['hot','warm'].includes(String(c.leadTemperature||'').toLowerCase()));
  const days=Math.ceil(ready.length/capacity);
  return {dailyCapacity:capacity,active:active.length,hot:hot.length,warm:warm.length,ready:ready.length,estimatedDays:days,overloaded:ready.length>capacity*3,underloaded:ready.length<Math.max(5,Math.floor(capacity*.5))};
}
function moneyRadar(db){
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const quotes=Array.isArray(db?.quotes)?db.quotes:[];
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const now=Date.now();
  const unworked=customers.filter(c=>['hot','warm'].includes(String(c.leadTemperature||'').toLowerCase())&&!STOP_STATUSES.has(String(c.status||''))&&!(c.lastContactedAt||c.contactedAt));
  const staleQuotes=quotes.filter(q=>!OPEN_QUOTE_STATUSES.has(String(q.status||''))===false).filter(q=>false);
  const openQuotes=quotes.filter(q=>!OPEN_QUOTE_STATUSES.has(String(q.status||'')));
  const paidWaiting=orders.filter(o=>['Paid','PAID'].includes(String(o.paymentStatus||o.status))&&!['Completed','Delivered','Cancelled'].includes(String(o.fulfillmentStatus||'')));
  const staleHot=unworked.filter(c=>{
    const ts=Date.parse(c.updatedAt||c.createdAt||''); return Number.isFinite(ts) ? now-ts>4*60*60*1000 : true;
  });
  const opportunities=[];
  if(staleHot.length) opportunities.push({type:'stale_hot_leads',priority:'HIGH',count:staleHot.length,estimatedValue:staleHot.reduce((n,c)=>n+Number(c.dealValue||0),0),action:'Work verified hot opportunities before adding more lead volume.'});
  if(openQuotes.length) opportunities.push({type:'open_quotes',priority:'HIGH',count:openQuotes.length,estimatedValue:openQuotes.reduce((n,q)=>n+Number(q.total||q.amount||0),0),action:'Follow up on open quotes.'});
  if(paidWaiting.length) opportunities.push({type:'paid_fulfillment',priority:'HIGH',count:paidWaiting.length,action:'Move paid orders through fulfillment.'});
  return {generatedAt:new Date().toISOString(),opportunities,unworkedHot:unworked.length,staleHot:staleHot.length,openQuotes:openQuotes.length,paidWaiting:paidWaiting.length};
}
function scan(db){
  const capacity=capacitySnapshot(db); const money=moneyRadar(db);
  const friction=[];
  if(capacity.overloaded) friction.push({type:'capacity',priority:'HIGH',message:`Sales capacity is overloaded: ${capacity.ready} ready opportunities vs ${capacity.dailyCapacity}/day capacity.`,action:'Pause or reduce new lead sourcing and work the existing queue.'});
  if(capacity.underloaded) friction.push({type:'capacity',priority:'MEDIUM',message:`Sales pipeline is underloaded: only ${capacity.ready} ready opportunities remain.`,action:'Increase Lorna sourcing or activate a targeted campaign.'});
  for(const o of money.opportunities) friction.push({...o});
  return {version:'56.1.0',generatedAt:new Date().toISOString(),capacity,money,friction,health:friction.some(x=>x.priority==='HIGH')?'ACTION_REQUIRED':'ON_TRACK'};
}

async function ingest({rows,db,ctx}){
  const batchId=clean(ctx?.batchId||`LORNA-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-001`,100);
  const source=clean(ctx?.source||'Lorna Bulk Import',120);
  const prepared=(Array.isArray(rows)?rows:[]).map(r=>({...r,source,batchId}));
  const summary=summarizeRows(prepared,db.customers||[]);
  let added=0;
  for(const r of summary.rows){
    const c={id:ctx.id(),businessName:r.businessName,contactName:r.contactName,phone:r.phone,email:r.email,status:'Lead',source:`${source} · ${batchId}`,followUp:'',notes:[r.notes,`SBC batch ${batchId}`,`Opportunity score ${r.opportunityScore}/100`].filter(Boolean).join(' · '),createdAt:ctx.now(),updatedAt:ctx.now(),website:r.website,websiteStatus:r.websiteStatus,address:r.address,industry:r.industry,dealValue:r.dealValue,leadTemperature:r.leadTemperature,leadSourceBatchId:batchId,opportunityScore:r.opportunityScore,leadIntelligence:{...(ctx.leadDefaults||{}),sourceBatchId:batchId,opportunityScore:r.opportunityScore}};
    if(typeof ctx.normalizeLeadIntelligence==='function')ctx.normalizeLeadIntelligence(c);
    if(typeof ctx.assignLeadAutomatically==='function')ctx.assignLeadAutomatically(c);
    db.customers.unshift(c); added++;
  }
  const result={ok:true,version:'56.1.0',batchId,source,added,skipped:summary.duplicates.length+summary.invalid.length,duplicates:summary.duplicates.length,invalid:summary.invalid.length,counts:{...summary.counts,added},quality:{hot:summary.counts.hot,warm:summary.counts.warm,cold:summary.counts.cold}};
  if(added&&typeof ctx.addActivity==='function')ctx.addActivity('v56_lorna_batch',`Lorna batch ${batchId} processed`,result);
  if(typeof ctx.saveData==='function')await ctx.saveData();
  return result;
}

module.exports={MAX_BATCH,mapRow,summarizeRows,capacitySnapshot,moneyRadar,scan,ingest};
