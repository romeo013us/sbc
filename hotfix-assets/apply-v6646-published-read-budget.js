'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6646_PUBLISHED_READ_BUDGET';
function once(s,a,b,name){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+name+' anchors='+n);return s.replace(a,b)}
function apply(root){
 const file=path.join(root,'server.js'),helper=path.join(__dirname,'../enterprise/v6646-published-read-budget.cjs');
 const dest=path.join(root,'enterprise/v6646-published-read-budget.cjs');
 if(!fs.existsSync(file)||!fs.existsSync(helper))throw Error(MARKER+': missing source files');
 let c=fs.readFileSync(file,'utf8');
 if(c.includes(MARKER))throw Error(MARKER+': duplicate');
 c=once(c,
 'app.use(PRODUCTION_HARDENING.requestId);',
 [
  "app.use(PRODUCTION_HARDENING.requestId);",
  "// "+MARKER+": Published GET responses have an independent safe deadline.",
  "const SBC_PUBLISHED_READ_BUDGET=require('./enterprise/v6646-published-read-budget.cjs').createReadBudget({",
  "  role:SBC_RUNTIME_ROLE,timeoutMs:Number(process.env.SBC_PUBLISHED_API_READ_TIMEOUT_MS||12000)",
  "});",
  "app.use(SBC_PUBLISHED_READ_BUDGET.middleware);"
 ].join('\n'),'read budget installed ahead of auth and protected dashboard routes');
 c=once(c,
 '// V32.9.0 — Enterprise Control Fabric: capabilities 101–150.',
 [
  "app.get('/api/system/published-performance',auth,ownerOnly,(req,res)=>{",
  "  res.setHeader('Cache-Control','no-store');",
  "  res.json({ok:true,version:BUILD_VERSION,at:new Date().toISOString(),",
  "    published:SBC_PUBLISHED_READ_BUDGET.snapshot(),",
  "    writer:{role:SBC_RUNTIME_ROLE,leaseReady:Boolean(sbcWriterLeaseReady),",
  "      recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED),recoveryEvaluated:Boolean(MYSQL_RECOVERY_EVALUATED),",
  "      operationalWorkersEnabled:!SBC_RUNTIME_READ_ONLY&&Boolean(SBC_DDL_ENABLED)},",
  "    note:'This endpoint is a read-only timing diagnostic; it does not guarantee live browser performance.'});",
  "});",
  "// V32.9.0 — Enterprise Control Fabric: capabilities 101–150."
 ].join('\n'),'owner-only read-only published performance route');
 // Session identity fetches in Published are short bursts from the same browser.
 // Keep the original connection cap (2) while avoiding destroy/reconnect every 5s.
 c=once(c,'connectionLimit:2,maxIdle:1,idleTimeout:Number(process.env.SBC_DB_IDLE_TIMEOUT_MS||5000),queueLimit:10',
  'connectionLimit:2,maxIdle:2,idleTimeout:Math.max(20000,Math.min(60000,Number(process.env.SBC_SESSION_DB_IDLE_TIMEOUT_MS||30000))),queueLimit:10',
  'reduce dedicated Published session connection churn without increasing connection cap');
 new vm.Script(c,{filename:'server.js'});new vm.Script(fs.readFileSync(helper,'utf8'),{filename:'v6646-published-read-budget.cjs'});
 fs.copyFileSync(helper,dest);
 fs.writeFileSync(file,c);
 return {marker:MARKER,files:['server.js','enterprise/v6646-published-read-budget.cjs'],
  previewUntouched:true,timeoutOnlyPublishedApiGets:true,streamExempt:true,
  sessionPoolMaxConnectionsUnchanged:2,providerCalls:false,writerLeaseChanged:false,
  financialMutations:false,tenantSecurityChanged:false};
}
module.exports={apply,MARKER,once};
