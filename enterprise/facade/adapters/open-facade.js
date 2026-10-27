'use strict';
module.exports={dispatch:async(payload)=>({accepted:true,queued:true,provider:String(payload?.provider||'provider-neutral'),action:String(payload?.action||'BRIDGE_REQUEST'),secretsAdded:0}),health:()=>({ok:true,providerNeutral:true,secretsAdded:0})};
