'use strict';
// Explicit operator-only local test labs, never imported by a production route.
// No real CRM records, customer data, tokens, auto polling or automatic retries.
const {performance}=require('node:perf_hooks');
const {createHash}=require('node:crypto');
const {localProtocol:{endpoint,model,request,ready}}=require('./sbc-nvidia-lab.cjs');
const common={syntheticOnly:true,productionCertified:false,providerIdentityAttested:false};
const jobPath='/v1/jobs/async/job/';
const agent='deep_researcher';
const source='knowledge_layer';
const jobPattern=/^sbc-lab-[a-f0-9]{32}$/;
const states=new Set(['SUBMITTED','RUNNING','SUCCESS','FAILURE','INTERRUPTED']);
const prompt='Synthetic SBC training exercise: use only the isolated fictional training collection to compare the payment evidence and website revision policies. Cite source records. Do not access external tools or real customer information.';
function validJob(x,job){
 if(x?.job_id!==job||x?.agent_type!==agent||!states.has(x.status))throw Error('AIQ_JOB_IDENTITY_MISMATCH');
 return x.status;
}
function sourceUrls(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('AIQ_SOURCE_EVIDENCE_INVALID');
 const set=new Set();
 for(const raw of rows){
  if(typeof raw!=='string'||raw.length>2048)throw Error('AIQ_SOURCE_EVIDENCE_INVALID');
  let u;try{u=new URL(raw)}catch{continue}
  if(u.protocol!=='https:'||u.username||u.password)continue;u.hash='';set.add(u.href);
 }
 return set;
}
async function aiqLab(env={},transport=fetch){
 if(env.SBC_AIQ_LAB_ENABLED!=='1')return {...common,status:'DISABLED'};
 const origin=endpoint(env.SBC_AIQ_URL),mode=env.SBC_AIQ_MODE||'discover',job=env.SBC_AIQ_JOB_ID;
 if(!['discover','submit','status'].includes(mode))throw Error('AIQ_MODE_INVALID');
 if(mode!=='discover'&&!jobPattern.test(job||''))throw Error('SYNTHETIC_JOB_ID_REQUIRED');
 if(mode==='submit'&&env.SBC_AIQ_ISOLATED_ACK!=='1')throw Error('ISOLATED_LAB_ACK_REQUIRED');
 if(mode!=='status'){
  const health=await request(transport,origin,'/health');
  if(health?.status!=='healthy'||health.dask_available!==true||health.db!=='ok'||health.encryption?.ready!==true)throw Error('AIQ_NOT_READY');
  const agents=await request(transport,origin,'/v1/jobs/async/agents');
  const sources=await request(transport,origin,'/v1/data_sources');
  const agentAvailable=Array.isArray(agents?.agents)&&agents.agents.some(x=>x?.agent_type===agent);
  const sourceAvailable=Array.isArray(sources)&&sources.some(x=>x?.id===source);
  if(!agentAvailable||!sourceAvailable)throw Error('AIQ_SYNTHETIC_AGENT_OR_SOURCE_MISSING');
  if(mode==='discover')return {...common,status:'DISCOVERED',agentAvailable,sourceAvailable};
  // One explicit submission with caller-supplied unique ID. Ambiguous transport
  // result must be reconciled by status, never automatically resubmitted.
  const submitted=await request(transport,origin,'/v1/jobs/async/submit',{agent_type:agent,input:prompt,job_id:job,expiry_seconds:600,data_sources:[source]});
  return {...common,jobId:job,status:validJob(submitted,job)};
 }
 const current=await request(transport,origin,jobPath+job),status=validJob(current,job);
 if(status!=='SUCCESS')return {...common,jobId:job,status};
 const report=await request(transport,origin,jobPath+job+'/report');
 const state=await request(transport,origin,jobPath+job+'/state');
 if(report?.job_id!==job||state?.job_id!==job)throw Error('AIQ_JOB_IDENTITY_MISMATCH');
 if(report.has_report!==true||typeof report.report!=='string'||!report.report.trim()||state.has_state!==true)throw Error('AIQ_REPORT_EVIDENCE_MISSING');
 const found=sourceUrls(state.artifacts?.sources?.found_urls),cited=sourceUrls(state.artifacts?.sources?.cited_urls);
 const matched=[...cited].filter(x=>found.has(x)).length;
 return {...common,jobId:job,status:'REPORT_REVIEW_REQUIRED',reportSha256:createHash('sha256').update(report.report).digest('hex'),reportBytes:Buffer.byteLength(report.report),foundSourceCount:found.size,citedSourceCount:cited.size,matchedSourceCount:matched,sourceContentVerified:false};
}
const passages=[
 'Fictional payment policy: verify a provider receipt before releasing paid fulfillment.',
 'Fictional renewal policy: confirm subscription status and ask the owner to approve the renewal.',
 'Fictional design policy: obtain customer approval of the website preview before publication.',
 'Fictional language policy: record the stated Spanish preference and route to a bilingual representative.'
];
const queries=[
 'What evidence must be confirmed before fulfilling a paid order?',
 'Who approves a subscription renewal?',
 '¿Cuándo se puede publicar una página web después de mostrar la vista previa?',
 '¿Cómo se transfiere un cliente que solicita hablar español?'
];
function vectors(result,name,count){
 if(result?.model!==name||!Array.isArray(result.data)||result.data.length!==count)throw Error('INVALID_EMBEDDING_BATCH');
 const out=new Array(count);let dimensions=null;
 for(const item of result.data){
  const i=item?.index,v=item?.embedding;
  if(!Number.isInteger(i)||i<0||i>=count||out[i]||!Array.isArray(v)||v.length<1||v.length>16384||!v.every(Number.isFinite)||dimensions!==null&&v.length!==dimensions)throw Error('INVALID_EMBEDDING_BATCH');
  dimensions=v.length;const max=v.reduce((m,x)=>Math.max(m,Math.abs(x)),0);if(!max)throw Error('INVALID_EMBEDDING_BATCH');
  const scaled=v.map(x=>x/max),norm=Math.sqrt(scaled.reduce((s,x)=>s+x*x,0));
  out[i]=scaled.map(x=>x/norm);
 }
 return out;
}
function score(a,b){return a.reduce((n,x,i)=>n+x*b[i],0);}
async function retrieverLab(env={},transport=fetch){
 if(env.SBC_RETRIEVER_LAB_ENABLED!=='1')return {...common,status:'DISABLED'};
 const origin=endpoint(env.SBC_NVIDIA_EMBED_URL),name=model(env.SBC_NVIDIA_EMBED_MODEL),started=performance.now();
 await ready(transport,origin,name);
 const embed=async(input,input_type)=>vectors(await request(transport,origin,'/v1/embeddings',{model:name,input,input_type,modality:'text',embedding_type:'float',encoding_format:'float'}),name,input.length);
 const docs=await embed(passages,'passage'),qs=await embed(queries,'query');
 if(qs[0].length!==docs[0].length)throw Error('INVALID_EMBEDDING_BATCH');
 const english={correct:0,total:2},spanish={correct:0,total:2};
 for(let i=0;i<qs.length;i++){
  const ranked=docs.map((d,j)=>({j,score:score(qs[i],d)})).sort((a,b)=>b.score-a.score);
  if(ranked[0].j===i&&ranked[0].score-ranked[1].score>1e-9)(i<2?english:spanish).correct++;
 }
 return {...common,status:'SYNTHETIC_RANKING_MEASURED',model:name,dimensions:docs[0].length,english,spanish,accuracy:(english.correct+spanish.correct)/4,durationMs:Math.max(0,performance.now()-started)};
}
if(require.main===module){
 const action=process.argv[2],run=action==='aiq'?aiqLab:action==='retriever'?retrieverLab:null;
 if(!run){console.error('Choose aiq or retriever');process.exitCode=1;}
 else run(process.env).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('NVIDIA research lab failed: '+(/^[A-Z_]+$/.test(e?.message||'')?e.message:'LOCAL_TRANSPORT_ERROR'));process.exitCode=1;});
}
module.exports={aiqLab,retrieverLab};
