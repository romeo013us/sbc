'use strict';
module.exports={dispatch:async(payload)=>({accepted:true,queued:true,policy:'compliant-acquisition-only',source:String(payload?.source||'internal'),action:String(payload?.action||'GENERATE_LANDING_ASSET')}),health:()=>({ok:true,policy:'compliant-acquisition-only'})};
