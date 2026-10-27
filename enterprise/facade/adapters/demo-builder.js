'use strict';
module.exports={dispatch:async(payload)=>({accepted:true,queued:true,customerId:String(payload?.customerId||''),mode:'personalized-preview'}),health:()=>({ok:true})};
