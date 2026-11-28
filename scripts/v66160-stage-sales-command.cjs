'use strict';
/* Stage into the DISPOSABLE release copy of server.js only.
 * Never bypass the packaged server SHA, stage inventory, writer lease or receipt gates.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66160_SALES_COMMAND_OWNER_LEDGER';
const ANCHOR="app.get('/api/v9/payroll',auth,ownerOnly,(req,res)=>";
const HR_ANCHOR="app.get('/api/hr/workspace',auth,ownerOnly,(req,res)=>";
const ROUTE=[
 '// '+MARK+'; owner-approved monthly commissions, read-only manager progress.',
 "require('./routes/sbc-public-discovery-v1.cjs').register(app);",
 "require('./routes/sbc-sales-command-v1.cjs').register(app,{",
 ' auth,',
 ' getContext:()=>({db,mysqlPool,recoveryRequired:()=>MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED,canWrite:()=>!SBC_RUNTIME_READ_ONLY&&!sbcShutdownStarted&&!!mysqlPool&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady}),',
 ' tenantForRead:req=>requireRequestTenant(req),',
 ' writer:()=>SBC_V6649_REQUIRE_WRITER()',
 '});',
 ''
].join('\n');
function patchServer(raw){
 const s=String(raw||'');
 if(s.includes(MARK)){
  const start=s.indexOf(MARK),end=s.indexOf('\n});',start);
  if(end<start)throw Error('SALES_COMMAND_CONTEXT_MISSING');
  const block=s.slice(start,end);
  const old=" getContext:()=>({db,mysqlPool,recoveryRequired:()=>MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED}),",next=" getContext:()=>({db,mysqlPool,recoveryRequired:()=>MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED,canWrite:()=>!SBC_RUNTIME_READ_ONLY&&!sbcShutdownStarted&&!!mysqlPool&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady}),";
  if(block.includes(next))return s;
  if(block.split(old).length!==2)throw Error('SALES_COMMAND_CONTEXT_ANCHOR_NOT_UNIQUE');
  return s.slice(0,start)+block.replace(old,next)+s.slice(end);
 }
 if(!s.includes('function v9data()')||!s.includes('SBC_V6649_REQUIRE_WRITER'))
  throw Error('SALES_COMMAND_REQUIRES_FULL_SECURE_SERVER');
 // Existing HR tests isolate the route block from HR -> payroll. Insert BEFORE HR.
 // Canonical unstaged source may not contain HR yet, so allow a dry-run fallback.
 const target=s.includes(HR_ANCHOR)?HR_ANCHOR:ANCHOR;
 if(s.split(target).length!==2)throw Error('SALES_COMMAND_ANCHOR_NOT_UNIQUE');
 return s.replace(target,ROUTE+target);
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
