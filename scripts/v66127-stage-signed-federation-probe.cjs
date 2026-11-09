'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66127_SIGNED_READONLY_OFFICEBOX_FEDERATION';
const file=path.resolve(__dirname,'../server.js');
function patchServer(source){
 if(source.includes(MARK)){
  assert(source.includes("require('./enterprise/v66127-officebox-federation-probe.cjs').probe"));
  return source;
 }
 const anchor=' // SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION';
 const route=[
 ' // '+MARK,
 " app.get('/api/owner/officebox/federation-preflight',auth,ownerOnly,async(req,res)=>{",
 "   res.setHeader('Cache-Control','no-store');",
 '   try{',
 "     const info=await require('./enterprise/v66127-officebox-federation-probe.cjs').probe({",
 '       origin:process.env.SBC_OFFICE_BOX_URL,',
 '       secret:process.env.SBC_WEBHOOK_SECRET,',
 '       transport:globalThis.fetch',
 '     });',
 '     return res.json({ok:true,version:BUILD_VERSION,...info});',
 '   }catch(e){',
 "     return res.status(Number(e?.status||503)).json({ok:false,readOnly:true,chargeAmount:0,",
 "       error:String(e?.code||'OFFICEBOX_PROBE_UNAVAILABLE')});",
 '   }',
 ' });',
 ''
 ].join('\n');
 assert.equal(source.split(anchor).length-1,1,'unique owner reconciliation route anchor required');
 return source.replace(anchor,route+anchor);
}
if(require.main===module){
 const src=fs.readFileSync(file,'utf8'),out=patchServer(src);
 assert.equal(patchServer(out),out,'stage patch not idempotent');
 if(process.argv.includes('--verify-staged'))assert.equal(src,out,'packaged probe missing');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66127_ISOLATED_STAGE!=='YES')throw Error('DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,out);
 }
 console.log('[SBC V66.127] PASS signed no-charge Office Box federation probe');
}
module.exports={MARK,patchServer};
