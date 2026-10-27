'use strict';
const Gateway=require('./stateless-fulfillment-gateway');
const gateway=new Gateway();
async function dispatchProductionQueue(job){
  const provider=String(job?.provider||'4over4').toLowerCase();
  if(provider!=='4over4') return {ok:false,status:'UNSUPPORTED_PROVIDER',requiresHuman:true};
  const readiness=gateway.readiness('4over4');
  if(!readiness.liveSubmission) return {ok:false,status:readiness.endpointConfigured&&readiness.credentialConfigured?'OWNER_ACTIVATION_REQUIRED':'WAITING_VENDOR_CONTRACT',requiresProviderActivation:true,readiness};
  try{return await gateway.dispatchToVendor(job,'4over4');}
  catch(e){return {ok:false,status:'VENDOR_SUBMISSION_FAILED',requiresHuman:true,error:String(e.message||e),readiness};}
}
module.exports={VERSION:'56.13.0',dispatchProductionQueue,readiness:()=>gateway.readiness('4over4')};
