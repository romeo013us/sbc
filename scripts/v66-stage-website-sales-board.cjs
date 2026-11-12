'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MARK='SBC_WEBSITE_SALES_BOARD_V1';
function patchServer(input){
 if(input.includes(MARK))return input;
 let s=input;
 const once=(before,after)=>{
  assert.equal(s.split(before).length-1,1,'Website Sales stage anchor changed: '+before.slice(0,90));
  s=s.replace(before,()=>after);
 };
 const existingLine="  const slug=SBC_PREVIEW_SALES.newSlug(base);";
 once(existingLine,
  "  // An owner-approved full website is immutable via generic Build Website.\\n"+
  "  // Returning the existing asset prevents accidentally revoking a live sales URL.\\n"+
  "  if(existing?.status==='Approved')return existing;\\n"+
  "  const slug=(existing?.status==='Draft'&&/-[a-f0-9]{32}$/.test(String(existing.slug||'')))?existing.slug:SBC_PREVIEW_SALES.newSlug(base);"
 );
 const marker="require('./enterprise/sbc-website-production-routes.cjs').register(app,{auth,ownerOnly,requireTenant:requireRequestTenant,db,getStore:megaData,saveStore:megaSave,writerReady:()=>!SBC_RUNTIME_READ_ONLY&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady,paidGuard:SBC_V6651_REQUIRE_PAID});";
 once(marker,marker+"\n"+
  "require('./enterprise/sbc-website-sales-board.cjs').register(app,{auth,ownerOnly,requireTenant:requireRequestTenant,db,getStore:megaData,paidGuard:SBC_V6651_REQUIRE_PAID}); // "+MARK);
 return s;
}
if(require.main===module){
 const file=path.join(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8');
 const updated=patchServer(source);
 if(process.argv.includes('--apply')){
  assert.equal(process.env.SBC_ISOLATED_SALES_BOARD_STAGE,'YES','Disposable release stage required');
  if(source!==updated)fs.writeFileSync(file,updated);
 }
 console.log('SBC Website Sales Pipeline stage verified');
}
module.exports={patchServer,MARK};
