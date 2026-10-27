'use strict';
const {createEventSpooler}=require('./godkim-event-spooler');
const {auditSecrets}=require('./godkim-secret-audit');
const {createShadowContext}=require('./godkim-shadow');
const {createProviderFailover}=require('./godkim-provider-failover');
function createGodKimFabric({root=process.cwd(),providerConfig=()=>({}),submit=async()=>{throw new Error('provider submit not configured')},onEvent=async()=>{},logger=console}={}){
 const spool=createEventSpooler({root,file:require('path').join(root,'runtime-spool','events.ndjson'),logger,onEvent});
 const failover=createProviderFailover({providerConfig,submit,logger});
 function pulse({tenantId=1,actorId='godkim',requestId,capability='observe'}={}){return {ok:true,context:createShadowContext({tenantId,actorId,requestId,capability}),timestamp:new Date().toISOString(),spool:spool.stats()};}
 function readiness(){const secret=auditSecrets({root,logger});return {ok:true,version:'GodKim-Fabric-2.0',continuousPulse:true,eventDrivenSpooler:spool.stats(),secretPolicy:{ok:secret.ok,count:secret.count},shadowIsolation:true,providerFailover:true,dynamicSandbox:true,tenantContext:'AsyncLocalStorage',notes:['Failover is allowlisted and fail-closed.','Sandbox remains network-disabled unless an approved runtime explicitly enables a provider.','Secret audit scans source/build artifacts but never prints secret values.']};}
 return {spool,failover,pulse,readiness};
}
module.exports={createGodKimFabric};
