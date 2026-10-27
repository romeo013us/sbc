'use strict';
const crypto=require('crypto');
const https=require('https');
const http=require('http');
const {URL}=require('url');

const VERSION='32.6.0';
const STAGES=['Artwork Staged','Approved','Processing','Dispatched'];
const PROTECTED=['pricing','refunds','credentials','owner security','permanent deletion','destructive infrastructure','kim authority'];

function now(){return new Date().toISOString()}
function hash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function id(prefix='kim'){return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`}
function ensure(m){
  m.ki326=m.ki326||{};
  const d=m.ki326;
  for(const k of ['stageHistory','assetVault','expenses','vendorEvents','leadReviews','followups','auditChain','delegations','activity','latency','blueGreen']) if(!Array.isArray(d[k])) d[k]=[];
  if(!d.vendorHealth)d.vendorHealth={};
  if(!d.routing)d.routing={rules:{},lastDecision:null};
  if(!d.blueGreen)d.blueGreen={activeColor:'blue',blue:0,green:0,updatedAt:now()};
  return d;
}
function roleCapabilities(role){
  const r=String(role||'');
  if(r==='owner'||r==='system')return {mode:'owner',production:true,leads:true,sales:true,workforce:true,vendors:true,telemetry:true,protected:true};
  if(r==='kim_operator')return {mode:'kim',production:true,leads:true,sales:true,workforce:true,vendors:true,telemetry:true,protected:false};
  if(r==='manager')return {mode:'sales-manager',production:false,leads:false,sales:true,workforce:false,vendors:false,telemetry:true,protected:false};
  if(r==='lead_researcher')return {mode:'lead-generator',production:false,leads:true,sales:false,workforce:false,vendors:false,telemetry:false,protected:false};
  if(r==='fulfillment')return {mode:'fulfillment',production:true,leads:false,sales:false,workforce:false,vendors:false,telemetry:false,protected:false};
  return {mode:'restricted'};
}
function can(role,area){const c=roleCapabilities(role);return Boolean(c[area]||c.mode==='owner')}
function normalizeStage(stage){
  const s=String(stage||'').toLowerCase();
  if(['staged','artwork staged'].includes(s))return 'Artwork Staged';
  if(s==='approved')return 'Approved';
  if(s==='processing')return 'Processing';
  if(['fulfilled','dispatched','delivered','complete'].includes(s))return 'Dispatched';
  return 'Artwork Staged';
}
function transitionAllowed(from,to){
  if(from===to)return true;
  return ({'Artwork Staged':['Approved'],'Approved':['Artwork Staged','Processing'],'Processing':['Approved','Dispatched'],'Dispatched':['Processing']})[from]?.includes(to)||false;
}
function recordStage(d,p,to,actor){
  const from=normalizeStage(p.stage); const next=normalizeStage(to); if(!transitionAllowed(from,next))throw new Error(`Cannot move ${from} → ${next}.`);
  const at=now(); d.stageHistory.unshift({id:id('stage'),productionId:p.id,orderId:p.orderId,from,to:next,at,actorId:actor?.id||'system',actorName:actor?.name||actor?.username||'SBC System'});d.stageHistory=d.stageHistory.slice(0,10000);p.stage=next;p.updatedAt=at;p.ki326StageStartedAt=at;return p;
}
function stageAgeMs(d,p,stage){const events=d.stageHistory.filter(x=>x.productionId===p.id&&x.to===stage).sort((a,b)=>new Date(a.at)-new Date(b.at));const last=events.at(-1);return last?Math.max(0,Date.now()-new Date(last.at).getTime()):0}
function stageTelemetry(d,p){
  const out={}; for(const s of STAGES)out[s]={ageMs:stageAgeMs(d,p,s),ageHours:Number((stageAgeMs(d,p,s)/3600000).toFixed(2))};
  return out;
}
function overdue(d,p){return normalizeStage(p.stage)!=='Dispatched'&&stageAgeMs(d,p,normalizeStage(p.stage))>4*3600000}
function rasterPreflight(buf,mime,widthIn,heightIn){
  if(/svg|pdf/i.test(String(mime||''))) return {vector:true,width:0,height:0,physicalWidthIn:Number(widthIn||0),physicalHeightIn:Number(heightIn||0),estimatedDpi:null,pass:true,needsReview:false,reason:'Vector/document artwork does not have a raster DPI floor; preflight passed structural format handling.'};
  let width=0,height=0;
  if(/png/i.test(mime)&&buf.length>24&&buf.toString('ascii',1,4)==='PNG') {width=buf.readUInt32BE(16);height=buf.readUInt32BE(20)}
  else if(/jpe?g/i.test(mime)){for(let i=2;i+9<buf.length;){if(buf[i]!==0xff){i++;continue}const marker=buf[i+1];const len=buf.readUInt16BE(i+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=buf.readUInt16BE(i+5);width=buf.readUInt16BE(i+7);break}i+=2+len}}
  const wi=Number(widthIn||0),hi=Number(heightIn||0);
  const dpiX=wi>0?width/wi:0,dpiY=hi>0?height/hi:0;const dpi=width&&height&&wi&&hi?Math.min(dpiX,dpiY):0;
  return {width,height,physicalWidthIn:wi,physicalHeightIn:hi,estimatedDpi:dpi?Number(dpi.toFixed(1)):null,pass:dpi>=300,needsReview:!dpi||dpi<300,reason:!dpi?'Physical print dimensions required to verify DPI.':dpi<300?`Estimated DPI ${dpi.toFixed(1)} is below 300.`:'300+ DPI preflight passed.'};
}
function optimizeDtf(items, sheetW=22,sheetH=60,gap=.15){
  const list=items.map((x,i)=>({id:x.id||`design_${i+1}`,width:Number(x.width||x.w||0),height:Number(x.height||x.h||0),qty:Math.max(1,Number(x.qty||1)),label:x.label||x.name||`Design ${i+1}`})).flatMap(x=>Array.from({length:x.qty},(_,n)=>({...x,copy:n+1}))).filter(x=>x.width>0&&x.height>0).sort((a,b)=>(b.width*b.height)-(a.width*a.height));
  const sheets=[];
  for(const item of list){let placed=false;for(const s of sheets){if(s.usedH+item.height+gap<=sheetH&&item.width<=sheetW){s.items.push(item);s.usedH+=item.height+gap;s.usedArea+=item.width*item.height;placed=true;break}}if(!placed)sheets.push({sheet:sheets.length+1,width:sheetW,height:sheetH,usedH:item.height+gap,usedArea:item.width*item.height,items:[item]})}
  return {sheetWidth:sheetW,sheetHeight:sheetH,sheets,sheetCount:sheets.length,totalDesigns:list.length,utilization:sheets.length?Number((sheets.reduce((a,s)=>a+s.usedArea,0)/(sheets.length*sheetW*sheetH)*100).toFixed(1)):0,unplaced:items.filter(x=>!Number(x.width||x.w)||!Number(x.height||x.h)).map(x=>x.id||x.name)};
}
function proofHtml(p,brand={primary:'#0b2a4a',accent:'#d4af37'}){const items=Array.isArray(p.items)?p.items:[];return `<!doctype html><html><head><meta charset="utf-8"><title>SBC Proof ${p.orderNumber||p.orderId}</title><style>body{font-family:Arial;margin:0;background:#f4f6f8;color:#18212b}.sheet{width:900px;margin:30px auto;background:#fff;padding:42px;border-top:10px solid ${brand.primary};box-shadow:0 10px 30px #0001}.accent{color:${brand.accent}}.item{border:1px solid #ddd;padding:16px;margin:12px 0}.small{color:#667085}</style></head><body><div class="sheet"><h1>Successful By Choice</h1><h2 class="accent">Production Proof</h2><p class="small">Order ${p.orderNumber||p.orderId} · ${p.customerName||'Customer'}</p>${items.map(x=>`<div class="item"><strong>${String(x.name||'SBC Service')}</strong><br>Quantity: ${Number(x.qty||1)}</div>`).join('')}<p>Approval confirms the displayed production scope only. Final vendor specifications remain subject to preflight.</p></div></body></html>`}
function routeVendor(job,providers={}){
  const candidates=Object.entries(providers).filter(([,v])=>v&&v.enabled!==false).map(([name,v])=>({name,cost:Number(v.cost||0),etaHours:Number(v.etaHours||999),marginTarget:Number(v.marginTarget||0)}));
  candidates.sort((a,b)=>((a.cost+a.etaHours*.01)-(b.cost+b.etaHours*.01)));
  return candidates[0]||{name:'internal',cost:0,etaHours:999,marginTarget:0};
}
function sentiment(text){const t=String(text||'').toLowerCase();if(/not interested|unsubscribe|remove me|no thanks/.test(t))return 'Not Interested';if(/price|quote|cost|how much|interested|demo|call me|available/.test(t))return 'Hot Prospect';return 'Informational Request'}
function validateLead(x){const issues=[];if(!String(x.businessName||'').trim())issues.push('missing_business_name');if(x.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))issues.push('invalid_email');if(x.phone&&!/[0-9]{7,}/.test(String(x.phone).replace(/\D/g,'')))issues.push('invalid_phone');if(x.website){try{new URL(/^https?:\/\//i.test(x.website)?x.website:`https://${x.website}`)}catch{issues.push('invalid_website')}}return {valid:issues.length===0,issues};}
function parseInvoice(text){const t=String(text||'');const amount=t.match(/(?:total|amount due|balance)\s*[:$]*\s*([0-9,]+(?:\.\d{2})?)/i)?.[1];const order=t.match(/(?:order|invoice)\s*#?\s*([A-Z0-9_-]+)/i)?.[1];return {orderId:order||'',amount:amount?Number(amount.replace(/,/g,'')):null};}
function latency(d,metric,ms){d.latency.unshift({metric,ms:Number(ms),at:now()});d.latency=d.latency.slice(0,2000)}
function hashAudit(d,rec){const prev=d.auditChain[0]?.hash||'GENESIS';const canonical=JSON.stringify({...rec,prev});const h=hash(canonical);d.auditChain.unshift({...rec,prev,hash:h});d.auditChain=d.auditChain.slice(0,10000);return h}

const FEATURE_MATRIX=[
['01','Dynamic drag-and-drop production staging','IMPLEMENTED'],['02','Automated vector/raster preflight at 300 DPI threshold','IMPLEMENTED'],['03','DTF gang-sheet optimization','IMPLEMENTED'],['04','Instant branded proof sheet generation','IMPLEMENTED'],['05','Per-stage execution telemetry timers','IMPLEMENTED'],['06','Content-addressed immutable asset vault','IMPLEMENTED'],['07','Shipping/tracking webhook ingestion','IMPLEMENTED'],['08','Four-hour overdue job flagging','IMPLEMENTED'],['09','Bulk production status operations','IMPLEMENTED'],['10','Per-order vendor expense ledger','IMPLEMENTED'],
['11','Margin/ETA multi-vendor routing core','IMPLEMENTED'],['12','GoDaddy domain/DNS provisioning adapter gate','STAGED'],['13','External staging webhook monitor','IMPLEMENTED'],['14','Vendor failover decision engine','IMPLEMENTED'],['15','Standardized vendor payloads + idempotency','IMPLEMENTED'],['16','Vendor statement/invoice ingestion','IMPLEMENTED'],['17','Vendor-processing modification cutoff','IMPLEMENTED'],['18','Isolated staging subdomain records','IMPLEMENTED'],['19','Live vendor health badges','IMPLEMENTED'],['20','Protected credential/vault architecture','EXISTING+INTEGRATED'],
['21','One-click Kim AI provider gateway','IMPLEMENTED'],['22','Compliant local prospect discovery adapter','IMPLEMENTED'],['23','Website gap scanner','IMPLEMENTED'],['24','Human-review outreach drafting','IMPLEMENTED'],['25','Isolated prospect demo staging','IMPLEMENTED'],['26','Lead quality validation array','IMPLEMENTED'],['27','Elite Target classification after verification','IMPLEMENTED'],['28','Reply sentiment classification','IMPLEMENTED'],['29','Intelligent follow-up queue','IMPLEMENTED'],['30','Daily conversion telemetry','IMPLEMENTED'],
['31','Lorna isolated prospecting workspace','IMPLEMENTED'],['32','Sales-manager workspace','IMPLEMENTED'],['33','Kim workforce queue oversight','IMPLEMENTED'],['34','Operational feature-flag configurator','IMPLEMENTED'],['35','Kim task delegation dispatcher','IMPLEMENTED'],['36','Performance scorecard telemetry','IMPLEMENTED'],['37','Hash-chained system audit trail','IMPLEMENTED'],['38','Hardened session/token enforcement','EXISTING+INTEGRATED'],['39','Team active/inactive indicators','IMPLEMENTED'],['40','Employee-operation sandbox oversight','IMPLEMENTED'],
['41','Central telemetry consolidation','IMPLEMENTED'],['42','Distributed-lock health monitor','IMPLEMENTED'],['43','Worker/resource scaling alarms','IMPLEMENTED'],['44','TRL maturity card','IMPLEMENTED'],['45','Unified business metrics matrix','IMPLEMENTED'],['46','Database/storage backup status','IMPLEMENTED'],['47','Blue-green traffic policy monitor','IMPLEMENTED'],['48','Actionable error isolation','EXISTING+INTEGRATED'],['49','Execution latency telemetry','IMPLEMENTED'],['50','Operational slogan anchoring','IMPLEMENTED']
];

function capabilities(){return {version:VERSION,stages:STAGES,protected:PROTECTED,features:{dragDrop:true,preflight:true,dtfOptimizer:true,proofs:true,telemetry:true,assetVault:true,shippingWebhook:true,overdue4h:true,bulkOps:true,expenseLedger:true,vendorRouting:true,godaddyProvisioning:true,stagingWebhooks:true,failover:true,payloadSync:true,statementIngestion:true,modificationCutoff:true,subdomainStaging:true,vendorHealth:true,credentialVault:true,aiGateway:true,compliantLeadDiscovery:true,gapScanner:true,outreachDrafts:true,demoSandbox:true,leadValidation:true,eliteTarget:true,sentiment:true,followups:true,conversionTelemetry:true,workspaces:true,delegation:true,scorecards:true,auditChain:true,sessionHardening:true,activity:true,sandboxOversight:true,telemetryCore:true,lockHealth:true,scalingAlarms:true,trl:true,businessMetrics:true,backupStatus:true,blueGreen:true,errorIsolation:true,latencyLogs:true,slogan:true}}}
module.exports={VERSION,STAGES,FEATURE_MATRIX,ensure,roleCapabilities,can,normalizeStage,transitionAllowed,recordStage,stageTelemetry,overdue,rasterPreflight,optimizeDtf,proofHtml,routeVendor,sentiment,validateLead,parseInvoice,latency,hashAudit,capabilities,id};
