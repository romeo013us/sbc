'use strict';
// Pure planning only. Call with authenticated tenant and server-owned worker registry.
// A ready plan is not a reservation, completed render, or permission to publish.
const catalog=Object.freeze({
 'vector-design':[['browser','native-svg']],
 'template-video':[['cpu','ffmpeg']],
 'narration':[['cpu','kokoro']],
 'captions':[['cpu','whisper.cpp']],
 'ai-image':[['gpu','flux']],
 'ai-video':[['gpu','wan']]
});
const keys=new Set(['kind','tenantId','workers','now']);
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
function planRender(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.has(k)))throw Error('INVALID_CREATIVE_REQUEST');
 const {kind,tenantId,workers,now}=input;
 if(typeof kind!=='string'||!Object.hasOwn(catalog,kind))throw Error('INVALID_CREATIVE_KIND');
 if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Error('INVALID_CREATIVE_TENANT');
 if(!Array.isArray(workers)||workers.length>1000||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_CREATIVE_REGISTRY');
 const [mode,engine]=catalog[kind][0];
 if(mode==='browser')return {status:'ready',mode,engine,workerId:null,paidFallback:false};
 const candidates=workers.filter(w=>w&&validId(w.id)&&w.tenantId===tenantId&&w.authorized===true&&w.healthy===true&&w.billing==='local'&&w.commercialApproved===true&&w.mode===mode&&w.engine===engine&&Number.isSafeInteger(w.heartbeatAt)&&w.heartbeatAt<=now&&w.heartbeatAt>=now-60000&&Number.isSafeInteger(w.availableSlots)&&w.availableSlots>0);
 candidates.sort((a,b)=>b.availableSlots-a.availableSlots||(a.id<b.id?-1:a.id>b.id?1:0));
 if(!candidates.length)return {status:'waiting',mode,engine,workerId:null,paidFallback:false,reason:'COMPATIBLE_AUTHORIZED_WORKER_REQUIRED'};
 return {status:'ready',mode,engine,workerId:candidates[0].id,paidFallback:false};
}
module.exports={planRender};
