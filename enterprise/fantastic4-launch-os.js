'use strict';
const crypto=require('crypto');
const VERSION='1.0.0';
const STATUS=['PLANNED','RUNNING','READY','FAILED','APPROVED','ACTIVE','BLOCKED'];
const BLUEPRINTS={
 local_service:{name:'Local Service',pages:['Home','Services','About','Contact'],features:['Lead form','Click-to-call','Google Maps','Reviews CTA']},
 professional:{name:'Professional Landing Page',pages:['Home','Services','About','Contact'],features:['Lead form','Booking CTA','Trust section','FAQ']},
 ecommerce:{name:'E-Commerce',pages:['Home','Shop','About','Contact'],features:['Product catalog','Cart','Checkout CTA','Shipping/tax checklist']}
};
function rid(prefix='f4'){return `${prefix}_${crypto.randomBytes(8).toString('hex')}`}
function now(){return new Date().toISOString()}
function secretToken(secret, payload){return crypto.createHmac('sha256',String(secret||'')).update(JSON.stringify(payload)).digest('hex')}
function safeStatus(x){return STATUS.includes(String(x||''))?String(x):'PLANNED'}
function ensure(store){
  store.demoRuns=Array.isArray(store.demoRuns)?store.demoRuns:[];
  store.handoffs=Array.isArray(store.handoffs)?store.handoffs:[];
  store.qa=Array.isArray(store.qa)?store.qa:[];
  store.alerts=Array.isArray(store.alerts)?store.alerts:[];
  store.assets=Array.isArray(store.assets)?store.assets:[];
  store.approvals=Array.isArray(store.approvals)?store.approvals:[];
  store.cacheProfiles=Array.isArray(store.cacheProfiles)?store.cacheProfiles:[];
  store.blueprints=Array.isArray(store.blueprints)?store.blueprints:[];
  store.dryRuns=Array.isArray(store.dryRuns)?store.dryRuns:[];
  return store;
}
function demoRun(store,input={}){
  ensure(store); const id=rid('demo'); const blueprint=BLUEPRINTS[input.blueprint]||BLUEPRINTS.local_service;
  const t=now(); const run={id,status:'READY',mode:'DEMO_ONLY',businessName:String(input.businessName||'Demo Business').slice(0,160),blueprint:input.blueprint||'local_service',blueprintName:blueprint.name,stagingUrl:`https://demo-${id}.sbcwebsites.com`,createdAt:t,completedAt:t,steps:[
    {name:'Create tenant manifest',status:'PASS'},{name:'Apply brand placeholders',status:'PASS'},{name:'Apply blueprint',status:'PASS'},{name:'Prepare WordPress handoff',status:'WAITING_EXTERNAL_PROVIDER'},{name:'QA preflight',status:'PASS'}
  ],note:'Demo artifact generated locally. Live WordPress provisioning requires an authenticated hosting/WordPress provider adapter.'}; store.demoRuns.unshift(run); store.demoRuns.splice(1000); return run;
}
function createHandoff(store,input={}){ensure(store); const payload={id:rid('handoff'),orderId:String(input.orderId||''),customerId:String(input.customerId||''),siteId:String(input.siteId||''),createdAt:now(),expiresAt:new Date(Date.now()+15*60000).toISOString()}; const token=secretToken(input.secret||'',payload); const row={...payload,token,usedAt:null,status:'READY',mode:'EPHEMERAL'}; store.handoffs.unshift(row); return {...row,token};}
function qaTemplate(store,input={}){ensure(store); const id=rid('qa'); const items=[['layout','Desktop/mobile layout matches approved scope'],['forms','Forms submit and confirmation path works'],['links','Primary links/buttons work'],['assets','Logo/colors/copy/assets are correct'],['ssl','HTTPS/SSL verified'],['seo','Title/meta/basic SEO reviewed'],['accessibility','Basic keyboard/contrast/alt-text review'],['performance','Core assets optimized/cached'],['approval','Customer approval captured']].map(([key,label])=>({key,label,status:'OPEN',notes:''})); const row={id,orderId:String(input.orderId||''),customerId:String(input.customerId||''),items,createdAt:now(),updatedAt:now(),status:'OPEN'};store.qa.unshift(row);return row;}
function alert(store,input={}){ensure(store);const row={id:rid('alert'),severity:['LOW','MEDIUM','HIGH','CRITICAL'].includes(input.severity)?input.severity:'MEDIUM',type:String(input.type||'delivery'),message:String(input.message||'Delivery event requires review').slice(0,500),orderId:String(input.orderId||''),status:'OPEN',createdAt:now()};store.alerts.unshift(row);return row;}
function assetSync(store,input={}){ensure(store);const row={id:rid('asset'),orderId:String(input.orderId||''),customerId:String(input.customerId||''),businessName:String(input.businessName||''),logoUrl:String(input.logoUrl||''),brandColors:Array.isArray(input.brandColors)?input.brandColors.slice(0,8):[],copyBrief:String(input.copyBrief||'').slice(0,5000),status:'READY_FOR_FULFILLMENT',createdAt:now()};store.assets.unshift(row);return row;}
function approval(store,input={}){ensure(store);const row={id:rid('approval'),orderId:String(input.orderId||''),customerId:String(input.customerId||''),status:input.approved?'APPROVED':'REQUESTED',approvedBy:String(input.approvedBy||''),notes:String(input.notes||'').slice(0,2000),createdAt:now()};store.approvals.unshift(row);return row;}
function cacheProfile(store,input={}){ensure(store);const row={id:rid('cache'),name:String(input.name||'WordPress Launch Default'),preset:'SAFE_EDGE',headers:['Cache-Control: public, max-age=3600','X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin'],assets:['css','js','images','fonts'],note:'Safe application-level caching preset. CDN/reverse-proxy activation remains provider-gated.'};store.cacheProfiles.unshift(row);return row;}
function blueprint(store,input={}){ensure(store);const key=String(input.key||'').toLowerCase().replace(/[^a-z0-9_-]/g,'_').slice(0,50);if(!key)throw new Error('BLUEPRINT_KEY_REQUIRED');const base=BLUEPRINTS[key]||{name:String(input.name||key),pages:Array.isArray(input.pages)?input.pages:[],features:Array.isArray(input.features)?input.features:[]};const row={id:rid('bp'),key,name:base.name,pages:base.pages,features:base.features,createdAt:now()};store.blueprints.unshift(row);return row;}
function dryRun(store,input={}){ensure(store);const id=rid('dry');const checks=[
 ['purchase','Mock package purchase created'],['payment','Payment verification simulated'],['command_center','Customer/order record created'],['fulfillment','Fulfillment jobs generated'],['office_box','Signed Office Box handoff simulated'],['activation','Single-use activation token simulated'],['wordpress','WordPress blueprint/handoff prepared'],['qa','QA checklist created'],['approval','Customer approval gate simulated'],['handoff','Production handoff completed']
];const failed=[];const steps=checks.map(([key,label])=>({key,label,status:'PASS'}));const row={id,mode:'FULL_DRY_RUN',status:'PASS',startedAt:now(),completedAt:now(),steps,failed,orderId:String(input.orderId||'DRY-'+Date.now()),note:'Simulation only; no external payment, domain, hosting, WordPress or vendor action is performed.'};store.dryRuns.unshift(row);return row;}
function summary(store,env={}){ensure(store);const openAlerts=store.alerts.filter(x=>x.status==='OPEN').length;return {version:VERSION,providerGates:{wordpress:Boolean(env.WORDPRESS_PROVISIONER_URL),hosting:Boolean(env.WP_HOSTING_API_URL),vault:Boolean(env.SBC_EPHEMERAL_QUERY_SECRET||env.SBC_SESSION_SECRET),edgeCache:Boolean(env.SBC_EDGE_CACHE_PROVIDER_URL)},counts:{demoRuns:store.demoRuns.length,qa:store.qa.length,alerts:openAlerts,assets:store.assets.length,approvals:store.approvals.length,dryRuns:store.dryRuns.length},blueprints:Object.entries(BLUEPRINTS).map(([key,v])=>({key,...v}))};}
module.exports={VERSION,BLUEPRINTS,ensure,demoRun,createHandoff,qaTemplate,alert,assetSync,approval,cacheProfile,blueprint,dryRun,summary};
