'use strict';

const watchlist = require('./catalogs/sbc-market-watch.json');
const Search = require('./sbc-search-console.cjs');
const ProspectIntelligence = require('./sbc-prospect-intelligence.cjs');
const Revenue = require('./sbc-revenue-reporting-truth-v66142.cjs');
const { proofFields } = require('./v6640-payment-evidence.cjs');
const { requestIdValid } = require('./v6672-site-checkout-integrity.cjs');

const SITE = 'sbcmia.com';
const DAY = 86_400_000;
const ROW_LIMIT = 5000;
const MONEY_REVERSAL = /^(refund(ed)?|charge_?back|charged_back|void(ed)?)$/i;

function windows(days, time) {
  const end = Math.floor(time / DAY) * DAY;
  return { end, current: end - days * DAY, previous: end - 2 * days * DAY };
}

const date = value => new Date(value).toISOString().slice(0, 10);
const dateTime = value => `${date(value)} 00:00:00`;

async function readSite(pool, tenantId, days, time) {
  const range = windows(days, time);
  const args = [tenantId, SITE, dateTime(range.previous), dateTime(range.end), ROW_LIMIT + 1];
  const [leadResult, orderResult] = await Promise.all([
    pool.query({ timeout: 4000, sql: `
      SELECT tenant_id, business_name, contact_name, source,
             DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
      FROM sbc_customers
      WHERE tenant_id = ? AND source = ? AND COALESCE(status, '') <> 'Deleted'
        AND created_at >= ? AND created_at < ? LIMIT ?` }, args),
    pool.query({ timeout: 4000, sql: `
      SELECT o.id, o.tenant_id, o.customer_name, o.status, o.price, o.notes,
             DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
             c.business_name, c.contact_name, c.source AS customer_source
      FROM sbc_orders o
      LEFT JOIN sbc_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      WHERE o.tenant_id = ? AND COALESCE(o.status, '') <> 'Deleted'
        AND (CASE WHEN JSON_VALID(o.notes) THEN JSON_UNQUOTE(JSON_EXTRACT(o.notes, '$.websiteCheckoutSource')) END) = ?
        AND o.created_at >= ? AND o.created_at < ? LIMIT ?` }, args)
  ]);
  const [leads] = leadResult;
  const [orders] = orderResult;
  if (leads.length > ROW_LIMIT || orders.length > ROW_LIMIT) return { status: 'volume_limit' };
  if ([...leads, ...orders].some(row => Number(row.tenant_id) !== tenantId)) throw Error('SITE_REPORT_TENANT_MISMATCH');

  const blank = () => ({ crmInquiries: 0, signedCheckouts: 0, paidCheckouts: 0, capturedCents: 0 });
  const current = blank();
  const previous = blank();
  const bucket = started => {
    if (!Number.isFinite(started) || started < range.previous || started >= range.end) return null;
    return started >= range.current ? current : previous;
  };
  for (const row of leads) {
    const totals = bucket(Date.parse(row.created_at));
    if (totals && row.source === SITE && !Revenue.isQaCustomer({ businessName: row.business_name, contactName: row.contact_name })) {
      totals.crmInquiries++;
    }
  }

  const checkouts = new Map();
  const duplicateRequests = new Set();
  const usedPayments = new Set();
  const duplicatePayments = new Set();
  for (const row of orders) {
    const started = Date.parse(row.created_at);
    const totals = bucket(started);
    const notes = Revenue.parseNotes(row);
    const requestId = notes.websiteCheckoutRequestId;
    if (!totals || notes.websiteCheckoutSource !== SITE || notes.publicCheckout !== true || !requestIdValid(requestId)) continue;
    const order = { id: row.id, customerName: row.customer_name, price: row.price, notes, parsed: notes, paymentStatus: notes.paymentStatus };
    const customer = { businessName: row.business_name, contactName: row.contact_name, source: row.customer_source };
    if (Revenue.isQaOrder(order, customer)) continue;
    const capture = proofFields(order);
    const capturedAt = Date.parse(capture.completedAt);
    const captured = Revenue.providerPaid(order, customer) && !MONEY_REVERSAL.test(String(row.status).trim()) &&
      capturedAt >= started && capturedAt <= time;
    if (captured) {
      if (usedPayments.has(capture.id)) duplicatePayments.add(capture.id);
      usedPayments.add(capture.id);
    }
    if (checkouts.has(requestId)) duplicateRequests.add(requestId);
    checkouts.set(requestId, { totals, paymentId: captured ? capture.id : null, cents: Math.round(Number(row.price) * 100) });
  }
  for (const [requestId, { totals, paymentId, cents }] of checkouts) {
    if (duplicateRequests.has(requestId)) continue;
    totals.signedCheckouts++;
    if (paymentId && !duplicatePayments.has(paymentId)) {
      totals.paidCheckouts++;
      totals.capturedCents += cents;
    }
  }

  return {
    status: 'available', current, previous, currency: 'USD',
    periods: {
      current: { startDate: date(range.current), endDate: date(range.end - DAY) },
      previous: { startDate: date(range.previous), endDate: date(range.current - DAY) }
    },
    conflictingRequestIds: duplicateRequests.size,
    conflictingPaymentIds: duplicatePayments.size
  };
}

function recommendedActions(site, search) {
  const actions = [];
  if (search.status === 'not_configured') actions.push('Verify sbcmia.com in Search Console and connect the read-only service account.');
  if (search.status === 'access_denied') actions.push('Check the service account’s permission on the sbcmia.com Search Console property.');
  if (search.status === 'credential_invalid') actions.push('Replace the Search Console service account JSON in the Provider Credential Vault.');
  if (search.status === 'connected' && search.current && search.previous) {
    const { current, previous } = search;
    if (current.impressions > previous.impressions && current.clicks < previous.clicks) {
      actions.push('Search impressions rose while clicks fell. Review the service pages and queries driving the difference in Search Console.');
    }
  }
  if (site.status === 'available') {
    if (site.conflictingRequestIds || site.conflictingPaymentIds) actions.push('Review duplicate checkout or payment references with the existing reconciliation tools.');
    if (site.current.crmInquiries > 0 && site.current.signedCheckouts === 0) actions.push('Verify how sbcmia.com package buttons reach the signed checkout before using checkout counts to assess conversion.');
  }
  return actions;
}


const BFS_SOURCE='https://www.census.gov/econ/bfs/csv/bfs_monthly.csv';
const BFS_STATES='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const BFS_MONTHS='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const BFS_LIMITATION='Business applications are a geographic research signal, not evidence of actual business formation, website purchase intent, preferred language, consent, or qualified sales leads.';
const BFS_MAX_BYTES=8*1024*1024;
function parseBfs(text,time){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const cells=line=>line.split(',').map(v=>v.trim().replace(/^"([^"]*)"$/,'$1'));
 const head=cells(lines.shift()||'').map(v=>v.toLowerCase());
 const required=['sa','naics_sector','series','geo','year',...BFS_MONTHS];
 if(required.some(k=>head.indexOf(k)<0||head.indexOf(k)!==head.lastIndexOf(k)))throw Error('BFS_SCHEMA');
 const idx=Object.fromEntries(required.map(k=>[k,head.indexOf(k)]));
 const states=new Set(BFS_STATES),values=new Map();
 const d=new Date(time),last=d.getUTCFullYear()*12+d.getUTCMonth()-1;
 if(!Number.isFinite(last))throw Error('BFS_CLOCK');
 for(const line of lines){
  if(!line.trim())continue;
  const row=cells(line);
  if(row[idx.sa]!=='U'||row[idx.naics_sector]!=='TOTAL'||row[idx.series]!=='BA_BA'||!states.has(row[idx.geo]))continue;
  if(row.length!==head.length||!/^\d{4}$/.test(row[idx.year]))throw Error('BFS_ROW');
  const year=Number(row[idx.year]),state=row[idx.geo],key=state+':'+year;
  if(values.has(key))throw Error('BFS_DUPLICATE');
  values.set(key,BFS_MONTHS.map(m=>{
   const raw=row[idx[m]];
   if(!/^\d+$/.test(raw||''))return null;
   const n=Number(raw);return Number.isSafeInteger(n)&&n>=0?n:null;
  }));
 }
 const get=(state,period)=>values.get(state+':'+Math.floor(period/12))?.[period%12]??null;
 const triple=(state,p)=>[get(state,p),get(state,p-1),get(state,p-2)];
 const sum=ns=>ns.reduce((a,b)=>a+b,0);
 let period=null;
 for(let p=last;p>=last-2;p--){
  if(BFS_STATES.every(s=>[...triple(s,p),...triple(s,p-12)].every(n=>n!==null))){period=p;break;}
 }
 if(period===null)throw Error('BFS_INCOMPLETE_OR_STALE');
 const month=p=>String(Math.floor(p/12))+'-'+String(p%12+1).padStart(2,'0');
 const rows=BFS_STATES.map(state=>{
  const applications=sum(triple(state,period)),priorApplications=sum(triple(state,period-12));
  if(!Number.isSafeInteger(applications)||!Number.isSafeInteger(priorApplications))throw Error('BFS_RANGE');
  return {state,applications,priorApplications,yearOverYearPct:priorApplications===0?null:Math.round((applications-priorApplications)/priorApplications*1000)/10};
 }).sort((a,b)=>b.applications-a.applications||a.state.localeCompare(b.state));
 return {status:'available',coverage:rows.length,periodStart:month(period-2),periodEnd:month(period),comparisonStart:month(period-14),comparisonEnd:month(period-12),series:'BA_BA',seasonallyAdjusted:false,source:BFS_SOURCE,limitation:BFS_LIMITATION,rows};
}
async function readBfsResponse(response){
 if(!response?.ok||!response.body?.getReader)throw Error('BFS_HTTP');
 const reader=response.body.getReader(),decoder=new TextDecoder(),chunks=[];
 let bytes=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>BFS_MAX_BYTES)throw Error('BFS_SIZE');
   chunks.push(decoder.decode(value,{stream:true}));
  }
  chunks.push(decoder.decode());return chunks.join('');
 }catch(e){await reader.cancel().catch(()=>{});throw e;}
 finally{reader.releaseLock();}
}
function createNationalReader(fetcher,clock){
 let cache=null,inflight=null;
 return async()=>{
  const now=clock();
  if(cache&&now>=cache.at&&now-cache.at<6*60*60*1000)return cache.data;
  if(inflight)return inflight;
  inflight=(async()=>{
   try{
    const response=await fetcher(BFS_SOURCE,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'text/csv'}});
    const data={...parseBfs(await readBfsResponse(response),now),fetchedAt:new Date(now).toISOString()};
    cache={at:now,data};return data;
   }catch{return {status:'unavailable',source:BFS_SOURCE,limitation:BFS_LIMITATION,rows:[],coverage:0};}
  })();
  try{return await inflight;}finally{inflight=null;}
 };
}


const GEO_METHOD='CRM records use their current researcher-documented street-address state, not independent location verification or historic customer location. Revenue is SBC-recorded Square capture metadata, not independent provider or bank settlement. Records without location evidence stay unknown; no causal conversion or profit claim. Excludes known QA, reversed payments, status-only payments and duplicate capture references. Complete UTC days only.';
function geographicState(row){
 let info;
 try{info=typeof row.lead_intelligence_json==='string'?JSON.parse(row.lead_intelligence_json):row.lead_intelligence_json;}catch{return 'unknown';}
 const b=info?.researchBrief,state=String(b?.streetState||'').trim().toUpperCase();
 if(!BFS_STATES.includes(state)||b?.streetAddressVerification!=='verified'||!String(row.address||'').trim())return 'unknown';
 try{const url=new URL(b.streetAddressEvidenceUrl);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return 'unknown';}catch{return 'unknown';}
 if(b.googleAddressVerification==='conflict'||b.addressMismatch===true||b.serviceAreaOnly===true)return 'unknown';
 return state;
}
async function readGeography(pool,tenantId,days,time){
 const args=[tenantId,ROW_LIMIT+1];
 const [leadResult,orderResult]=await Promise.all([
  pool.query({timeout:4000,sql:"SELECT id,tenant_id,business_name,contact_name,source,status,address,lead_intelligence_json,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at FROM sbc_customers WHERE tenant_id=? LIMIT ?"},args),
  pool.query({timeout:4000,sql:"SELECT id,tenant_id,customer_id,customer_name,status,price,notes,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at FROM sbc_orders WHERE tenant_id=? LIMIT ?"},args)
 ]);
 const [leads]=leadResult,[orders]=orderResult;
 if(!Array.isArray(leads)||!Array.isArray(orders))throw Error('GEO_INVALID_ROWS');
 if(leads.length>ROW_LIMIT||orders.length>ROW_LIMIT)return {status:'volume_limit',rows:[],methodology:GEO_METHOD};
 if([...leads,...orders].some(r=>Number(r.tenant_id)!==tenantId||!r.id)||new Set(leads.map(r=>String(r.id))).size!==leads.length||new Set(orders.map(r=>String(r.id))).size!==orders.length)throw Error('GEO_SCOPE');
 const range=windows(days,time),within=v=>{const n=Date.parse(v);return Number.isFinite(n)&&n>=range.current&&n<range.end;};
 const groups=new Map(),customerIndex=new Map();
 const group=state=>{if(!groups.has(state))groups.set(state,{state,newCrmRecords:0,paidOrders:0,capturedCents:0});return groups.get(state);};
 for(const row of leads){
  const customer={businessName:row.business_name,contactName:row.contact_name,source:row.source};
  const qa=Revenue.isQaCustomer(customer),deleted=/^deleted$/i.test(String(row.status||'').trim());
  const state=deleted?'unknown':geographicState(row);
  customerIndex.set(String(row.id),{customer,qa,state});
  if(!qa&&!deleted&&within(row.created_at))group(state).newCrmRecords++;
 }
 // Detect reused payment IDs across the entire bounded tenant snapshot, including records outside the date window.
 const seen=new Set(),conflicts=new Set(),candidates=[];
 for(const row of orders){
  const c=customerIndex.get(String(row.customer_id||'')),notes=Revenue.parseNotes(row);
  const order={id:row.id,customerName:row.customer_name,price:row.price,notes,parsed:notes,paymentStatus:notes.paymentStatus};
  const proof=proofFields(order);
  if(proof.id){if(seen.has(proof.id))conflicts.add(proof.id);seen.add(proof.id);}
  if(c?.qa||Revenue.isQaOrder(order,c?.customer)||/^deleted$/i.test(String(row.status||'').trim())||MONEY_REVERSAL.test(String(row.status||'').trim())||!Revenue.providerPaid(order,c?.customer))continue;
  const captured=Date.parse(proof.completedAt),started=Date.parse(row.created_at),cents=Math.round(Number(row.price)*100);
  if(!Number.isFinite(started)||captured<started||!within(proof.completedAt)||!Number.isSafeInteger(cents)||cents<=0)continue;
  candidates.push({state:c?.state||'unknown',paymentId:proof.id,cents});
 }
 for(const c of candidates){if(conflicts.has(c.paymentId))continue;const g=group(c.state);g.paidOrders++;g.capturedCents+=c.cents;}
 const rows=Array.from(groups.values()).sort((a,b)=>a.state==='unknown'?1:b.state==='unknown'?-1:b.capturedCents-a.capturedCents||b.newCrmRecords-a.newCrmRecords||a.state.localeCompare(b.state));
 const totals=rows.reduce((a,r)=>({newCrmRecords:a.newCrmRecords+r.newCrmRecords,paidOrders:a.paidOrders+r.paidOrders,capturedCents:a.capturedCents+r.capturedCents}),{newCrmRecords:0,paidOrders:0,capturedCents:0});
 if(!Number.isSafeInteger(totals.capturedCents))throw Error('GEO_RANGE');
 return {status:'available',rows,totals,currency:'USD',period:{startDate:date(range.current),endDate:date(range.end-DAY)},conflictingPaymentIds:conflicts.size,methodology:GEO_METHOD};
}


const RADAR_CHICAGO='https://data.cityofchicago.org/resource/r5kz-chrr.json';
const RADAR_UK='https://www.gov.uk/bank-holidays.json';
const RADAR_REGIONS={'england-and-wales':'England and Wales',scotland:'Scotland','northern-ireland':'Northern Ireland'};
function radarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&date(n)===value;
}
async function radarJson(fetcher,url){
 const response=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
 return JSON.parse(await readBfsResponse(response));
}
function createRadarReader(fetcher,clock){
 let cache=null,inflight=null;
 return async()=>{
  const now=clock();
  if(!Number.isFinite(now))throw Error('RADAR_CLOCK');
  const today=date(now),start=date(now-30*DAY),end=date(now+60*DAY);
  if(cache&&now>=cache.at&&today===cache.day&&now-cache.at<(cache.data.status==='available'?3600000:300000))return cache.data;
  if(inflight)return inflight;
  inflight=(async()=>{
   const chicago={market:'Chicago, Illinois, US',kind:'license_records',source:'https://data.cityofchicago.org/Community-Economic-Development/Business-Licenses/r5kz-chrr',startDate:start,endDateExclusive:today,limitation:'License records may include renewals and changes; not unique businesses, verified website demand, or qualified leads.'};
   const uk={market:'United Kingdom',kind:'calendar_events',source:'https://www.gov.uk/bank-holidays',startDate:today,endDateExclusive:end,limitation:'Regional holiday dates are campaign-planning signals, not measured purchase demand or permission to contact anyone.'};
   const [a,b]=await Promise.all([
    (async()=>{
     try{
      const where="date_issued >= '"+start+"T00:00:00' AND date_issued < '"+today+"T00:00:00'";
      const url=RADAR_CHICAGO+'?$select='+encodeURIComponent('count(*) as count')+'&$where='+encodeURIComponent(where);
      const payload=await radarJson(fetcher,url);
      if(!Array.isArray(payload)||payload.length!==1||typeof payload[0]?.count!=='string'||!/^\d+$/.test(payload[0].count))throw Error('RADAR_COUNT');
      const count=Number(payload[0].count);
      if(!Number.isSafeInteger(count)||count<0)throw Error('RADAR_COUNT');
      return {...chicago,status:'available',count,checkedAt:new Date(now).toISOString()};
     }catch{return {...chicago,status:'unavailable',count:null};}
    })(),
    (async()=>{
     try{
      const payload=await radarJson(fetcher,RADAR_UK);
      const events=[],seen=new Set();
      for(const [id,region] of Object.entries(RADAR_REGIONS)){
       const rows=payload?.[id]?.events;
       if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('RADAR_CALENDAR');
       for(const item of rows){
        if(!radarDate(item?.date)||typeof item?.title!=='string'||!item.title.trim()||item.title.length>200)throw Error('RADAR_EVENT');
        if(item.date<today||item.date>=end)continue;
        const key=JSON.stringify([id,item.date,item.title]);if(seen.has(key))continue;seen.add(key);
        events.push({region,date:item.date,title:item.title});
       }
      }
      events.sort((x,y)=>x.date.localeCompare(y.date)||x.region.localeCompare(y.region)||x.title.localeCompare(y.title));
      return {...uk,status:'available',events,checkedAt:new Date(now).toISOString()};
     }catch{return {...uk,status:'unavailable',events:[]};}
    })()
   ]);
   const sources=[a,b],available=sources.filter(x=>x.status==='available').length;
   const data={status:available===2?'available':available?'partial':'unavailable',generatedAt:new Date(now).toISOString(),sources};
   cache={at:now,day:today,data};return data;
  })();
  try{return await inflight;}finally{inflight=null;}
 };
}

function register(app, { auth, ownerOnly, requireTenant, isSiteTenant, getPool, readSearchCredential, fetcher, nationalFetcher=globalThis.fetch, radarFetcher=globalThis.fetch, clock = Date.now }) {
  const readRadar=createRadarReader(radarFetcher,clock);
  app.get('/api/owner/market-intelligence/radar',auth,ownerOnly,async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{const tenantId=requireTenant(req);if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Error('tenant');}
    catch{return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
    if(Object.keys(req.query||{}).length)return res.status(400).json({ok:false,code:'RADAR_QUERY_INVALID'});
    try{return res.json({ok:true,...await readRadar()});}
    catch{return res.status(503).json({ok:false,code:'RADAR_UNAVAILABLE'});}
  });

  app.get('/api/owner/market-intelligence/geography',auth,ownerOnly,async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    let tenantId;try{tenantId=requireTenant(req);if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Error('tenant');}catch{return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
    const days=req.query.days??'30';
    if(!['30','90'].includes(days)||Object.keys(req.query||{}).some(k=>k!=='days'))return res.status(400).json({ok:false,code:'GEOGRAPHY_WINDOW_INVALID'});
    const time=clock(),pool=getPool();
    const unavailable={status:'unavailable',rows:[],methodology:GEO_METHOD};
    const result=pool?await readGeography(pool,tenantId,Number(days),time).catch(()=>unavailable):unavailable;
    return res.json({ok:true,generatedAt:new Date(time).toISOString(),days:Number(days),...result});
  });

  const readNational=createNationalReader(nationalFetcher,clock);
  app.get('/api/owner/market-intelligence/national',auth,ownerOnly,async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{const tenantId=requireTenant(req);if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Error('tenant');}
    catch{return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
    if(Object.keys(req.query||{}).length)return res.status(400).json({ok:false,code:'NATIONAL_QUERY_INVALID'});
    const data=await readNational();return res.json({ok:true,...data});
  });
  const readSearch = Search.createReader(fetcher);
  // Additive, owner-only, read-only public Lighthouse research endpoint.
  ProspectIntelligence.register(app,{auth,ownerOnly,requireTenant,fetcher,clock});
  app.get('/api/owner/market-intelligence', auth, ownerOnly, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let tenantId;
    try { tenantId = requireTenant(req); }
    catch { return res.status(403).json({ ok: false, code: 'TENANT_CONTEXT_REQUIRED' }); }
    const rawDays = req.query.days ?? '30';
    if (rawDays !== '30' && rawDays !== '90') return res.status(400).json({ ok: false, code: 'MARKET_WINDOW_INVALID' });
    const days = Number(rawDays);
    const time = clock();
    const allowed = isSiteTenant(tenantId);
    const pool = allowed ? getPool() : null;
    const [site, search] = allowed ? await Promise.all([
      pool ? readSite(pool, tenantId, days, time).catch(() => ({ status: 'unavailable' })) : { status: 'unavailable' },
      Promise.resolve().then(() => readSearchCredential(tenantId)).then(value => readSearch({ tenantId, value, days, time }))
        .catch(() => ({ status: 'unavailable', property: Search.PROPERTY }))
    ]) : [{ status: 'out_of_scope' }, { status: 'out_of_scope' }];
    return res.json({
      ok: true, generatedAt: new Date(time).toISOString(), days, site, search,
      market: { ...watchlist, reviewDue: time >= Date.parse(watchlist.observedOn) + 30 * DAY },
      actions: recommendedActions(site, search)
    });
  });
}

module.exports = { register };
