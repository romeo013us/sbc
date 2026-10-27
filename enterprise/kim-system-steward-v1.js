'use strict';
/**
 * Kim System Steward V1
 *
 * Purpose: give Kim a real engineering control plane instead of a read-only
 * diagnostic persona. Kim can inspect, snapshot, edit, validate, verify and
 * roll back approved SBC application surfaces. Protected security, secret,
 * pricing, payment and destructive boundaries remain outside autonomous scope.
 */
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const VERSION='1.0.0';
const MAX_HISTORY=500;
const TEXT_EXT=new Set(['.js','.cjs','.mjs','.json','.css','.html','.htm','.md','.txt','.sql','.xml','.yml','.yaml','.webmanifest']);
const PROTECTED_PATHS=[
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /(^|\/)node_modules(?:\/|$)/i,
  /(^|\/)runtime-spool(?:\/|$)/i,
  /(^|\/)data(?:\/|$)/i
];
const SECRET_NAMES=['OPEN'+'AI_API_KEY','SBC_'+'ADMIN_PASSWORD','TWILIO_'+'AUTH_TOKEN','TWILIO_'+'API_KEY_SECRET','SQUARE_'+'ACCESS_TOKEN','GODADDY_'+'PAT'];
const SECRET_PATTERNS=[
  new RegExp('(?:'+SECRET_NAMES.join('|')+')\\s*[:=]\\s*[\"\'][^\"\']{12,}[\"\']','i'),
  new RegExp('-----BEGIN [A-Z ]*PRIVATE KEY-----','i'),
];
const PROTECTED_CHANGE_PATTERNS=[
  /paymentStatus\s*=\s*["'](?:Paid|Completed|Captured)/i,
  /owner-mark-paid|owner-mark-paid/i,
  /refund/i,
  /change_owner_credentials|change_owner_security/i,
  /permanent_delete|delete_production|destroy_production_data/i
];
const PRICE_LINE=/\b(?:price|unitPrice|requestedPrice|discount|taxRate)\s*[:=]/i;
const now=()=>new Date().toISOString();
const id=(p='ks')=>`${p}_${crypto.randomBytes(9).toString('hex')}`;
const sha=v=>crypto.createHash('sha256').update(Buffer.isBuffer(v)?v:String(v??''),'utf8').digest('hex');

function normalizeRel(rel){
  const clean=String(rel||'').replace(/\\/g,'/').replace(/^\/+/,'').trim();
  if(!clean||clean.includes('..')||clean.startsWith('/'))throw new Error('Invalid project path.');
  if(PROTECTED_PATHS.some(r=>r.test(clean)))throw new Error(`Protected path: ${clean}`);
  return clean;
}
function abs(root,rel){return path.join(root,normalizeRel(rel));}
function walk(root,dir=root,out=[]){
  if(out.length>=2500)return out;
  let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return out;}
  for(const e of entries){
    if(['node_modules','.git','runtime-spool','kim-recovery','.DS_Store'].includes(e.name))continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())walk(root,p,out);
    else if(TEXT_EXT.has(path.extname(e.name).toLowerCase()))out.push(path.relative(root,p).replace(/\\/g,'/'));
    if(out.length>=2500)break;
  }
  return out;
}
function fileSummary(root,rel){
  const file=abs(root,rel);const st=fs.statSync(file);return {file:rel,size:st.size,modifiedAt:st.mtime.toISOString(),sha256:sha(fs.readFileSync(file))};
}
function scan(root){
  const files=walk(root),findings=[];
  for(const rel of files){
    let text='';try{text=fs.readFileSync(abs(root,rel),'utf8')}catch{continue;}
    if(SECRET_PATTERNS.some(r=>r.test(text)))findings.push({severity:'CRITICAL',type:'secret-pattern',file:rel,message:'Potential credential/secret material detected. Value is never returned.'});
    if(rel.endsWith('.js')){
      const r=spawnSync(process.execPath,['--check'],{input:text,encoding:'utf8'});
      if(r.status!==0)findings.push({severity:'HIGH',type:'syntax',file:rel,message:String(r.stderr||r.stdout||'Syntax check failed.').slice(0,500)});
    }
  }
  return {version:VERSION,scannedAt:now(),fileCount:files.length,findings,healthy:findings.every(x=>x.severity!=='CRITICAL'&&x.severity!=='HIGH')};
}
function loadState(root){const dir=path.join(root,'runtime-state','kim-steward');fs.mkdirSync(dir,{recursive:true,mode:0o700});const f=path.join(dir,'state.json');try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return {version:VERSION,history:[],snapshots:[],lastScan:null};}}
function saveState(root,s){const dir=path.join(root,'runtime-state','kim-steward');fs.mkdirSync(dir,{recursive:true,mode:0o700});const f=path.join(dir,'state.json'),tmp=`${f}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(s,null,2),{mode:0o600});fs.renameSync(tmp,f);}
function record(root,row){const s=loadState(root);s.history.unshift(row);s.history=s.history.slice(0,MAX_HISTORY);saveState(root,s);return row;}
function snapshot(root,reason='Kim system steward change'){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');const dir=path.join(root,'runtime-state','kim-steward','snapshots',stamp);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const files=walk(root).filter(rel=>!rel.startsWith('runtime-state/'));
  const manifest=[];
  for(const rel of files){const src=abs(root,rel);const dst=path.join(dir,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});try{fs.copyFileSync(src,dst);manifest.push(fileSummary(root,rel))}catch{}}
  const meta={snapshotId:stamp,createdAt:now(),reason,appVersion:process.env.npm_package_version||'',fileCount:manifest.length,files:manifest};
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(meta,null,2),{mode:0o600});
  const s=loadState(root);s.snapshots.unshift({snapshotId:stamp,createdAt:meta.createdAt,reason,fileCount:manifest.length,path:dir});s.snapshots=s.snapshots.slice(0,30);saveState(root,s);return meta;
}
function protectedChange(rel,before,after,explicitOwner=false){
  const text=String(after||'');
  if(SECRET_PATTERNS.some(r=>r.test(text)))return 'Potential secret/credential material is blocked.';
  if(PROTECTED_CHANGE_PATTERNS.some(r=>r.test(text)&&!r.test(String(before||''))))return 'Protected payment/refund/destructive control change is blocked from autonomous editing.';
  if((rel.includes('catalog')||rel.includes('price'))&&!explicitOwner)return 'Catalog/pricing files are owner-protected.';
  if(rel==='server.js'){
    const beforePrices=String(before||'').split(/\r?\n/).filter(x=>PRICE_LINE.test(x));
    const afterPrices=text.split(/\r?\n/).filter(x=>PRICE_LINE.test(x));
    if(beforePrices.join('\n')!==afterPrices.join('\n')&&!explicitOwner)return 'Pricing/tax/discount definitions are owner-protected.';
  }
  return null;
}
function validate(root,rel,content){
  const ext=path.extname(rel).toLowerCase();
  if(ext==='.json'||ext==='.webmanifest'){try{JSON.parse(content)}catch(e){return {ok:false,error:e.message}}}
  if(['.js','.cjs','.mjs'].includes(ext)){const r=spawnSync(process.execPath,['--check'],{input:content,encoding:'utf8'});if(r.status!==0)return {ok:false,error:String(r.stderr||r.stdout||'JavaScript syntax validation failed.').slice(0,1800)}}
  return {ok:true};
}
function apply(root,rel,content,{reason='Kim system steward repair',ownerApproved=false}={}){
  const clean=normalizeRel(rel),file=abs(root,clean),text=String(content??'');if(!text.trim())throw new Error('Repair content is empty.');
  const before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const block=protectedChange(clean,before,text,ownerApproved);if(block)throw new Error(block);
  const validation=validate(root,clean,text);if(!validation.ok)throw new Error(validation.error);
  const snap=snapshot(root,reason);
  fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.kim-steward.tmp`;fs.writeFileSync(tmp,text,{encoding:'utf8',mode:0o644});fs.renameSync(tmp,file);
  const row={id:id('repair'),at:now(),file:clean,reason,snapshotId:snap.snapshotId,beforeSha256:sha(before),afterSha256:sha(text),validated:true,ownerApproved:Boolean(ownerApproved)};record(root,row);return {ok:true,repair:row,snapshot:snap};
}
function rollback(root,snapshotId,reason='Kim steward rollback'){
  const s=loadState(root),snap=s.snapshots.find(x=>x.snapshotId===String(snapshotId));if(!snap)throw new Error('Snapshot not found.');
  const manifest=JSON.parse(fs.readFileSync(path.join(snap.path,'manifest.json'),'utf8'));let restored=0;
  for(const f of manifest.files||[]){const src=path.join(snap.path,f.file),dst=abs(root,f.file);if(!fs.existsSync(src))continue;fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);restored++;}
  record(root,{id:id('rollback'),at:now(),snapshotId:snapshotId,reason,restored});return {ok:true,snapshotId,restored,reason};
}
function verify(root){
  const scanResult=scan(root);const packageFile=path.join(root,'package.json');let packageOk=true;try{JSON.parse(fs.readFileSync(packageFile,'utf8'))}catch{packageOk=false}
  return {ok:scanResult.healthy&&packageOk,scan:scanResult,packageJson:packageOk,verifiedAt:now()};
}
function inspect(root){const s=loadState(root),scanResult=scan(root);return {ok:true,version:VERSION,mode:'AUTONOMOUS_STEWARD',capabilities:['read','diagnose','snapshot','edit','validate','verify','rollback','document'],protectedBoundaries:['credentials','secrets','pricing','catalog','refunds','payment-status overrides','owner security','permanent deletion','irreversible database operations'],scan:scanResult,recentRepairs:s.history.slice(0,20),snapshots:s.snapshots.slice(0,10),updatedAt:now()};}
module.exports={VERSION,normalizeRel,scan,inspect,snapshot,apply,rollback,verify,loadState};
