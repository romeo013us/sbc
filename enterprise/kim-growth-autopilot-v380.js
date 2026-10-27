'use strict';
const crypto=require('crypto');
const now=()=>new Date().toISOString();
const id=(p='growth')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');

const AUTOMATIONS=[
['01','collinson-staging-trick','Custom-branded prospect sandbox builder','sandbox','REVIEW'],
['02','niched-multi-pod-blasts','Micro-vertical prospect segmentation and campaign drafting','outbound','REVIEW'],
['03','technical-asset-gap-fingerprint','Website technical gap scanner using permitted public HTTP checks','research','AUTO'],
['04','astra-persona-outreach','AI-assisted outreach drafting from verified audit findings','outbound','REVIEW'],
['05','one-click-demo-previews','Short-lived prospect demo preview creation','demo','AUTO'],
['06','business-card-sample-runs','Print sample preparation and provider-ready payload staging','print','REVIEW'],
['07','warm-profile-transition','Content calendar and human-review outreach preparation','social','REVIEW'],
['08','concierge-data-migration','Migration assessment and scoped intake package generator','migration','REVIEW'],
['09','multi-tenant-feature-previews','Isolated 14-day prospect sandbox provisioning','sandbox','REVIEW'],
['10','local-qr-code-footprints','Trackable QR campaign asset generation','marketing','AUTO'],
['11','high-intent-search-traffic','GBP/search-intent content opportunity planner','discovery','REVIEW'],
['12','profile-duplication-warnings','Business-profile consistency audit queue','discovery','AUTO'],
['13','competitor-review-signal-tracking','Public review-theme research without individual targeting automation','research','REVIEW'],
['14','niche-community-partners','Public community opportunity research using compliant sources','research','REVIEW'],
['15','micro-influencer-asset-swaps','Partner outreach package and sandbox offer generator','partner','REVIEW'],
['16','interactive-mvp-node','Public sandbox/demo release package generator','demo','REVIEW'],
['17','chamber-partner-pipeline','Chamber partnership prospect workflow','partner','REVIEW'],
['18','workspace-masterclasses','Masterclass event planning and registration workflow','content','REVIEW'],
['19','custom-niche-landing-pages','Industry landing-page brief and template generator','content','AUTO'],
['20','brand-search-campaigns','Competitor/brand search-intent campaign brief','discovery','REVIEW'],
['21','dynamic-product-mockups','Branded product mockup job creation','creative','AUTO'],
['22','one-click-subdomain-provisioning','Prospect subdomain request preparation with provider safety gate','provisioning','REVIEW'],
['23','case-study-publisher','Case-study draft generator from verified outcomes','content','REVIEW'],
['24','industry-checklist-templates','Industry checklist/template generator','content','AUTO'],
['25','founding-member-pricing','Founder-offer eligibility workflow without changing catalog pricing','pricing','REVIEW'],
['26','dtf-garment-demonstrations','DTF demonstration job staging','print','REVIEW'],
['27','inbound-referral-matrix','Referral attribution and reward eligibility engine','referral','AUTO'],
['28','fast-growing-startups','New-business signal ingestion from permitted sources','discovery','REVIEW'],
['29','free-technical-audits','Prospect technical audit report generator','research','REVIEW'],
['30','branded-office-collateral','Brand compliance check for generated collateral','marketing','AUTO'],
['31','interactive-profit-calculators','Prospect savings calculator job','marketing','AUTO'],
['32','high-end-video-overlays','Prospect demo video brief/storyboard generator','creative','REVIEW'],
['33','technology-readiness-publisher','Verified readiness evidence pack generator','content','REVIEW'],
['34','alpha-testing-pools','Sandbox tester cohort manager','testing','REVIEW'],
['35','local-roundtable-events','Roundtable planning and invitation workflow','events','REVIEW'],
['36','distressed-business-upgrades','Public-signal website/brand modernization opportunity queue','discovery','REVIEW'],
['37','fast-sandbox-onboarding','Sub-60-second sandbox provisioning path','sandbox','AUTO'],
['38','behavioral-popups','Consent-aware exit-intent offer configuration','marketing','REVIEW'],
['39','targeted-b2b-ad-briefs','Audience/ad-variant brief generator','marketing','REVIEW'],
['40','branded-educational-ebooks','Educational guide generation workflow','content','REVIEW'],
['41','company-in-a-box','Turnkey package recommendation workflow','sales','REVIEW'],
['42','public-template-directory','Template publication pipeline','content','REVIEW'],
['43','dynamic-retargeting','Consent-aware retargeting audience event pipeline','marketing','REVIEW'],
['44','coworking-partners','Coworking partnership opportunity workflow','partner','REVIEW'],
['45','industry-design-contests','Contest planning and submission workflow','marketing','REVIEW'],
['46','load-speed-conversion','Landing-page performance audit queue','research','AUTO'],
['47','engineering-deep-dives','Technical article generator from verified architecture evidence','content','REVIEW'],
['48','flash-staging-promos','Limited-quantity promotion eligibility workflow','marketing','REVIEW'],
['49','transition-field-targeting','Growth-signal prospect queue for selected industries','discovery','REVIEW'],
['50','uncompromising-quality-gate','Pre-publication quality/readiness gate','quality','AUTO']
].map(([id,name,title,domain,mode])=>({id,name,title,domain,mode}));

const PROTECTED=['change-owner-security','change-kim-authority','change-pricing','approve-refund','alter-payment-status','rotate-production-secret','permanent-delete','destructive-database-operation','activate-unverified-provider','publish-unreviewed-external-campaign','perform-notarial-act'];
const state={version:'38.0.0',missions:[],runs:[],segments:[],audits:[],sandboxes:[],automationRuns:0,startedAt:now()};
function getAutomation(idv){return AUTOMATIONS.find(x=>x.id===String(idv)||x.name===String(idv));}
function authorize(role,action){return {allowed:!PROTECTED.includes(action)||role==='owner',protected:PROTECTED.includes(action),reason:PROTECTED.includes(action)&&role!=='owner'?'Owner approval required.':''};}
function createMission(automation,input={},actor='Kim'){
 const a=getAutomation(automation);if(!a)throw new Error('Unknown automation.');
 const m={id:id('mission'),automationId:a.id,automation:a.name,title:a.title,domain:a.domain,mode:a.mode,status:a.mode==='AUTO'?'READY_FOR_EXECUTION':'REVIEW_REQUIRED',createdAt:now(),updatedAt:now(),createdBy:actor,inputHash:hash(input),inputSummary:summarize(input),safety:{externalSend:false,productionWrite:false,requiresHumanReview:a.mode==='REVIEW'}};
 state.missions.unshift(m);state.missions=state.missions.slice(0,1000);return m;
}
function summarize(input){if(!input||typeof input!=='object')return {};const out={};for(const [k,v] of Object.entries(input).slice(0,20)){if(/password|secret|token|api.?key|credential/i.test(k))out[k]='[REDACTED]';else if(typeof v==='string')out[k]=v.slice(0,240);else if(['number','boolean'].includes(typeof v))out[k]=v;else if(Array.isArray(v))out[k]=`[array:${v.length}]`;else out[k]='[object]';}return out;}
function scanWebsite(input={}){const url=String(input.url||'').trim();if(!/^https?:\/\//i.test(url))throw new Error('A public http(s) URL is required.');return {id:id('audit'),url,checks:['https','viewport','title','description','robots','favicon','response-time'],status:'QUEUED',mode:'READ_ONLY_PUBLIC_CHECKS',createdAt:now(),note:'No credentialed crawling or protected/private-area access.'};}
function segmentLeads(rows=[],criteria={}){const buckets={};for(const r of rows){const industry=String(r.industry||'unknown').trim().toLowerCase()||'unknown';const key=criteria.exactMicroVertical?industry:(industry||'unknown');(buckets[key]??=[]).push({...r});}return Object.entries(buckets).map(([segment,items])=>({segment,count:items.length,leadIds:items.map(x=>x.id||x.businessName).slice(0,500)}));}
function createSandbox(input={}){const ttl=Math.min(Math.max(Number(input.ttlMinutes||10080),15),20160);return {id:id('sandbox'),slug:`demo-${crypto.randomBytes(5).toString('hex')}`,expiresAt:new Date(Date.now()+ttl*60000).toISOString(),isolated:true,status:'READY',externalSend:false,createdAt:now(),businessName:String(input.businessName||'Prospect').slice(0,160),template:String(input.template||'sbc-modern').slice(0,80)};}
function qr(input={}){return {id:id('qr'),destination:String(input.destination||'/demo').slice(0,500),campaign:String(input.campaign||'sbc').slice(0,120),trackingKey:id('trk'),createdAt:now()};}
function qualityGate(input={}){const checks=[['inputVerified',input.inputVerified!==false],['brandAssets',input.brandAssets!==false],['pricingSource',input.pricingSource!==false],['consent',input.consent!==false],['noSecrets',input.noSecrets!==false]];return {passed:checks.every(x=>x[1]),checks:checks.map(x=>({name:x[0],ok:x[1]})),generatedAt:now()};}
function summary(){return {version:state.version,count:AUTOMATIONS.length,automations:AUTOMATIONS,missions:state.missions.slice(0,100),segments:state.segments.slice(0,50),audits:state.audits.slice(0,50),sandboxes:state.sandboxes.slice(0,50),runs:state.runs.slice(0,50),generatedAt:now()};}
module.exports={AUTOMATIONS,PROTECTED,state,getAutomation,authorize,createMission,scanWebsite,segmentLeads,createSandbox,qr,qualityGate,summary,hash};
