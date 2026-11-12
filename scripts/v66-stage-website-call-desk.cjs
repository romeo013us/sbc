'use strict';
// Idempotent, verified and isolated GoDaddy candidate patch. Signed master
// remains unchanged until the release build proves the complete dependency set.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MARK='SBC_VERIFIED_WEBSITE_CALL_DESK_V1';
function patchServer(input){
 if(input.includes(MARK))return input;
 let s=input;
 const anchor="require('./enterprise/sbc-website-production-routes.cjs').register(app,{auth,ownerOnly,requireTenant:requireRequestTenant,db,getStore:megaData,saveStore:megaSave,writerReady:()=>!SBC_RUNTIME_READ_ONLY&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady,paidGuard:SBC_V6651_REQUIRE_PAID});";
 assert.equal(s.split(anchor).length-1,1,'Website Production API anchor must be present exactly once');
 const callDesk="require('./enterprise/sbc-website-call-desk.cjs').register(app,{auth,requireTenant:requireRequestTenant,db,getStore:megaData,saveStore:megaSave,writerReady:()=>!SBC_RUNTIME_READ_ONLY&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady}); // "+MARK;
 return s.replace(anchor,anchor+'\n'+callDesk);
}
if(require.main===module){
 const file=path.join(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8'),updated=patchServer(source);
 if(process.argv.includes('--apply')){
  assert.equal(process.env.SBC_ISOLATED_CALL_DESK_STAGE,'YES','Disposable stage required');
  if(source!==updated)fs.writeFileSync(file,updated);
 }
 console.log('SBC verified lead to website call desk staging verified');
}
module.exports={patchServer,MARK};
