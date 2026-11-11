'use strict';
/* Isolated GoDaddy release staging only, never modify canonical source server.js. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66149_HR_DEPARTMENT_OWNER_ROUTE';
const ANCHOR="app.get('/api/v9/payroll',auth,ownerOnly,(req,res)=>";
const ROUTE=[
 '// '+MARK+'; workforce-only read model; no provider, money, account or HR writes.',
 "app.get('/api/hr/workspace',auth,ownerOnly,(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " try{",
 "  const tid=requireRequestTenant(req);",
 "  const model=require('./enterprise/v66149-hr-owner-workstation.cjs');",
 "  const data=model.visible({tenantId:tid,users:db.users||[],v9:v9data()});",
 "  res.json(data);",
 " }catch(e){res.status(Number(e?.status)||503).json({ok:false,error:String(e?.code||'HR_WORKSPACE_READ_UNAVAILABLE')});}",
 "});",
 ''
].join('\n');
function patchServer(raw){
 const s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('function v9data()'))throw Error('HR_NEEDS_EXISTING_PEOPLE_AND_PAYROLL_RUNTIME');
 if(s.split(ANCHOR).length!==2)throw Error('HR_ROUTE_ANCHOR_AMBIGUOUS');
 return s.replace(ANCHOR,ROUTE+ANCHOR);
}
if(require.main===module){
 const p=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(p,'utf8'),next=patchServer(source);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66149_ISOLATED_STAGE!=='YES')throw Error('HR_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(p,next);
 }
 if(process.argv.includes('--verify-staged')&&source!==next)throw Error('HR_ROUTE_MISSING_FROM_RELEASE');
 console.log('[V66.149] HR owner read model '+(source===next?'PRESENT':'STAGE_READY'));
}
module.exports={MARK,patchServer};