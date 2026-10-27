const crypto = require('crypto');

const FEATURES = {
  telephonyVisualSync:'real-time-telephony-visual-sync',
  whatIfQuotes:'interactive-what-if-quote-engine',
  geofencedProspects:'dynamic-geofenced-prospect-ingestion',
  brandScraper:'automated-brand-identity-discovery',
  subdomainDemos:'multi-tenant-subdomain-demo-routing',
  templateSwap:'single-click-template-swapping',
  payloadSplitter:'asynchronous-multi-vendor-payload-splitting',
  printPreflight:'real-time-print-preflight-diagnostics',
  trackingReconciliation:'automated-tracking-reconciliation',
  autonomousDialing:'autonomous-dialing-engagement-queue',
  performanceMetrics:'gamified-employee-performance-metrics',
  transcriptSummarizer:'conversation-transcript-summarization',
  tenantIsolation:'strict-row-level-tenant-isolation',
  visibilityControls:'granular-employee-visibility-controls',
  idempotency:'idempotent-transaction-prevention-gates',
  fulfillmentAdapters:'unified-fulfillment-adapters',
  schemaIsolation:'abstract-schema-tenant-isolation',
  sandbox:'sandbox-testing-mode',
  realtimeBroadcast:'real-time-dashboard-broadcasting',
  workflows:'declarative-long-running-workflows'
};

function sha256(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function id(prefix='op'){return `${prefix}_${crypto.randomUUID()}`;}
function now(){return new Date().toISOString();}

function readiness(env=process.env){
  return {
    features:FEATURES,
    status:{
      telephonyVisualSync:Boolean(env.SBC_VOICE_CONTEXT_PROVIDER || env.TWILIO_ACCOUNT_SID),
      whatIfQuotes:true,
      geofencedProspects:Boolean(env.SBC_PROSPECT_PROVIDER_URL),
      brandScraper:Boolean(env.SBC_BRAND_PROVIDER_URL),
      subdomainDemos:true,
      templateSwap:true,
      payloadSplitter:true,
      printPreflight:true,
      trackingReconciliation:Boolean(env.SBC_TRACKING_PROVIDER_URL),
      autonomousDialing:Boolean(env.SBC_DIALER_PROVIDER_URL || env.TWILIO_ACCOUNT_SID),
      performanceMetrics:true,
      transcriptSummarizer:Boolean(env.SBC_TRANSCRIPT_PROVIDER_URL),
      tenantIsolation:true,
      visibilityControls:true,
      idempotency:true,
      fulfillmentAdapters:true,
      schemaIsolation:true,
      sandbox:true,
      realtimeBroadcast:Boolean(env.SBC_WS_ENABLED==='true'),
      workflows:Boolean(env.SBC_TEMPORAL_URL)
    },
    policy:{
      externalProvidersAreExplicit:true,
      geofenceRequiresProviderAndUserScope:true,
      browserAndCallRecordingRequireConsent:true,
      brandDiscoveryIsPublicWebMetadataOnly:true,
      demoSubdomainsRequireDnsOrReverseProxyRouting:true,
      printFilesAreNeverAutoModifiedWithoutExplicitPolicy:true,
      fulfillmentRemainsPaymentGated:true,
      idempotencyRequiredForExternalWrites:true,
      tenantFilterRequiredAtRepositoryBoundary:true,
      sandboxCannotTouchProductionVendors:true,
      ownerControlsIrreversibleActions:true
    }
  };
}

function createState(existing={}){
  return existing && typeof existing==='object' ? existing : {};
}

function ensure(state){
  const keys=['quoteSessions','telephonySync','prospectRuns','brandProfiles','demoVariants','trackingEvents','employeeMetrics','workflowRuns','idempotencyKeys','sandboxRuns','broadcastEvents','featureAudit'];
  for(const k of keys) if(!Array.isArray(state[k])) state[k]=[];
  return state;
}

function tenantContext(req, fallback='sbc-default'){
  const raw=String(req?.headers?.['x-tenant-id']||req?.user?.tenantId||fallback).trim();
  return raw.slice(0,128)||fallback;
}
function scoped(rows,tenantId){return (rows||[]).filter(x=>String(x.tenantId||'sbc-default')===String(tenantId));}

function idempotencyKey(input){
  const raw=typeof input==='string'?input:JSON.stringify(input||{});
  return sha256(raw).slice(0,48);
}

function calculateQuote(base, adjustments=[]){
  const result={quantity:Math.max(1,Number(base?.quantity||1)),unitPrice:Math.max(0,Number(base?.unitPrice||0)),materialMultiplier:Math.max(0,Number(base?.materialMultiplier||1)),setupFee:Math.max(0,Number(base?.setupFee||0)),discount:Math.max(0,Number(base?.discount||0))};
  for(const a of adjustments||[]){
    if(a.type==='quantity')result.quantity=Math.max(1,Number(a.value||1));
    if(a.type==='materialMultiplier')result.materialMultiplier=Math.max(.01,Number(a.value||1));
    if(a.type==='setupFee')result.setupFee=Math.max(0,Number(a.value||0));
    if(a.type==='discount')result.discount=Math.max(0,Number(a.value||0));
  }
  result.subtotal=result.quantity*result.unitPrice*result.materialMultiplier+result.setupFee;
  result.total=Math.max(0,result.subtotal-result.discount);
  return result;
}

function rankDialQueue(customers=[], metrics=[], opts={}){
  const nowMs=Date.now();
  const weights=opts.weights||{recency:.35,engagement:.25,conversion:.25,value:.15};
  return customers.map(c=>{
    const m=metrics.find(x=>x.customerId===c.id)||{};
    const recency=Math.max(0,1-Math.min(1,(nowMs-new Date(m.lastContactAt||c.updatedAt||0).getTime())/(30*864e5)));
    const engagement=Math.min(1,Number(m.touchpoints||0)/10);
    const conversion=Math.min(1,Math.max(0,Number(m.closeProbability||0)));
    const value=Math.min(1,Math.max(0,Number(m.estimatedValue||c.estimatedValue||0)/5000));
    const score=recency*weights.recency+engagement*weights.engagement+conversion*weights.conversion+value*weights.value;
    return {...c,engagementScore:Number(score.toFixed(4))};
  }).sort((a,b)=>b.engagementScore-a.engagementScore);
}

function splitFulfillment(items=[]){
  const groups={};
  for(const item of items){
    const p=String(item.product||item.name||'').toLowerCase();
    let vendor='internal';
    if(/card|business card/.test(p))vendor='4OVER4';
    else if(/flyer|brochure|door hanger|postcard|print/.test(p))vendor='VISTAPRINT';
    else if(/domain|hosting|wordpress|microsoft 365|email/.test(p))vendor='GODADDY';
    (groups[vendor] ||= []).push(item);
  }
  return Object.entries(groups).map(([vendor,items])=>({id:id('vendorjob'),vendor,items,status:'ready',createdAt:now()}));
}

function printPreflight(file={}){
  const issues=[];
  const dpi=Number(file.dpi||0); const width=Number(file.width||0); const height=Number(file.height||0);
  const ext=String(file.extension||'').toLowerCase();
  if(dpi && dpi<300)issues.push({code:'LOW_DPI',severity:'error',message:'Resolution is below the recommended 300 DPI.'});
  if(file.colorProfile && !/cmyk/i.test(String(file.colorProfile)))issues.push({code:'COLOR_PROFILE',severity:'warning',message:'File is not reported as CMYK.'});
  if(file.bleedInches!==undefined && Number(file.bleedInches)<0.125)issues.push({code:'BLEED',severity:'warning',message:'Bleed is below 0.125 inch.'});
  if(ext && !['pdf','png','jpg','jpeg','tif','tiff'].includes(ext))issues.push({code:'FORMAT',severity:'warning',message:`Format .${ext} may not be accepted by all print vendors.`});
  return {ok:!issues.some(x=>x.severity==='error'),issues,dimensions:{width,height,dpi},checkedAt:now()};
}

function summarizeTranscript(text=''){
  const clean=String(text).replace(/\s+/g,' ').trim();
  const sentences=clean.match(/[^.!?]+[.!?]+/g)||[clean];
  const keywords=['price','pricing','quote','website','domain','email','cards','flyer','follow up','call back','interested','not interested','payment'];
  const hits=keywords.filter(k=>clean.toLowerCase().includes(k));
  return {summary:sentences.slice(0,4).join(' ').slice(0,1000),keyTopics:hits,actionItems:sentences.filter(s=>/follow|call back|send|email|text|payment|quote/i.test(s)).slice(0,8).map(s=>s.trim()),createdAt:now()};
}

class FulfillmentAdapter{
  constructor(name,config={}){this.name=name;this.config=config;}
  validateOrder(order){return {ok:Boolean(order),errors:order?[]:['Order payload is required.']};}
  async submitOrder(order){return {ok:false,status:'provider_not_configured',vendor:this.name,orderId:order?.id||''};}
  async getTrackingStatus(reference){return {ok:false,status:'provider_not_configured',vendor:this.name,reference};}
}

function registerFeatureEvent(state,event){ensure(state);state.featureAudit.unshift({...event,id:id('audit'),createdAt:now()});state.featureAudit=state.featureAudit.slice(0,5000);return state.featureAudit[0];}
function workflowStep(run,action,payload={}){run.history ||= [];run.history.push({action,payload,at:now()});run.updatedAt=now();return run;}

module.exports={FEATURES,readiness,createState,ensure,tenantContext,scoped,idempotencyKey,calculateQuote,rankDialQueue,splitFulfillment,printPreflight,summarizeTranscript,FulfillmentAdapter,registerFeatureEvent,workflowStep};
