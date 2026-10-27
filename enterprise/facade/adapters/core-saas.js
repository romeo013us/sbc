'use strict';
module.exports={dispatch:async(payload)=>({accepted:true,mode:'core',eventType:String(payload?.eventType||'CORE_EVENT')}),health:()=>({ok:true,mode:'core'})};
