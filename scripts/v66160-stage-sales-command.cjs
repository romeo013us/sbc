'use strict';
/* Stage into the DISPOSABLE release copy of server.js only.
 * Never bypass the packaged server SHA, stage inventory, writer lease or receipt gates.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66160_SALES_COMMAND_OWNER_LEDGER';
const ANCHOR="app.get('/api/v9/payroll',auth,ownerOnly,(req,res)=>";
const ROUTE=[
 '// '+MARK+'; owner-approved monthly commissions, read-only manager progress.',
 "require('./routes/sbc-sales-command-v1.cjs').register(app,{",
 ' auth,',
 ' getContext:()=>({db,mysqlPool,recoveryRequired:()=>MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED}),',
 ' tenantForRead:req=>requireRequestTenant(req),',
 ' writer:()=>SBC_V6649_REQUIRE_WRITER()',
 '});',
 ''
].join('\n');
function patchServer(raw){
 const s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('function v9data()')||!s.includes('SBC_V6649_REQUIRE_WRITER'))
  throw Error('SALES_COMMAND_REQUIRES_FULL_SECURE_SERVER');
 if(s.split(ANCHOR).length!==2)throw Error('SALES_COMMAND_ANCHOR_NOT_UNIQUE');
 return s.replace(ANCHOR,ROUTE+ANCHOR);
}
if(require.main===module){
 const p=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(p,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66160_ISOLATED_STAGE!=='YES')throw Error('SALES_COMMAND_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(p,after);
 }
 if(process.argv.includes('--verify-staged')&&before!==after)throw Error('SALES_COMMAND_MISSING_FROM_COMPILED_RELEASE');
 console.log('[SBC V66.160] Sales Command '+(before===after?'ALREADY_STAGED':'SOURCE_READY'));
}
module.exports={MARK,patchServer};
