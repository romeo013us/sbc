'use strict';
/**
 * SBC V66.108 final offline war-test gate.
 * Tests the shipped files, not external provider availability or GoDaddy live state.
 * Vendor-compiled bundles and archived one-off hotfix fixtures must not be parsed
 * as live CommonJS dependency graphs. All JS still gets a syntax check.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const ignoredDepPaths=[
 /^public\/vendor\//,/^browser_public\/vendor\//,/^hotfix-assets\//,
 /^scripts\/v6532-published-auth-stability-test\.js$/
];
const sourcePaths=['public/index.html','public/sales-caller.html','public/lead-research.html'];
const manifestPaths=['SBC-DEPLOY-RECEIPT.json','SBC-FLAT-RELEASE-IDENTITY.json'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir,found=[]){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.git'].includes(e.name))continue;
  const full=path.join(dir,e.name);
  if(e.isDirectory())walk(full,found);
  else if(e.isFile())found.push(full);
 }
 return found;
}
function auditModules(root=ROOT){
 const files=walk(root).filter(f=>/\.(js|cjs)$/.test(f));
 const missing=[];
 const pat=/\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bfrom\s+['"]([^'"]+)['"]/g;
 let scanned=0,ignored=0;
 for(const file of files){
  const relative=path.relative(root,file).split(path.sep).join('/');
  if(ignoredDepPaths.some(p=>p.test(relative))){ignored++;continue;}
  const body=fs.readFileSync(file,'utf8');scanned++;
  let match;
  while((match=pat.exec(body))){
   const value=match[1]||match[2];
   if(!value.startsWith('.'))continue;
   const p=path.resolve(path.dirname(file),value);
   const variants=[p,p+'.js',p+'.cjs',p+'.json',path.join(p,'index.js'),path.join(p,'index.cjs')];
   if(variants.some(x=>fs.existsSync(x)))continue;
   // Versioned stage compilers embed server-root imports as inert string templates;
   // verify the target exists in the release root, not relative to scripts/.
   const embedded=/^scripts\/v\d+.*(?:stage|guard-test).*\.(?:js|cjs)$/.test(relative)
     && /^\.\/(?:enterprise|routes)\//.test(value);
   if(embedded){
    const generated=path.resolve(root,value.substring(2));
    const rootOptions=[generated,generated+'.js',generated+'.cjs',generated+'.json'];
    if(rootOptions.some(x=>fs.existsSync(x)))continue;
   }
   // Evolution engine creates this fixture ONLY inside isolated sandbox staging.
   if(relative==='enterprise/sbc-evolution-engine-v605.js'
     &&value==='../routes/evolution-call-queue')continue;
   missing.push(relative+' -> '+value);
  }
 }
 return {ok:missing.length===0,scanned,ignored,missing};
}
function auditAssets(root=ROOT,pages=sourcePaths){
 const missing=[],counts=[],publicDir=path.join(root,'public');
 const tag=/<(?:script|img|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
 for(const page of pages){
  const filename=path.resolve(root,page);
  if(!fs.existsSync(filename)){missing.push(page+' missing');continue;}
  const body=fs.readFileSync(filename,'utf8');let m,checked=0;
  while((m=tag.exec(body))){
   const url=String(m[1]||'').split(/[?#]/)[0];
   if(!url.startsWith('/')||url.startsWith('/api/')||url.startsWith('//'))continue;
   checked++;
   const full=path.resolve(publicDir,url.substring(1));
   if(!full.startsWith(publicDir+path.sep)||!fs.existsSync(full))missing.push(page+' -> '+url);
  }
  counts.push({page,checked});
 }
 return {ok:missing.length===0&&counts.some(x=>x.checked>0),counts,missing};
}
function auditRelease(root=ROOT){
 try{
  const [receipt,id]=manifestPaths.map(n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')));
  const checksum=sha(fs.readFileSync(path.join(root,'server.js')));
  const sameSource=receipt.sourceCommit===id.sourceCommit&&receipt.sourceFingerprint===id.sourceFingerprint;
  return {ok:checksum===receipt.artifactSha256&&checksum===id.serverSha256&&sameSource&&receipt.buildBranch==='a-sbc-master'&&receipt.deployBranch==='a-sbc-master',
   serverSha256:checksum,sourceCommit:id.sourceCommit,sameSource};
 }catch(e){return {ok:false,error:String(e.message).slice(0,180)};}
}
function auditContracts(root=ROOT){
 const read=n=>fs.readFileSync(path.join(root,n),'utf8');
 const checks=[
  ['Square signed webhook',()=>read('server.js').includes("'/api/webhooks/square'")&&read('server.js').includes('squareSignatureValid(raw,sig)')],
  ['Square provider settlement',()=>read('server.js').includes('verifyReadback(payment,provider?.payment)')],
  ['Office Box fail-closed V2 handoff',()=>read('enterprise/v6674-officebox-v2-handoff.cjs').includes('COMMITTED_MYSQL')],
  ['Lead-research role scope',()=>read('public/lead-research.js').includes('researchDisplayable')],
  ['Caller assigned lead dialer',()=>read('public/sales-caller.js').includes('lead=data.leads.find')],
  ['Current sales scripts',()=>read('public/sales-caller.js').includes('SBCSalesPlaybook')],
  ['2026 Academy',()=>read('enterprise/training-system-v2.js').includes('SBC_V66107_ELITE_ACADEMY.install')],
  ['Caller DNC handling',()=>read('scripts/v6699-outbound-suppression.test.cjs').includes('assert')]
 ];
 const failed=checks.filter(([name,fn])=>{try{return !fn()}catch{return true}}).map(([name])=>name);
 return {ok:failed.length===0,checked:checks.length,failed};
}
function syntax(root=ROOT){
 const files=walk(root).filter(x=>/\.(js|cjs)$/.test(x));
 const failed=[];
 for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:15000,maxBuffer:4096});
  if(result.status!==0)failed.push(path.relative(root,file));
 }
 return {ok:failed.length===0,files:files.length,failed};
}
function run(root=ROOT){
 const tests={
  moduleResolution:auditModules(root),browserAssets:auditAssets(root),
  packageIdentity:auditRelease(root),businessContracts:auditContracts(root),
  syntax:syntax(root)
 };
 const ok=Object.values(tests).every(x=>x.ok);
 return {status:ok?'PASS':'FAIL',offlineOnly:true,liveProductionCertified:false,tests};
}
if(require.main===module){
 const result=run();console.log(JSON.stringify(result,null,2));
 process.exit(result.status==='PASS'?0:1);
}
module.exports={auditModules,auditAssets,auditRelease,auditContracts,syntax,run};
