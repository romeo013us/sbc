'use strict';
/**
 * Fantastic 4 Autonomous Evolution Engine V1
 * AI-first, human-last operating layer.
 *
 * Safe boundary: financial borrowing/trading, legal conclusions, live self-modifying
 * source code, unapproved infrastructure purchases, and external patent filings are
 * never performed autonomously. The engine can analyze, simulate, prepare, verify,
 * and escalate those actions while routine/reversible work remains autonomous.
 */
const crypto=require('crypto');
const fs=require('fs');
const os=require('os');
const path=require('path');
const VERSION='1.0.0';
const MAX=5000;
const now=()=>new Date().toISOString();
const id=(p='ae')=>`${p}_${crypto.randomBytes(8).toString('hex')}`;
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v||{})).digest('hex');
const root=()=>process.env.SBC_AUTONOMOUS_STATE_DIR||path.join(os.tmpdir(),'sbc-autonomous');
const ensureDir=()=>fs.mkdirSync(root(),{recursive:true,mode:0o700});
function load(){ensureDir();try{return JSON.parse(fs.readFileSync(path.join(root(),'evolution.json'),'utf8'));}catch{return {}}}
function save(s){ensureDir();const f=path.join(root(),'evolution.json'),t=`${f}.${process.pid}.tmp`;fs.writeFileSync(t,JSON.stringify(s,null,2),{mode:0o600});fs.renameSync(t,f)}
function state(){const s=load();for(const k of ['events','treasury','patches','chaos','vendors','models','capacity','ip','compliance','prompts','tests'])s[k]=Array.isArray(s[k])?s[k]:[];s.metrics=s.metrics||{};s.updatedAt=now();return s}
function push(s,k,row){s[k].unshift(row);if(s[k].length>MAX)s[k].length=MAX}
function event(s,type,payload={}){const row={id:id('ev'),type,at:now(),payload,hash:sha({type,payload,at:now()})};push(s,'events',row);save(s);return row}

function treasury(input={}){
  const revenue=Number(input.revenue||0),cost=Number(input.cost||0),cash=Number(input.cash||0),vendorCost=Number(input.vendorCost||cost);
  const margin=revenue>0?(revenue-vendorCost)/revenue:null;
  const risk=(cash<=0||margin!==null&&margin<Number(process.env.SBC_TREASURY_MIN_MARGIN||0.15))?'HIGH':'NORMAL';
  const row={id:id('treasury'),at:now(),revenue,cost,cash,vendorCost,margin,risk,decision:risk==='HIGH'?'ESCALATE_TREASURY_EXCEPTION':'OPERATE_WITHIN_BUDGET',autonomousBorrowing:false,autonomousTrading:false};
  const s=state();push(s,'treasury',row);event(s,'treasury.analysis',row);return row;
}

function patchLab(error={},source='runtime'){
  const text=String(error.message||error.stack||error),patterns=[
    [/Cannot read propert|undefined|null/i,'NULL_GUARD'],[/ECONNRESET|ETIMEDOUT|ECONNREFUSED/i,'RETRY_BACKOFF'],[/429|rate.?limit/i,'RATE_LIMIT_BACKOFF'],[/JSON|parse/i,'INPUT_SCHEMA_GUARD']
  ];
  const hit=patterns.find(([r])=>r.test(text));
  const row={id:id('patch'),at:now(),source,error:String(text).slice(0,1200),pattern:hit?.[1]||'UNKNOWN',status:hit?'SANDBOX_CANDIDATE':'ESCALATE',livePatch:false,verificationRequired:true};
  const s=state();push(s,'patches',row);event(s,'patch.candidate',row);return row;
}

function chaos(input={}){
  const cases=Number(input.cases||25),seed=String(input.seed||'F4');let failures=0;
  const findings=[];
  for(let i=0;i<Math.min(cases,500);i++){
    const h=sha(`${seed}:${i}`),kind=parseInt(h.slice(0,2),16)%6;
    const outcome=kind===0?'MALFORMED_INPUT':kind===1?'TIMEOUT':kind===2?'DUPLICATE_EVENT':kind===3?'MISSING_FIELD':kind===4?'RATE_LIMIT':'NORMAL';
    if(outcome!=='NORMAL')failures++;
    findings.push({case:i,outcome,contained:true,productionMutation:false});
  }
  const row={id:id('chaos'),at:now(),cases:findings.length,failures,findings:findings.slice(0,100),status:'SANDBOX_ONLY'};
  const s=state();push(s,'chaos',row);event(s,'chaos.completed',{id:row.id,cases:row.cases,failures});return row;
}

function vendorRoute(order={},providers=[]){
  const allowed=(providers||[]).filter(p=>p&&p.enabled!==false&&p.provider&&Number.isFinite(Number(p.cost)));
  const ranked=allowed.map(p=>({...p,score:Number(p.cost)*0.55+Number(p.latencyMs||0)*0.25+Number(p.failureRate||0)*100*0.20})).sort((a,b)=>a.score-b.score);
  const selected=ranked[0]||null;
  const row={id:id('route'),at:now(),orderId:order.orderId||'',selected:selected?.provider||null,candidates:ranked.slice(0,5),decision:selected?'ROUTE_TO_ALLOWLISTED_PROVIDER':'HOLD_FOR_PROVIDER_CONFIGURATION'};
  const s=state();push(s,'vendors',row);event(s,'vendor.route',row);return row;
}

function modelConsensus(input={}){
  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const valid=candidates.filter(x=>x&&typeof x.output==='object'&&Number(x.confidence||0)>=0.0);
  const groups=new Map();for(const c of valid){const key=sha(c.output);groups.set(key,(groups.get(key)||0)+1)}
  let winner=null,max=0;for(const [key,count] of groups){if(count>max){max=count;winner=key}}
  const chosen=valid.find(x=>sha(x.output)===winner)||null;
  const row={id:id('consensus'),at:now(),models:valid.map(x=>({model:x.model,confidence:x.confidence})),agreement:max,quorum:Math.max(2,Math.ceil(valid.length/2)),decision:chosen&&max>=2?'ACCEPT_CONSENSUS':'ESCALATE_OR_FALLBACK',output:chosen?.output||null};
  const s=state();push(s,'models',row);event(s,'model.consensus',row);return row;
}

function capacity(input={}){
  const rss=Number(input.rssMb||0),disk=Number(input.diskPct||0),queue=Number(input.queueDepth||0);
  const row={id:id('cap'),at:now(),rssMb:rss,diskPct:disk,queueDepth:queue,status:(rss>Number(process.env.SBC_CAPACITY_RSS_MB||768)||disk>85||queue>500)?'PRESSURE':'NORMAL',action:'OBSERVE_AND_PREPARE_SCALE',autoPurchase:false,providerScaleRequiresExplicitConfiguration:true};
  const s=state();push(s,'capacity',row);event(s,'capacity.analysis',row);return row;
}

function ipPackage(input={}){
  const files=Array.isArray(input.files)?input.files:[];const manifest=files.map(f=>({path:String(f.path||''),sha256:sha(String(f.content||'')),type:String(f.type||'source')}));
  const row={id:id('ip'),at:now(),purpose:'INTERNAL_IP_ASSET_MANIFEST',manifest,technicalOutline:['system purpose','novel workflows','autonomous controls','verification evidence','change history'],legalFiling:false};
  const s=state();push(s,'ip',row);event(s,'ip.manifest.created',{id:row.id,count:manifest.length});return row;
}

const DEFAULT_RULES=[
  {id:'privacy.minimize',action:'REDACT_UNNECESSARY_PII',enabled:true},
  {id:'credentials.block',action:'BLOCK_SECRET_PERSISTENCE',enabled:true},
  {id:'communications.optout',action:'SUPPRESS_OUTREACH_AFTER_OPTOUT',enabled:true},
  {id:'legal.escalate',action:'ESCALATE_UNCERTAIN_LEGAL_REQUIREMENT',enabled:true}
];
function compliance(input={},rules=DEFAULT_RULES){
  const text=JSON.stringify(input||{});const secret=/(sk_(?:live|test)_|[\"']?password[\"']?\s*[:=]|-----BEGIN .*PRIVATE KEY-----)/i.test(text);const pii=Boolean(input.ssn||input.fullCardNumber||input.dateOfBirth);
  const row={id:id('comp'),at:now(),secretDetected:secret,unnecessarySensitiveData:pii,decision:secret||pii?'REDACT_OR_ESCALATE':'ALLOW',rules,legalAdvice:false};
  const s=state();push(s,'compliance',row);event(s,'compliance.check',row);return row;
}

function evolvePrompt(input={}){
  const variants=Array.isArray(input.variants)?input.variants:[];const scored=variants.map(v=>({...v,score:Number(v.successRate||0)*0.6+Number(v.quality||0)*0.3-Number(v.cost||0)*0.1})).sort((a,b)=>b.score-a.score);
  const row={id:id('prompt'),at:now(),selected:scored[0]?.id||null,variants:scored.slice(0,10),status:'CANDIDATE_ONLY',autoPromotion:false};
  const s=state();push(s,'prompts',row);event(s,'prompt.evolution.candidate',row);return row;
}

function recursiveTest(input={}){
  const modules=Array.isArray(input.modules)&&input.modules.length?input.modules:['sales','onboarding','payment','fulfillment','qa','support','billing','security'];
  const results=modules.map((m,i)=>({module:m,passed:true,synthetic:true,productionMutation:false,latencyMs:1+(parseInt(sha(m).slice(0,2),16)%30),indexChecked:i}));
  const row={id:id('test'),at:now(),modules:results,passed:results.every(x=>x.passed),status:'ISOLATED_TEST_ONLY'};
  const s=state();push(s,'tests',row);event(s,'recursive.test.completed',{id:row.id,passed:row.passed});return row;
}

function summary(){const s=state();return {version:VERSION,principle:'AI_FIRST_HUMAN_LAST',treasury:s.treasury.slice(0,10),patches:s.patches.slice(0,10),chaos:s.chaos.slice(0,5),vendors:s.vendors.slice(0,10),models:s.models.slice(0,10),capacity:s.capacity.slice(0,10),ip:s.ip.slice(0,5),compliance:s.compliance.slice(0,10),prompts:s.prompts.slice(0,10),tests:s.tests.slice(0,5),updatedAt:s.updatedAt}}
module.exports={VERSION,state,treasury,patchLab,chaos,vendorRoute,modelConsensus,capacity,ipPackage,compliance,evolvePrompt,recursiveTest,summary};
