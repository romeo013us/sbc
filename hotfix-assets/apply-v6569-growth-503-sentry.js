'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6569_GROWTH_503_SENTRY',FROM='65.1.67',TO='65.1.68';
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8')}
function write(root,rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': expected one '+label+' anchor, found '+n);return s.replace(a,b)}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json')),lock=JSON.parse(read(root,'package-lock.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': expected release '+FROM);
 let server=read(root,'server.js');
 if(!server.includes(MARKER)){
  const appAnchorMatch=/(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/;
  const appMatch=appAnchorMatch.exec(server);
  if(!appMatch)throw Error(MARKER+': Express app initialization anchor missing');
  const middleware=[
   appMatch[0],
   '// '+MARKER+': observe only the Growth Status 5xx path; never log cookies, tokens, request bodies, or SQL.',
   'app.use((req,res,next)=>{',
   '  const isGrowthStatus=String(req.path||req.url||\"\").split(\"?\")[0]===\"/api/v56240/growth/status\";',
   '  if(isGrowthStatus){res.once(\"finish\",()=>{if(Number(res.statusCode)<500)return;const user=req.user||null;const tenantPresent=Boolean(req.tenantId||req.tenant_id||req.context?.tenantId||req.auth?.tenantId);const requestId=String(req.requestId||res.getHeader(\"X-Request-Id\")||\"\").slice(0,96);console.error("[SBC_V6569_GROWTH_503_SENTRY] growth_status_5xx",JSON.stringify({at:new Date().toISOString(),method:String(req.method||\"\").slice(0,12),path:\"/api/v56240/growth/status\",status:Number(res.statusCode),requestId:requestId||null,tenantContextPresent:tenantPresent,authenticated:Boolean(user),runtimeRole:String(process.env.SBC_RUNTIME_ROLE||process.env.ROLE_ENV||\"unset\").slice(0,24),writerLeaseReady:typeof sbcWriterLeaseReady===\"undefined\"?null:Boolean(sbcWriterLeaseReady),recoveryRequired:typeof MYSQL_RECOVERY_REQUIRED===\"undefined\"?null:Boolean(MYSQL_RECOVERY_REQUIRED)}));});}',
   '  next();',
   '});'
  ].join('\n');
  server=server.slice(0,appMatch.index)+middleware+server.slice(appMatch.index+appMatch[0].length);
 }
 if(!server.includes('SBC_V6569_SESSION_ERROR_DETAIL')){
  const old="if(e?.code==='SESSION_STORE_UNAVAILABLE'){res.setHeader('Retry-After',String(Math.max(1,Number(e.retryAfterSeconds||1))));return res.status(503).json({error:'Session validation temporarily unavailable.',code:'SESSION_STORE_UNAVAILABLE',retryable:true,retryAfterSeconds:Math.max(1,Number(e.retryAfterSeconds||1)),requestId:req.requestId||null});}";
  const neu=[
   "// SBC_V6569_SESSION_ERROR_DETAIL: log bounded diagnostics without credential material.",
   "if(e?.code==='SESSION_STORE_UNAVAILABLE'){",
   "  const stack=String(e.stack||'').split('\\n').slice(0,5).join(' | ').replace(/(password|token|secret|authorization)\\s*[:=]\\s*[^ ,;|]+/ig,'$1=[REDACTED]').slice(0,900);",
   "  console.error('[SBC_V6569_GROWTH_503_SENTRY] session_store_unavailable',JSON.stringify({at:new Date().toISOString(),path:String(req.path||req.url||'').split('?')[0].slice(0,160),requestId:String(req.requestId||'').slice(0,96)||null,errorCode:String(e.code),errorMessage:String(e.message||'').slice(0,180),stack,tenantContextPresent:Boolean(req.tenantId||req.tenant_id||req.context?.tenantId||req.auth?.tenantId),runtimeRole:String(process.env.SBC_RUNTIME_ROLE||process.env.ROLE_ENV||'unset').slice(0,24)}));",
   "  res.setHeader('Retry-After',String(Math.max(1,Number(e.retryAfterSeconds||1))));",
   "  return res.status(503).json({error:'Session validation temporarily unavailable.',code:'SESSION_STORE_UNAVAILABLE',retryable:true,retryAfterSeconds:Math.max(1,Number(e.retryAfterSeconds||1)),requestId:req.requestId||null});",
   "}"
  ].join('\n');
  server=once(server,old,neu,'session store 503 response');
 }
 write(root,'server.js',server);
 pkg.version=TO;
 pkg.description='SBC OS V65.1.68 adds bounded, redacted Growth Status 503 diagnostics while preserving session validation, tenant isolation, recovery gates, and writer-lease safeguards.';
 pkg.scripts=pkg.scripts||{};
 pkg.scripts['test:v6569-growth-503-sentry']='node hotfix-assets/v6569-growth-503-sentry-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6569-growth-503-sentry-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6569-growth-503-sentry-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 const dir=path.join(root,'hotfix-assets');fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(__filename,path.join(dir,'apply-v6569-growth-503-sentry.js'));
 fs.copyFileSync(path.join(__dirname,'v6569-growth-503-sentry-test.js'),path.join(dir,'v6569-growth-503-sentry-test.js'));
 return {version:TO,routeScoped5xxTelemetry:true,sessionStoreStackLogged:true,credentialsAndBodiesExcluded:true,guardsChanged:false};
}
module.exports={apply,MARKER,FROM,TO};
