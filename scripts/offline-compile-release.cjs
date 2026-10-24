'use strict';
// SBC fail-closed full patch reconstruction: requires external Docker containment.
// Run with /work/repo mounted read-only, /work/target and /work/reports writable,
// --network none, --cap-drop ALL, no host secrets, NODE_OPTIONS child guard.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),vm=require('node:vm');
if(process.env.SBC_COMPILER_SANDBOX_CONFIRMED!=='1')throw Error('REFUSE: missing isolation sentinel');
const repo=path.resolve(process.env.SBC_COMPILER_REPO||'/work/repo');
const target=path.resolve(process.env.SBC_COMPILER_TARGET||'/work/target');
const reports=path.resolve(process.env.SBC_COMPILER_REPORTS||'/work/reports');
if(repo===target||target.startsWith(repo+path.sep))throw Error('REFUSE: target overlaps source');
for(const p of [repo+'/bootstrap.js',repo+'/SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip',target+'/server.js'])
 if(!fs.existsSync(p))throw Error('REFUSE: missing '+p);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASE=repo+'/SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip';
const EXPECTED_BASE='a3241c86ab59c9242f06552ed8055b67b08daab006f96027f1cc43ed600ec159';
if(hash(BASE)!==EXPECTED_BASE)throw Error('REFUSE: baseline SHA-256 mismatch');
const launcher=fs.readFileSync(repo+'/bootstrap.js','utf8');
const start=launcher.indexOf('function launch()');
const end=launcher.indexOf('\ntry {\n  if (process.argv.includes',start);
if(start<0||end<0)throw Error('REFUSE: launcher boundary unexpected');
const matches=[...launcher.slice(start,end).matchAll(/require\(path\.join\(__dirname, 'hotfix-assets', '([^']+)'\)\)\.apply\(runtimeDir\)/g)];
if(matches.length!==58)throw Error('REFUSE: unexpected patch count '+matches.length);
const patches=['apply-v65116-hotfix.js',...matches.map(m=>'hotfix-assets/'+m[1])];
for(const rel of patches)if(rel.includes('..')||path.isAbsolute(rel)||!fs.existsSync(path.join(repo,rel)))throw Error('REFUSE: bad patch '+rel);
fs.mkdirSync(reports,{recursive:true});
const outFile=path.join(reports,'offline-compile-manifest.json');
const result={status:'INCOMPLETE',kind:'genuine-source-patch-execution',source_commit:'bf6bd505e65bb6920ea5b2b80aff3040ae69060a',source_zip_sha256:hash(BASE),patch_count:patches.length,steps:[],subprocesses:[],files:[]};
const realSpawnSync=cp.spawnSync;
const allowed=(file,args,options)=>{
 if(file!==process.execPath||!Array.isArray(args)||!args.length)return false;
 if(args[0]==='--check')return args.length===2&&args[1].startsWith(target+'/');
 if(typeof args[0]!=='string'||!args[0].startsWith(target+'/'))return false;
 if(args.some(v=>String(v).startsWith('/')&&!String(v).startsWith(target+'/')))return false;
 if(options?.cwd&&!path.resolve(options.cwd).startsWith(target))return false;
 return true;
};
cp.spawnSync=(file,args,options)=>{
 if(!allowed(file,args,options))throw Error('FAIL_CLOSED_SUBPROCESS '+String(file)+' '+JSON.stringify(args));
 const ret=realSpawnSync.call(cp,file,args,options);
 const rec={args,status:ret.status,signal:ret.signal,error:String(ret.error?.message||''),stderr:String(ret.stderr||'').slice(-300)};
 result.subprocesses.push(rec);
 if(ret.error||ret.status!==0)throw Error('FAIL_CLOSED_CHILD_FAILED '+JSON.stringify(rec));
 return ret;
};
for(const name of ['spawn','fork','exec','execSync','execFile','execFileSync'])cp[name]=()=>{throw Error('FAIL_CLOSED_SUBPROCESS '+name)};
function save(){
 try{
  const files=[];
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,entry.name);
   if(entry.isDirectory())walk(p);
   else if(entry.isFile())files.push({path:path.relative(target,p),sha256:hash(p),bytes:fs.statSync(p).size});
   else throw Error('Non-regular file in output '+p);
  }}
  walk(target);result.files=files.sort((a,b)=>a.path.localeCompare(b.path));
  const lines=fs.readFileSync(target+'/server.js','utf8').split(/\r?\n/);
  const at=token=>lines.flatMap((source,i)=>source.includes(token)?[{line:i+1,source:source.trim().slice(0,280)}]:[]);
  result.http_listen=at('sbcHttpServer.listen(');
  result.mysql_init=at('initMysql().then(');
  result.server_sha256=hash(target+'/server.js');
  result.package_version=JSON.parse(fs.readFileSync(target+'/package.json','utf8')).version;
  const sdk=target+'/public/vendor/sbc-twilio-voice-sdk-2.18.5.min.js';
  result.sdk_bundle_sha256=fs.existsSync(sdk)?hash(sdk):null;
 }catch(e){result.manifest_error=String(e.stack||e)}
 fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
}
try{
 for(const [i,rel] of patches.entries()){
  console.log('APPLY',i+1,'/',patches.length,rel);
  const mod=require(path.join(repo,rel));
  if(typeof mod.apply!=='function')throw Error('PATCH_EXPORT_INVALID '+rel);
  const value=mod.apply(target);
  result.steps.push({number:i+1,patch:rel,marker:value?.marker||null,status:'PASSED'});
 }
 new vm.Script(fs.readFileSync(target+'/server.js','utf8'),{filename:'server.js'});
 result.status='PASSED_PATCH_AND_SYNTAX_ONLY';
 save();
 if(result.manifest_error||result.http_listen?.length!==1||result.mysql_init?.length!==1||result.http_listen[0].line>=result.mysql_init[0].line){
  result.status='FAILED_FAST_LANE_VALIDATION';save();process.exitCode=3;
 }
}catch(e){
 result.status='FAILED_CLOSED';
 result.failure={at:result.steps.length+1,patch:patches[result.steps.length],error:String(e.stack||e)};
 save();console.error(result.failure.error);process.exitCode=2;
}
console.log('COMPILER_STATUS',result.status,result.steps.length+'/'+patches.length);
