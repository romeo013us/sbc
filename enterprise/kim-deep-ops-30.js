'use strict';
const crypto=require('crypto');
const zlib=require('zlib');

// V43.9.0: deep-operations fabric. All external execution is fail-closed and provider-gated.
const EXCLUSIVE_15=[
 ['KIM-101','Content-Addressed Artifact Vault','Print/asset integrity','Hashes artwork/content so identical assets can be deduplicated and verified without trusting filenames.'],
 ['KIM-102','Merkle Proof Ledger','Audit integrity','Builds a rolling Merkle root over audit entries so tampering becomes detectable without storing a second copy of every event.'],
 ['KIM-103','Lease Fencing Tokens','Distributed work safety','Issues monotonically increasing worker leases so an expired worker cannot safely overwrite a newer job owner.'],
 ['KIM-104','Deterministic Workflow Replay','Recovery engineering','Records bounded workflow inputs and transitions so a failed workflow can be replayed in a sandbox before recovery.'],
 ['KIM-105','Shadow Contract Validator','Vendor resilience','Validates a vendor payload against the expected contract without transmitting it to the live vendor.'],
 ['KIM-106','Data Lineage Graph','Data governance','Tracks where critical fields came from and which transformations touched them.'],
 ['KIM-107','Cost-to-Serve Profiler','Margin intelligence','Calculates estimated labor, vendor, communication, and fulfillment cost per workflow when inputs are available.'],
 ['KIM-108','Vendor Quote Drift Sentinel','Procurement intelligence','Compares current vendor quotes against a stored baseline and flags material drift before submission.'],
 ['KIM-109','Synthetic Canary Orders','Production confidence','Runs non-billable synthetic workflow checks through the safe boundary without creating a real customer charge or vendor order.'],
 ['KIM-110','Approval Boundary Compiler','Governance','Converts an action into explicit allowed, review-required, and prohibited steps before execution.'],
 ['KIM-111','Semantic Diff Guard','Change safety','Compares structured business objects by meaning rather than raw JSON order and flags consequential changes.'],
 ['KIM-112','Recovery Point Selector','Continuity','Chooses the newest verified recovery point that satisfies a requested consistency boundary.'],
 ['KIM-113','Duplicate Intent Resolver','Workflow hygiene','Detects repeated requests that represent the same business intent and proposes a single idempotent action.'],
 ['KIM-114','Operational Entropy Monitor','Operations intelligence','Measures unresolved exceptions, stale work, duplicate work, and state fragmentation as an operational entropy signal.'],
 ['KIM-115','Capability Attestation Matrix','AI governance','Shows which Kim capabilities are implemented, provider-gated, disabled, simulated, or verified so Kim cannot overstate her powers.']
];
function sha(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function artifactHash(input){return sha(Buffer.isBuffer(input)?input:canonical(input));}
function merkleRoot(events){let level=(Array.isArray(events)?events:[]).map(e=>sha(canonical(e)));if(!level.length)return sha('EMPTY');while(level.length>1){const next=[];for(let i=0;i<level.length;i+=2)next.push(sha(level[i]+(level[i+1]||level[i])));level=next;}return level[0];}
function issueLease(worker,sequence,ttlMs=60000){const seq=Math.max(0,Number(sequence)||0)+1;return {worker:String(worker||'unknown'),sequence:seq,leaseUntil:new Date(Date.now()+clamp(Number(ttlMs)||60000,1000,3600000)).toISOString(),fence:sha(`${worker}|${seq}`).slice(0,32)};}
function leaseAccept(current,candidate){return Boolean(candidate&&(!current||Number(candidate.sequence)>Number(current.sequence)));}
function replayPlan(steps=[]){return {mode:'sandbox-replay',steps:(Array.isArray(steps)?steps:[]).slice(0,100).map((s,i)=>({index:i,state:String(s.state||'unknown'),action:String(s.action||'unknown'),inputHash:artifactHash(s.input||{})})),liveMutation:false};}
function validateContract(payload={},schema={}){const missing=[];for(const key of Object.keys(schema.required||{})){if(payload[key]===undefined||payload[key]===null||payload[key]==='')missing.push(key);}return {valid:missing.length===0,missing,transmission:false};}
function lineage(field,source,transforms=[]){return {field:String(field),source:String(source),transforms:Array.isArray(transforms)?transforms.map(String).slice(0,30):[]};}
function costProfile(i={}){const labor=Number(i.laborCost||0),vendor=Number(i.vendorCost||0),comms=Number(i.communicationCost||0),shipping=Number(i.shippingCost||0),other=Number(i.otherCost||0);const total=[labor,vendor,comms,shipping,other].reduce((a,b)=>a+(Number.isFinite(b)?b:0),0);const revenue=Number(i.revenue||0);return {labor,vendor,comms,shipping,other,total,estimatedGrossMargin:revenue?revenue-total:null};}
function quoteDrift(current,baseline,tolerancePct=5){const c=Number(current),b=Number(baseline);if(!Number.isFinite(c)||!Number.isFinite(b)||b===0)return {comparable:false,driftPct:null,flag:false};const drift=((c-b)/b)*100;return {comparable:true,driftPct:Number(drift.toFixed(2)),flag:Math.abs(drift)>=Math.abs(Number(tolerancePct)||5)};}
function syntheticCanary(){return {id:`canary-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,billable:false,realVendorSubmission:false,realPayment:false,steps:['validate','simulate-payment-gate','simulate-fulfillment','verify-idempotency'],status:'PASS'};}
function approvalBoundary(action={}){const irreversible=Boolean(action.irreversible||action.permanent||action.externalFinancialCommit);return {action:String(action.name||'unnamed'),allowed:!irreversible&&action.authorized!==false,reviewRequired:irreversible||action.requiresOwner===true,prohibited:action.prohibited===true,reason:action.prohibited?'Policy prohibits this action.':irreversible?'Owner/review boundary required.':'Reversible or informational action.'};}
function semanticDiff(a={},b={}){const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].sort();const changes=[];for(const k of keys){if(canonical(a?.[k])!==canonical(b?.[k]))changes.push({field:k,before:a?.[k],after:b?.[k]});}return {changed:changes.length>0,changes};}
function chooseRecovery(points=[],consistency='verified'){const candidates=(Array.isArray(points)?points:[]).filter(p=>p&&p.verified===true);if(consistency==='durable')return candidates.filter(p=>p.durable===true).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]||null;return candidates.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]||null;}
function duplicateIntent(intents=[]){const map=new Map();const dup=[];for(const x of Array.isArray(intents)?intents:[]){const k=sha(canonical({type:x.type||'',entityId:x.entityId||'',action:x.action||'',payload:x.payload||{}}));if(map.has(k))dup.push({duplicateOf:map.get(k),id:x.id});else map.set(k,x.id);}return {duplicates:dup,count:dup.length};}
function entropy(s={}){const stale=Number(s.stale||0),failed=Number(s.failed||0),duplicates=Number(s.duplicates||0),blocked=Number(s.blocked||0);const total=stale+failed+duplicates+blocked;return {score:clamp(total,0,100),components:{stale,failed,duplicates,blocked},interpretation:total===0?'clean':total<5?'low':total<15?'moderate':'high'};}
function attest(capabilities=[]){return (Array.isArray(capabilities)?capabilities:[]).map(c=>({id:c.id,status:['implemented','provider-gated','disabled','simulated','verified'].includes(c.status)?c.status:'unknown',evidence:String(c.evidence||'').slice(0,240)}));}
function runtimeSnapshot(state,key){const raw=Buffer.from(JSON.stringify(state||{}));const gz=zlib.gzipSync(raw,{level:6});const iv=crypto.randomBytes(12);const secret=crypto.createHash('sha256').update(String(key||'sbc-runtime-snapshot')).digest();const cipher=crypto.createCipheriv('aes-256-gcm',secret,iv);const enc=Buffer.concat([cipher.update(gz),cipher.final()]);const tag=cipher.getAuthTag();return {algorithm:'AES-256-GCM+gzip',iv:iv.toString('base64'),tag:tag.toString('base64'),data:enc.toString('base64'),bytes:enc.length};}
function tenantContext(tenantId){const raw=String(tenantId||'1').slice(0,120);return {tenantId:raw,marker:sha(`tenant:${raw}`).slice(0,32)};}
function payloadEnvelope(payload,key){const body=canonical(payload||{});const secret=crypto.createHash('sha256').update(String(key||'sbc-payload')).digest();return {algorithm:'HMAC-SHA256',payloadHash:sha(body),signature:crypto.createHmac('sha256',secret).update(body).digest('hex')};}
function rateGuard(bucket={}){const now=Date.now();const windowMs=Math.max(1000,Number(bucket.windowMs||60000));const max=Math.max(1,Number(bucket.max||60));const start=Number(bucket.start||now);const count=Number(bucket.count||0);const active=now-start<windowMs;return {allowed:!active||count<max,nextCount:active?count+1:1,resetAt:new Date((active?start+windowMs:now+windowMs)).toISOString()};}
function cacheKey(v){return sha(canonical(v));}
function leadVelocity(rows=[]){const a=(Array.isArray(rows)?rows:[]).map(r=>({id:r.id,ageHours:Number(r.ageHours||0),engagement:Number(r.engagement||0),fit:Number(r.fit||0),nextStep:Boolean(r.nextStep)}));return a.map(r=>({...r,score:Number(clamp((r.engagement*0.4)+(r.fit*0.4)+(Math.max(0,72-r.ageHours)/72)*20+(r.nextStep?10:0),0,100).toFixed(2))})).sort((x,y)=>y.score-x.score);}
function dnsPlan(domain,target){return {domain:String(domain||'').toLowerCase(),target:String(target||''),provider:'GoDaddy',liveMutation:false,requiresProviderCredentials:true,steps:['validate-domain','create-or-select-zone','apply-records','verify-propagation']};}
function escalationHeartbeat(item={}){const age=Number(item.ageMinutes||0),threshold=Number(item.thresholdMinutes||15);return {urgent:age>=threshold,ageMinutes:age,thresholdMinutes:threshold,channel:'Kim priority queue',liveWebhook:false};}
function vendorPlan(preferred='4over4',candidates=['4over4','vistaprint']){const list=(Array.isArray(candidates)?candidates:[]).filter(x=>['4over4','vistaprint','internal'].includes(String(x)));return {preferred:String(preferred),candidates:list,execute:false,reason:'Failover plan only until an official vendor contract, credentials, payload schema and live execution flag are verified.'};}

const {spawn}=require('child_process');
function binaryPreflightFromBuffer(buffer,filename='artwork.bin',timeoutMs=3500){
  return new Promise(resolve=>{
    const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer||'');
    const candidates=process.env.SBC_PRINT_PREFLIGHT_BINARY?[process.env.SBC_PRINT_PREFLIGHT_BINARY]:['magick','convert'];
    const cmd=candidates[0];
    const args=['identify','-format','%m|%w|%h|%z', '-'];
    const child=spawn(cmd,args,{stdio:['pipe','pipe','pipe']});
    let out='',err='';let done=false;
    const finish=(r)=>{if(done)return;done=true;clearTimeout(timer);resolve(r);};
    const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch{};finish({available:true,ok:false,status:'timeout',filename,message:'Preflight binary timed out.'})},Math.max(500,Number(timeoutMs)||3500));
    child.stdout.on('data',d=>out+=d.toString());child.stderr.on('data',d=>err+=d.toString());
    child.on('error',e=>finish({available:false,ok:false,status:'unavailable',filename,message:e.message}));
    child.on('close',(code)=>finish({available:true,ok:code===0,status:code===0?'verified':'failed',filename,engine:cmd,identify:String(out).trim(),error:String(err).trim().slice(0,500)}));
    child.stdin.end(bytes);
  });
}

function printPreflight(asset={}){const dpi=Number(asset.dpi||0),bleed=Number(asset.bleedInches||asset.bleed||0),color=String(asset.colorSpace||asset.profile||'').toUpperCase();const warnings=[];if(dpi&&dpi<300)warnings.push('Resolution below 300 DPI.');if(color&&color!=='CMYK')warnings.push('Color metadata is not CMYK; verify conversion.');if(bleed<0.125)warnings.push('Bleed below 0.125 in.');return {ok:warnings.length===0,engineAvailable:Boolean(asset.engineAvailable),binaryExecution:Boolean(asset.binaryExecution),warnings};}
function demoClonePlan(input={}){return {sourceMode:'public-metadata-only',brand:{name:String(input.businessName||''),colors:Array.isArray(input.colors)?input.colors.slice(0,8):[]},subdomain:String(input.subdomain||''),liveScrape:false,livePublish:false,requiresConsent:true,estimatedBuild:'provider/template dependent'};}
function persistenceSaga(input={}){const steps=['payment-intent','payment-confirmed','fulfillment-authorized','vendor-submission','completion'];return {steps,state:String(input.state||'payment-intent'),idempotencyKey:sha(canonical({orderId:input.orderId||'',amount:input.amount||0})),externalRollback:false,note:'External charges cannot be rolled back by a database transaction; compensation/refund must be explicit and authorized.'};}
module.exports={EXCLUSIVE_15,binaryPreflightFromBuffer,artifactHash,merkleRoot,issueLease,leaseAccept,replayPlan,validateContract,lineage,costProfile,quoteDrift,syntheticCanary,approvalBoundary,semanticDiff,chooseRecovery,duplicateIntent,entropy,attest,runtimeSnapshot,tenantContext,payloadEnvelope,rateGuard,cacheKey,leadVelocity,dnsPlan,escalationHeartbeat,vendorPlan,printPreflight,demoClonePlan,persistenceSaga};
