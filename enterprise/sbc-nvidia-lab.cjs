'use strict';
// Explicit standalone operator lab. Never called by a web route or scheduler.
// No real SBC records, auth tokens, tools, public network or automatic retries.
const {performance}=require('node:perf_hooks');
function endpoint(value){
 if(typeof value!=='string'||!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(value))throw Error('LOCAL_ENDPOINT_REQUIRED');
 const url=new URL(value);if(!url.port&&value!=='http://127.0.0.1:80')throw Error('LOCAL_ENDPOINT_REQUIRED');
 return url.origin;
}
function model(value){if(typeof value!=='string'||!/^nvidia\/[A-Za-z0-9._-]{1,120}$/.test(value))throw Error('NVIDIA_MODEL_ID_REQUIRED');return value;}
async function request(transport,origin,path,body){
 const opts={method:body===undefined?'GET':'POST',redirect:'error',headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)};
 if(body!==undefined){opts.headers['content-type']='application/json';opts.body=JSON.stringify(body);}
 const r=await transport(origin+path,opts);
 if(!r?.ok){if(r?.body)await r.body.cancel().catch(()=>{});throw Error('NVIDIA_HTTP_FAILURE');}
 const chunks=[];let size=0;const reader=r.body?.getReader();if(!reader)throw Error('NVIDIA_RESPONSE_REQUIRED');
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();throw Error('NVIDIA_RESPONSE_TOO_LARGE');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 if(path==='/v1/health/ready')return {};
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('NVIDIA_INVALID_JSON');}
}
async function ready(transport,origin,name){
 await request(transport,origin,'/v1/health/ready');
 const models=await request(transport,origin,'/v1/models');
 if(!Array.isArray(models?.data)||!models.data.some(x=>x?.id===name))throw Error('MODEL_NOT_SERVED');
}
async function runLab(env={},transport=fetch){
 const disabled={status:'DISABLED',productionCertified:false,syntheticOnly:true};
 if(env.SBC_NVIDIA_LAB_ENABLED!=='1')return disabled;
 const origin=endpoint(env.SBC_NVIDIA_NIM_URL),name=model(env.SBC_NVIDIA_NIM_MODEL);
 const wantEmbedding=env.SBC_NVIDIA_EMBED_URL!==undefined||env.SBC_NVIDIA_EMBED_MODEL!==undefined;
 const embed=wantEmbedding?{origin:endpoint(env.SBC_NVIDIA_EMBED_URL),name:model(env.SBC_NVIDIA_EMBED_MODEL)}:null;
 const started=performance.now();await ready(transport,origin,name);
 const completion=await request(transport,origin,'/v1/chat/completions',{model:name,messages:[{role:'system',content:'Reply with exactly one word: REVIEW. Do not propose tool calls.'},{role:'user',content:'Synthetic exercise: a fictional order lacks verified payment evidence.'}],max_tokens:32,temperature:0,stream:false});
 const message=completion?.choices?.[0]?.message;
 if(completion?.choices?.length!==1||message?.tool_calls!==undefined||message?.function_call!==undefined||typeof message?.content!=='string'||message.content.trim()!=='REVIEW')throw Error('UNEXPECTED_MODEL_OUTPUT');
 const reasoning={passed:true,model:name};
 let embedding=null;
 if(embed){
  await ready(transport,embed.origin,embed.name);
  const result=await request(transport,embed.origin,'/v1/embeddings',{model:embed.name,input:['Synthetic public business training example.'],input_type:'passage',modality:'text',embedding_type:'float',encoding_format:'float'});
  const item=result?.data?.[0],vector=item?.embedding;
  if(result?.data?.length!==1||item?.index!==0||!Array.isArray(vector)||vector.length<1||vector.length>16384||!vector.every(Number.isFinite)||!vector.some(x=>x!==0))throw Error('INVALID_EMBEDDING');
  embedding={passed:true,model:embed.name,dimensions:vector.length};
 }
 return {status:'SYNTHETIC_PROBE_PASSED',syntheticOnly:true,productionCertified:false,reasoning,embedding,durationMs:Math.max(0,performance.now()-started),providerIdentityAttested:false};
}
if(require.main===module)runLab(process.env).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('NVIDIA lab failed: '+(typeof e?.message==='string'&&/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_TRANSPORT_ERROR'));process.exitCode=1;});
module.exports={runLab,localProtocol:Object.freeze({endpoint,model,request,ready})};
