'use strict';
const crypto=require('crypto');
function createSandboxOrchestrator({spawn,logger=console}={}){
 async function provision(spec={}){const id=`shadow-build_${crypto.randomBytes(8).toString('hex')}`;const limits={cpuMs:Number(spec.cpuMs||10000),memoryMb:Number(spec.memoryMb||256),diskMb:Number(spec.diskMb||256),network:false,tmpfsMb:Number(spec.tmpfsMb||64),ephemeral:true};const policy={autoRemove:true,network:'none',tmpfs:`/tmp:rw,size=${limits.tmpfsMb}m`,readOnlyOutput:true};if(typeof spawn!=='function')return {ok:false,id,status:'STANDBY',limits,policy,reason:'Sandbox runtime not supplied.'};try{const result=await spawn({id,limits,policy,input:spec.input||{},network:false,ephemeral:true});return {ok:true,id,status:'READY',limits,policy,result};}catch(e){logger.warn('[GODKIM SANDBOX]',e.message);return {ok:false,id,status:'FAILED',limits,policy,reason:e.message};}}
 return {provision};
}
module.exports={createSandboxOrchestrator};
