'use strict';
module.exports={dispatch:async(payload)=>({accepted:true,customerId:String(payload?.customerId||''),surface:'office-box'}),health:()=>({ok:true,surface:'office-box'})};
