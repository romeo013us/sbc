'use strict';
const crypto=require('crypto');
const now=()=>new Date().toISOString();
const id=(p='com')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');

const ITEMS=[
['01','gbp-help-center-readiness','GBP Help Center / duplicate-flag readiness','local-discovery','REVIEW'],
['02','gbp-structural-merge-request','GBP structural merge request package','local-discovery','REVIEW'],
['03','gbp-address-verification','GBP address consistency check','local-discovery','REVIEW'],
['04','gbp-hours-standardization','GBP operating-hours consistency check','local-discovery','AUTO'],
['05','gbp-phone-tracking-metadata','GBP phone metadata readiness','local-discovery','REVIEW'],
['06','gbp-brand-photo-vault','GBP brand-photo asset checklist','local-discovery','AUTO'],
['07','gbp-category-review','GBP category review package','local-discovery','REVIEW'],
['08','gbp-public-staging-link','GBP public staging-link readiness','local-discovery','REVIEW'],
['09','gbp-review-request-kit','Customer review-request kit','local-discovery','REVIEW'],
['10','gbp-weekly-post-queue','Weekly GBP post queue','local-discovery','REVIEW'],
['11','gbp-catalog-link','GBP catalog-link readiness','local-discovery','AUTO'],
['12','gbp-performance-analytics','GBP performance analytics collector','local-discovery','AUTO'],
['13','directory-citation-consistency','Directory citation consistency audit','local-discovery','AUTO'],
['14','site-location-map','Site location-map readiness','local-discovery','AUTO'],
['15','gbp-messaging-readiness','GBP messaging readiness','local-discovery','REVIEW'],
['16','kyb-document-checklist','KYB document checklist','compliance','REVIEW'],
['17','ein-document-check','EIN document presence check','compliance','REVIEW'],
['18','owner-identity-checklist','Owner identity verification checklist','compliance','REVIEW'],
['19','workspace-proof-checklist','Workspace proof checklist','compliance','REVIEW'],
['20','business-bank-readiness','Business bank connection readiness','finance','OWNER'],
['21','transaction-hold-review','Transaction hold review queue','finance','REVIEW'],
['22','multi-currency-readiness','Multi-currency invoicing readiness','finance','OWNER'],
['23','payment-gateway-readiness','Payment gateway integration readiness','finance','OWNER'],
['24','webhook-signature-gate','Webhook signature verification gate','security','AUTO'],
['25','transaction-latency-test','Transaction latency test harness','finance','REVIEW'],
['26','four-over-four-account-readiness','4OVER4 reseller account readiness','vendors','OWNER'],
['27','vistaprint-account-readiness','VistaPrint reseller account readiness','vendors','OWNER'],
['28','provider-secret-reference','Provider secret reference validation','security','OWNER'],
['29','vendor-payload-route-readiness','Vendor payload route readiness','vendors','REVIEW'],
['30','vendor-webhook-ingestion','Vendor webhook ingestion readiness','vendors','AUTO'],
['31','live-cost-source-readiness','Live vendor cost-source readiness','finance','REVIEW'],
['32','vendor-asset-submission-readiness','Vendor asset submission readiness','vendors','REVIEW'],
['33','vendor-sandbox-connectivity','Vendor sandbox connectivity harness','vendors','REVIEW'],
['34','vendor-receipt-trigger','Vendor acknowledgement receipt workflow','finance','REVIEW'],
['35','vendor-order-lock','Post-submission order lock','production','AUTO'],
['36','openai-api-readiness','OpenAI API credential readiness','ai','OWNER'],
['37','ai-secret-vault-reference','AI secret vault reference validation','security','OWNER'],
['38','ai-model-availability-gate','AI model availability gate','ai','REVIEW'],
['39','lornas-prospect-pool-stream','Lorna prospect-pool ingestion','lead-mesh','AUTO'],
['40','compliant-site-audit-worker','Compliant public-site audit worker','lead-intelligence','REVIEW'],
['41','prospect-sandbox-generation','Prospect sandbox generation','sandbox','AUTO'],
['42','prospect-brand-variable-mapping','Prospect brand-variable mapping','sandbox','AUTO'],
['43','lead-conversion-telemetry','Lead conversion telemetry','telemetry','AUTO'],
['44','outreach-audit-log','Outbound communication audit log','communications','AUTO'],
['45','distributed-scrape-lock','Distributed research lock','infrastructure','AUTO'],
['46','role-verification-middleware','Role verification middleware','workforce','AUTO'],
['47','lorna-prospecting-fence','Lorna prospecting workspace fence','workforce','AUTO'],
['48','sales-workspace-fence','Sales workspace fence','workforce','AUTO'],
['49','notary-document-readiness','Florida notary document readiness checklist','notary','REVIEW'],
['50','notary-legal-preflight','Notary legal-field preflight with human/legal-source gate','notary','REVIEW']
].map(([id,name,title,domain,mode])=>({id,name,title,domain,mode}));

const state={version:'39.1.0',items:ITEMS,missions:[],checks:[],startedAt:now()};
const PROTECTED=new Set(['change-business-address','submit-gbp-merge','connect-bank-account','activate-payment-gateway','store-production-secret','activate-production-provider','invoke-unverified-ai-model','perform-notarial-act','change-role-policy']);
function item(x){return ITEMS.find(i=>i.id===String(x)||i.name===String(x));}
function authorize(role,action){const p=PROTECTED.has(String(action));return {allowed:!p||role==='owner',protected:p,reason:p&&role!=='owner'?'Romeo approval required.':''};}
function mission(capability,input={},actor='Kim'){const a=item(capability);if(!a)throw Error('Unknown commercial-readiness capability.');const review=a.mode!=='AUTO';const m={id:id('crm'),capabilityId:a.id,capability:a.name,title:a.title,domain:a.domain,mode:a.mode,status:review?'REVIEW_REQUIRED':'READY',createdBy:actor,createdAt:now(),updatedAt:now(),inputHash:hash(input),safety:{secretAccess:false,externalSubmission:false,productionWrite:false,requiresHumanReview:review}};state.missions.unshift(m);state.missions=state.missions.slice(0,2000);return m;}
function checkBusinessProfile(input={}){const required=['businessName','address','hours','phone'];const missing=required.filter(k=>!String(input[k]??'').trim());return {ok:missing.length===0,missing,normalized:{businessName:String(input.businessName||'').trim(),address:String(input.address||'').trim(),hours:String(input.hours||'').trim(),phone:String(input.phone||'').trim()},checkedAt:now()};}
function checkKYB(input={}){const fields=['articlesOfOrganization','einLetter','ownerId','utilityProof','bankConnection'];const present=fields.filter(k=>Boolean(input[k]));return {complete:present.length===fields.length,present,missing:fields.filter(k=>!input[k]),checkedAt:now()};}
function webhookSignature(raw,signature,secret){if(!secret)return {verified:false,reason:'secret_not_configured'};const expected=crypto.createHmac('sha256',String(secret)).update(Buffer.from(String(raw||''))).digest('hex');const a=Buffer.from(expected),b=Buffer.from(String(signature||''));return {verified:a.length===b.length&&crypto.timingSafeEqual(a,b),algorithm:'HMAC-SHA256'};}
function providerReadiness(provider,env={}){const key=String(provider||'').toLowerCase();const map={four_over_four:['FOUROVER4_ORDER_ENDPOINT','SBC_4OVER4_CREDENTIALS'],vistaprint:['VISTAPRINT_ORDER_ENDPOINT','SBC_VISTAPRINT_CREDENTIALS'],godaddy:['GODADDY_API_KEY','GODADDY_API_SECRET']};const req=map[key]||[];const missing=req.filter(k=>!env[k]);return {provider:key,status:missing.length?'UNVERIFIED':'CONFIGURED',missing,checkedAt:now()};}
function modelReadiness(env={}){return {apiKeyConfigured:Boolean(env.OPENAI_API_KEY),model:String(env.SBC_KIM_MASTER_MODEL||''),modelAvailabilityVerified:false,reason:'Model availability must be verified against the configured provider at runtime.'};}
function notaryPreflight(input={}){const required=['signerName','documentType','venue','notaryName','commissionInfo','identificationMethod','acknowledgementType'];const missing=required.filter(k=>!String(input[k]??'').trim());return {status:missing.length?'REVIEW_REQUIRED':'READY_FOR_HUMAN_REVIEW',missing,legalSourceRequired:true,automatedLegalCertification:false,checkedAt:now()};}
function roleFence(role){const r=String(role||'');if(r==='lead_researcher')return {workspace:'lorna-prospecting',allow:['lead.read','lead.import','lead.clean','lead.verify'],deny:['pricing','refunds','credentials','owner-security','infrastructure','kim-authority','sales-contracts']};if(r==='manager')return {workspace:'sales-management',allow:['sales.read','sales.manage','customers.read','followups.manage'],deny:['credentials','owner-security','infrastructure','kim-authority']};return {workspace:'owner-or-kim',allow:['*'],deny:[]};}

function envConfigured(env, names){return names.filter(n=>Boolean(env[n]&&String(env[n]).trim()));}
function secretDoctor(env={}){
  const groups=[
    {id:'database',label:'Command Center database',required:['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD']},
    {id:'admin',label:'Owner login',required:['SBC_ADMIN_PASSWORD']},
    {id:'square',label:'Square payments',required:['SQUARE_ACCESS_TOKEN','SQUARE_LOCATION_ID']},
    {id:'twilio',label:'Twilio voice/SMS',required:['TWILIO_ACCOUNT_SID','TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET','TWILIO_TWIML_APP_SID','TWILIO_PHONE_NUMBER']},
    {id:'email',label:'Outbound email',required:['SBC_SMTP_HOST','SBC_SMTP_USER','SBC_SMTP_PASS','SBC_MAIL_FROM']},
    {id:'openai',label:'OpenAI / Kim AI',required:['OPENAI_API_KEY']},
    {id:'godaddy',label:'GoDaddy API',required:['GODADDY_PAT']},
    {id:'four_over_four',label:'4OVER4 reseller',required:['FOUROVER4_API_KEY','FOUROVER4_ORDER_ENDPOINT']},
    {id:'vistaprint',label:'VistaPrint reseller',required:['VISTAPRINT_API_KEY','VISTAPRINT_ORDER_ENDPOINT']},
    {id:'public_url',label:'Public Command Center URL',required:['SBC_PUBLIC_URL']},
    {id:'session',label:'Session security',required:['SBC_SESSION_SECRET']}
  ];
  const out=groups.map(g=>{const configured=envConfigured(env,g.required);const missing=g.required.filter(n=>!configured.includes(n));return {id:g.id,label:g.label,status:missing.length?'MISSING':'READY',required:g.required.map(n=>({name:n,set:Boolean(env[n]&&String(env[n]).trim())})),missing};});
  return {checkedAt:now(),secretValuesExposed:false,groups:out,summary:{ready:out.filter(x=>x.status==='READY').length,missing:out.filter(x=>x.status==='MISSING').length,total:out.length}};
}
function commercialAudit(env={}, input={}){
  const profile=checkBusinessProfile(input.businessProfile||{});
  const kyb=checkKYB(input.kyb||{});
  const providers=['four_over_four','vistaprint','godaddy'].map(p=>providerReadiness(p,env));
  const ai=modelReadiness(env);
  const secrets=secretDoctor(env);
  return {version:state.version,checkedAt:now(),profile,kyb,providers,ai,secrets,leadMesh:{status:'READY_TO_INGEST',source:'starter-leads/SBC-250-Verified-Lead-Prospects.csv',note:'Actual file import requires the source file to be present in the runtime.'},google:{status:profile.ok?'READY_FOR_REVIEW':'INPUT_REQUIRED',note:'Google controls profile merge/duplication decisions; this system can prepare and track the evidence package.'},merchant:{status:kyb.complete?'READY_FOR_REVIEW':'DOCUMENTS_OR_ACCOUNT_INPUT_REQUIRED',note:'The payment processor/bank controls KYB approval; this system cannot bypass it.'}};
}

function summary(){return {version:state.version,capabilityCount:ITEMS.length,missions:state.missions.length,ready:state.missions.filter(m=>m.status==='READY').length,review:state.missions.filter(m=>m.status==='REVIEW_REQUIRED').length};}
module.exports={ITEMS,PROTECTED,state,authorize,mission,checkBusinessProfile,checkKYB,webhookSignature,providerReadiness,modelReadiness,notaryPreflight,roleFence,summary,secretDoctor,commercialAudit};
