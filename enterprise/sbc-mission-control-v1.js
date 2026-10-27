'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const SPOOL=path.join(ROOT,'runtime-spool','mission-control');
const SOURCES=path.join(ROOT,'training-sources');
const EVENTS=path.join(SPOOL,'events.ndjson');
const REBUILDS=path.join(SPOOL,'training-rebuilds.ndjson');
const TRAINING_SYSTEM=require('./training-system-v2');
for(const d of [SPOOL,SOURCES]){try{fs.mkdirSync(d,{recursive:true});}catch{}}
const VERSION='1.0.0';
const now=()=>new Date().toISOString();
const safe=(v,n=500)=>String(v??'').slice(0,n);
const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
function append(file,obj){try{fs.appendFileSync(file,JSON.stringify({...obj,at:now()})+'\n')}catch{}}
function read(file){try{return fs.readFileSync(file,'utf8').split(/\n+/).filter(Boolean).slice(-100).map(x=>JSON.parse(x))}catch{return[]}}
function sourceInventory(){
  const allowed=new Set(['.md','.txt','.json','.csv']);
  const out=[];
  function walk(dir){for(const name of fs.readdirSync(dir,{withFileTypes:true})){if(name.name.startsWith('.'))continue;const p=path.join(dir,name.name);if(name.isDirectory())walk(p);else if(allowed.has(path.extname(name.name).toLowerCase())){try{const b=fs.readFileSync(p);out.push({path:path.relative(ROOT,p),bytes:b.length,sha256:sha(b)});}catch{}}}}
  try{walk(SOURCES)}catch{}
  return out;
}
function desiredServices(){return [
  ['web','Web / Command Center'],['database','MySQL / Durable State'],['revenue','Revenue PLAY'],['payments','Payment Events'],['fulfillment','Fulfillment Worker'],['communications','Email / SMS / Voice'],['training','SBC Academy'],['kim','Kim Operations'],['officebox','Office Box Bridge']
].map(([id,name])=>({id,name,critical:['web','database','revenue','payments','fulfillment'].includes(id)}));}
function health(db){
  const users=Array.isArray(db?.users)?db.users.filter(u=>u.active!==false):[];
  const customers=Array.isArray(db?.customers)?db.customers.length:0;
  const orders=Array.isArray(db?.orders)?db.orders.length:0;
  const openOrders=(db?.orders||[]).filter(o=>!['completed','delivered','cancelled'].includes(String(o.status||'').toLowerCase())).length;
  const training=db?.settings?.trainingCenterV2||{};
  const courses=Array.isArray(training.courses)?training.courses.length:0;
  const published=Array.isArray(training.courses)?training.courses.filter(c=>c.status==='published').length:0;
  const env={square:Boolean(process.env.SQUARE_ACCESS_TOKEN),twilio:Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN),smtp:Boolean(process.env.SMTP_HOST),redis:Boolean(process.env.SBC_REDIS_URL)};
  const productionOn=!Boolean(db?.fantastic4?.autonomous?.paused);
  return {productionOn,process:{pid:process.pid,uptimeSeconds:Math.floor(process.uptime()),memoryMb:Math.round(process.memoryUsage().rss/1048576)},business:{users:users.length,customers,orders,openOrders},training:{courses,published},integrations:env};
}
function assess(db){
  const h=health(db);const issues=[];const events=read(EVENTS);
  if(!h.productionOn)issues.push({id:'AUTONOMOUS_PAUSED',severity:'OWNER',action:'review',message:'Routine autonomous production is paused.'});
  if(!h.integrations.square)issues.push({id:'PAYMENTS_NOT_CONFIGURED',severity:'HIGH',action:'escalate',message:'Square payment integration is not configured.'});
  if(!h.integrations.smtp)issues.push({id:'EMAIL_NOT_CONFIGURED',severity:'MEDIUM',action:'escalate',message:'SMTP is not configured.'});
  if(h.training.courses===0)issues.push({id:'TRAINING_EMPTY',severity:'HIGH',action:'repair',message:'Training catalog contains no courses.'});
  const recent=events.filter(e=>Date.now()-new Date(e.at||0).getTime()<3600000);
  const failed=recent.filter(e=>e.status==='FAILED'||e.severity==='HIGH').length;
  if(failed>=3)issues.push({id:'RECENT_FAILURE_CLUSTER',severity:'HIGH',action:'isolate',message:`${failed} high-severity/failure events recorded in the last hour.`});
  return {version:VERSION,generatedAt:now(),score:Math.max(0,100-(issues.filter(x=>x.severity==='HIGH').length*20)-(issues.filter(x=>x.severity==='MEDIUM').length*8)),health:h,services:desiredServices().map(s=>({...s,status:s.id==='database'?'HEALTHY':s.id==='training'?(h.training.courses?'HEALTHY':'DEGRADED'):s.id==='payments'?(h.integrations.square?'HEALTHY':'STANDBY'):'SUPERVISED'})),issues,recentEvents:events.slice(-20).reverse(),sourceInventory:sourceInventory()};
}
function scanTrainingSources(){
  const current=sourceInventory();const previous=read(REBUILDS).filter(x=>x.type==='source_snapshot').slice(-1)[0]?.sources||[];
  const prev=new Map(previous.map(x=>[x.path,x.sha256]));const changed=current.filter(x=>prev.get(x.path)!==x.sha256);const removed=previous.filter(x=>!current.some(y=>y.path===x.path));
  const result={changed,removed,detectedAt:now(),requiresRebuild:changed.length>0||removed.length>0};
  if(result.requiresRebuild)append(REBUILDS,{type:'rebuild_request',status:'QUEUED',...result});
  append(REBUILDS,{type:'source_snapshot',sources:current});
  return result;
}

function parseSourceToCourse(file){
  const abs=path.join(ROOT,file.path); const raw=fs.readFileSync(abs,'utf8');
  const lines=raw.split(/\r?\n/); const title=(lines.find(x=>/^#\s+/.test(x))||'').replace(/^#\s+/,'').trim()||path.basename(file.path,path.extname(file.path));
  const sections=[]; let current=null;
  for(const line of lines){const h=line.match(/^#{2,3}\s+(.+)/); if(h){current={title:h[1].trim(),lines:[]};sections.push(current);} else if(current&&line.trim())current.lines.push(line.replace(/^[-*]\s+/,'').trim());}
  const modules=(sections.length?sections:[{title:'Source Overview',lines:lines.filter(x=>x.trim()).slice(0,20)}]).slice(0,40).map((x,i)=>({title:x.title.slice(0,180),description:x.lines.slice(0,3).join(' ').slice(0,800),minutes:10,lesson:{objective:x.lines[0]||x.title,learn:x.lines.slice(0,8),practice:{prompt:`Demonstrate the current requirement from “${x.title}”.`,evidence:'Record the action, verification and result.'},knowledgeCheck:{prompt:`Explain the current requirement from “${x.title}” in your own words.`,passingRule:'Accurate and consistent with the current source document.'}},assessment:{passingScore:80,questions:[{id:`src-${i+1}-q1`,prompt:'Explain the required behavior.',answerType:'text'},{id:`src-${i+1}-q2`,prompt:'What evidence proves the behavior was completed correctly?',answerType:'text'}]}}));
  return {title,description:`Automatically generated from approved source: ${file.path}`,modules};
}
async function rebuildApprovedTraining(db,save){
  const files=sourceInventory().filter(x=>x.path.startsWith('training-sources/approved/')); const results=[]; const s=TRAINING_SYSTEM.ensureState(db);
  for(const file of files){
    const existing=s.courses.filter(c=>c.sourcePath===file.path).sort((a,b)=>String(b.version).localeCompare(String(a.version),undefined,{numeric:true}));
    const latest=existing[0]; if(latest?.sourceHash===file.sha256)continue;
    const spec=parseSourceToCourse(file); const version=latest?`${(parseInt(String(latest.version).split('.')[0],10)||1)+1}.0.0`:'1.0.0';
    const c=TRAINING_SYSTEM.createCourse(db,save,{id:'mission-control',name:'Mission Control'}, {title:spec.title,role:'all',version,description:spec.description});
    c.source='SBC Dynamic Learning Content Automation'; c.sourcePath=file.path; c.sourceHash=file.sha256; c.generatedAt=now();
    for(const m of spec.modules)TRAINING_SYSTEM.addModule(db,save,{id:'mission-control',name:'Mission Control'},c.id,m);
    results.push({source:file.path,courseId:c.id,version,status:'draft',modules:spec.modules.length});
  }
  if(results.length)append(REBUILDS,{type:'training_rebuild',status:'CREATED_DRAFTS',results});
  return results;
}
async function tick(db,save){const assessment=assess(db);const sources=scanTrainingSources();let rebuilds=[];if(sources.requiresRebuild&&save){try{rebuilds=await rebuildApprovedTraining(db,save)}catch(e){append(EVENTS,{type:'training_rebuild_error',severity:'HIGH',error:safe(e.message,1000)})}}append(EVENTS,{type:'mission_control_tick',score:assessment.score,issues:assessment.issues.map(x=>x.id),trainingChanges:sources.changed.map(x=>x.path),rebuilds:rebuilds.length});return {assessment,sources,rebuilds};}
module.exports={VERSION,health,assess,sourceInventory,scanTrainingSources,tick,rebuildApprovedTraining,events:()=>read(EVENTS),rebuildQueue:()=>read(REBUILDS).filter(x=>x.type==='rebuild_request').slice(-20)};
