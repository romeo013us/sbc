/**
 * SBC SYSTEM GUARDIAN V1 — V56.4
 * Defensive overlay for a large legacy/modern hybrid codebase.
 *
 * Design rules:
 *  - NEVER auto-delete production code.
 *  - Audit -> classify -> impact-check -> quarantine -> regression -> approve.
 *  - Hash protected/important files so silent mutation is detectable.
 *  - Build lightweight import/asset/route dependency maps.
 *  - Keep rollback manifests separate from application runtime state.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_IGNORES = new Set([
  'node_modules', '.git', 'quarantine', '.guardian', 'coverage', 'tmp', 'logs'
]);
const DEFAULT_EXTENSIONS = new Set(['.js','.mjs','.cjs','.json','.css','.html','.htm','.sql','.sh']);

function sha256Buffer(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function sha256File(file){ return sha256Buffer(fs.readFileSync(file)); }
function safeRead(file){ try{return fs.readFileSync(file,'utf8');}catch{return '';} }
function rel(root,file){ return path.relative(root,file).split(path.sep).join('/'); }
function isWithin(root,target){ const r=path.resolve(root), t=path.resolve(target); return t===r || t.startsWith(r+path.sep); }
function now(){ return new Date().toISOString(); }

function walk(root, {ignore=DEFAULT_IGNORES, extensions=DEFAULT_EXTENSIONS}={}){
  const out=[];
  function visit(dir){
    let entries=[]; try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
    for(const e of entries){
      if(ignore.has(e.name)) continue;
      const full=path.join(dir,e.name);
      if(e.isDirectory()) visit(full);
      else if(e.isFile() && extensions.has(path.extname(e.name).toLowerCase())) out.push(full);
    }
  }
  visit(root); return out.sort();
}

function protectedPatterns(config={}){
  return Array.isArray(config.protected) ? config.protected : [
    'server.js','package.json','package-lock.json','enterprise/*','config/*',
    'workers/*','scripts/*release*','scripts/*security*','scripts/*secret*'
  ];
}
function minimatchSimple(file,pattern){
  const f=file.replace(/\\/g,'/'); const p=String(pattern).replace(/\\/g,'/');
  if(p.endsWith('/*')) return f.startsWith(p.slice(0,-1));
  if(p.includes('*')){ const re=new RegExp('^'+p.split('*').map(x=>x.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')).join('.*')+'$'); return re.test(f); }
  return f===p;
}
function isProtected(relative,patterns){ return patterns.some(p=>minimatchSimple(relative,p)); }

function resolveLocal(root, fromFile, spec){
  if(!spec || !String(spec).startsWith('.')) return null;
  const base=path.resolve(path.dirname(fromFile),spec);
  const candidates=[base, base+'.js',base+'.mjs',base+'.cjs',base+'.json',base+'.css',base+'.html',path.join(base,'index.js')];
  for(const c of candidates){ if(isWithin(root,c) && fs.existsSync(c) && fs.statSync(c).isFile()) return c; }
  return null;
}

function extractImports(root,file,source){
  const refs=[];
  const patterns=[
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for(const re of patterns){ let m; while((m=re.exec(source))){ const target=resolveLocal(root,file,m[1]); if(target) refs.push(rel(root,target)); }}
  return [...new Set(refs)];
}

function extractAssetRefs(root,file,source){
  const refs=[];
  if(/\.html?$/.test(path.extname(file))){
    const re=/(?:src|href)\s*=\s*["']([^"'#?]+)["']/gi; let m;
    while((m=re.exec(source))){
      let p=m[1]; if(!p.startsWith('/')) p='/'+p;
      const target=path.join(root,'public',p.replace(/^\//,''));
      if(isWithin(root,target) && fs.existsSync(target) && fs.statSync(target).isFile()) refs.push(rel(root,target));
    }
  }
  return [...new Set(refs)];
}

function extractApiRefs(source){
  const out=[]; const re=/['"`]((?:\/api\/)[^'"`\s<>]*)['"`]/g; let m;
  while((m=re.exec(source))) out.push(m[1].replace(/\\[?].*$/,''));
  return [...new Set(out)];
}

function extractServerRoutes(source){
  const routes=[]; const re=/\bapp\.(get|post|put|patch|delete|head|options|use)\s*\(\s*['"]([^'"]+)['"]/g; let m;
  while((m=re.exec(source))) routes.push({method:m[1].toUpperCase(),path:m[2]});
  return routes;
}

function classifyFile(meta, protectedList){
  if(meta.protected) return 'PROTECTED';
  if(meta.importedBy>0 || meta.assetReferencedBy>0) return 'ACTIVE';
  if(meta.relative.startsWith('scripts/')) return 'TOOLING';
  if(meta.relative.startsWith('docs/') || meta.relative.startsWith('migrations/')) return 'ARCHIVE_SUPPORT';
  if(meta.dynamicReferenceCount>0) return 'REVIEW';
  const n=meta.relative.toLowerCase();
  if(/(?:legacy|old|deprecated|archive|backup|v\d+[-_.]|demo)/.test(n)) return 'LEGACY';
  if(meta.extension==='.js' || meta.extension==='.mjs' || meta.extension==='.cjs') return 'UNREFERENCED';
  return 'REVIEW';
}

function audit(rootDir, options={}){
  const root=path.resolve(rootDir);
  const files=walk(root,options);
  const protectedList=protectedPatterns(options.config||{});
  const byRel=new Map();
  const metas=new Map();
  for(const file of files){
    const relative=rel(root,file); const source=safeRead(file);
    const meta={
      relative, absolute:file, extension:path.extname(file).toLowerCase(), bytes:Buffer.byteLength(source),
      sha256:sha256File(file), protected:isProtected(relative,protectedList),
      imports:extractImports(root,file,source), assets:extractAssetRefs(root,file,source),
      apiRefs:extractApiRefs(source), importedBy:0, assetReferencedBy:0, dynamicReferenceCount:0,
      routeCount:0
    };
    if(path.basename(file)==='server.js') meta.routeCount=extractServerRoutes(source).length;
    metas.set(relative,meta); byRel.set(relative,meta);
  }
  for(const meta of metas.values()){
    for(const target of meta.imports){ const t=byRel.get(target); if(t) t.importedBy++; }
    for(const target of meta.assets){ const t=byRel.get(target); if(t) t.assetReferencedBy++; }
  }
  const allText=files.map(f=>safeRead(f)).join('\n');
  for(const meta of metas.values()){
    const base=path.basename(meta.relative);
    const escaped=base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const hits=(allText.match(new RegExp(escaped,'g'))||[]).length;
    meta.dynamicReferenceCount=Math.max(0,hits-(meta.importedBy+meta.assetReferencedBy));
    meta.classification=classifyFile(meta,protectedList);
  }
  const server=metas.get('server.js');
  const routes=server?extractServerRoutes(safeRead(server.absolute)):[];
  const routeCounts=new Map(); routes.forEach(r=>{const k=`${r.method} ${r.path}`;routeCounts.set(k,(routeCounts.get(k)||0)+1);});
  const duplicateRoutes=[...routeCounts.entries()].filter(([,n])=>n>1).map(([route,count])=>({route,count}));
  const hashes=new Map(); for(const m of metas.values()){const a=hashes.get(m.sha256)||[];a.push(m.relative);hashes.set(m.sha256,a);}
  const duplicateFiles=[...hashes.entries()].filter(([,a])=>a.length>1).map(([sha256,files])=>({sha256,files}));
  const summary={
    generatedAt:now(),root:root.replace(/\\/g,'/'),version:options.version||'56.4.0',
    filesScanned:metas.size, bytesScanned:[...metas.values()].reduce((n,m)=>n+m.bytes,0),
    classifications:Object.fromEntries([...metas.values()].reduce((m,x)=>m.set(x.classification,(m.get(x.classification)||0)+1),new Map())),
    protectedCount:[...metas.values()].filter(x=>x.protected).length,
    routeCount:routes.length,duplicateRouteCount:duplicateRoutes.length,duplicateFileGroups:duplicateFiles.length
  };
  const candidates=[...metas.values()].filter(x=>['UNREFERENCED','LEGACY','REVIEW'].includes(x.classification)&&!x.protected).map(x=>({file:x.relative,class:x.classification,bytes:x.bytes,sha256:x.sha256,importedBy:x.importedBy,assetReferencedBy:x.assetReferencedBy,dynamicReferenceCount:x.dynamicReferenceCount})).sort((a,b)=>a.class.localeCompare(b.class)||b.bytes-a.bytes);
  return {summary,files:[...metas.values()].map(({absolute,...m})=>m),routes,duplicateRoutes,duplicateFiles,candidates};
}

function createManifest(rootDir,options={}){
  const result=audit(rootDir,options);
  return {schemaVersion:1,kind:'SBC_GUARDIAN_MANIFEST',generatedAt:result.summary.generatedAt,version:options.version||'56.4.0',root:result.summary.root,files:result.files.map(x=>({file:x.relative,sha256:x.sha256,bytes:x.bytes,protected:x.protected})),routes:result.routes,summary:result.summary};
}

function compareManifest(rootDir,manifest,options={}){
  const current=createManifest(rootDir,options); const expected=new Map((manifest?.files||[]).map(x=>[x.file,x]));
  const actual=new Map(current.files.map(x=>[x.file,x])); const added=[],removed=[],changed=[];
  for(const [f,e] of expected){const a=actual.get(f);if(!a)removed.push(f);else if(a.sha256!==e.sha256)changed.push({file:f,before:e.sha256,after:a.sha256});}
  for(const [f] of actual) if(!expected.has(f)) added.push(f);
  return {ok:removed.length===0&&changed.length===0,generatedAt:now(),added,removed,changed,currentSummary:current.summary};
}

function writeSnapshot(rootDir, snapshotDir, options={}){
  const root=path.resolve(rootDir); const dir=path.resolve(snapshotDir); if(!isWithin(root,dir) && !options.allowOutside) throw new Error('Snapshot directory must be inside the project unless allowOutside is explicitly enabled.');
  fs.mkdirSync(dir,{recursive:true});
  const manifest=createManifest(root,options); fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(dir,'README.txt'),`SBC Guardian known-good snapshot\nGenerated: ${manifest.generatedAt}\nVersion: ${manifest.version}\n\nThis snapshot is an integrity manifest, not a live production backup. Keep the release ZIP as the deployable rollback artifact.\n`);
  return manifest;
}

function quarantine(rootDir, relativeFiles, options={}){
  const root=path.resolve(rootDir); const stamp=(options.timestamp||new Date().toISOString()).replace(/[:.]/g,'-');
  const qroot=path.join(root,'quarantine','guardian',stamp); fs.mkdirSync(qroot,{recursive:true});
  const moved=[];
  for(const relative of relativeFiles||[]){
    const src=path.resolve(root,relative); if(!isWithin(root,src)||!fs.existsSync(src)||!fs.statSync(src).isFile()) continue;
    const dest=path.join(qroot,relative); fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(src,dest); moved.push({file:relative,sha256:sha256File(src),quarantinePath:rel(root,dest)});
  }
  fs.writeFileSync(path.join(qroot,'quarantine-manifest.json'),JSON.stringify({schemaVersion:1,createdAt:now(),files:moved},null,2));
  return {quarantineRoot:rel(root,qroot),files:moved};
}

module.exports={walk,audit,createManifest,compareManifest,writeSnapshot,quarantine,sha256File,isProtected,extractServerRoutes};

function registerRoutes(app,{auth,ownerOnly,rootDir,__version='56.4.0'}={}){
  if(!app) throw new Error('Guardian requires an Express app.');
  const root=path.resolve(rootDir||process.cwd());
  let cache={at:0,data:null};
  const cfgPath=path.join(root,'config','guardian-protected.json');
  function config(){try{return JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{return {policy:'NEVER_AUTO_DELETE',protected:[]};}}
  function getAudit(){
    const ttl=15000; if(cache.data && Date.now()-cache.at<ttl) return cache.data;
    cache={at:Date.now(),data:audit(root,{version:__version,config:config()})}; return cache.data;
  }
  app.get('/api/v56/guardian/summary',auth,(req,res)=>{try{const r=getAudit();res.json({ok:true,version:__version,guardian:'V1',summary:r.summary});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56/guardian/audit',auth,ownerOnly,(req,res)=>{try{const r=getAudit();res.json({ok:true,version:__version,guardian:'V1',summary:r.summary,candidates:r.candidates.slice(0,200),duplicateFiles:r.duplicateFiles.slice(0,100),duplicateRoutes:r.duplicateRoutes.slice(0,100)});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56/guardian/impact/:file',auth,ownerOnly,(req,res)=>{try{const wanted=decodeURIComponent(req.params.file);const r=getAudit();const f=r.files.find(x=>x.relative===wanted);if(!f)return res.status(404).json({ok:false,error:'Component not found.'});const dependents=r.files.filter(x=>x.imports.includes(wanted)||x.assets.includes(wanted)).map(x=>x.relative);res.json({ok:true,version:__version,file:f,dependents,routeReferences:r.routes.filter(x=>JSON.stringify(x).includes(wanted))});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56/guardian/snapshot',auth,ownerOnly,(req,res)=>{try{const stamp=new Date().toISOString().replace(/[:.]/g,'-');const dir=path.join(root,'.guardian','snapshots',stamp);const m=writeSnapshot(root,dir,{version:__version,config:config()});res.status(201).json({ok:true,version:__version,snapshot:`.guardian/snapshots/${stamp}`,files:m.files.length,summary:m.summary});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56/guardian/quarantine',auth,ownerOnly,(req,res)=>{try{if(req.body?.confirm!==true)return res.status(400).json({ok:false,error:'Explicit confirm:true is required. Guardian never auto-deletes.'});const files=Array.isArray(req.body?.files)?req.body.files.map(String):[];if(!files.length)return res.status(400).json({ok:false,error:'files[] is required.'});const r=getAudit();const by=new Map(r.files.map(x=>[x.relative,x]));for(const f of files){const m=by.get(f);if(!m)return res.status(404).json({ok:false,error:`Component not found: ${f}`});if(m.protected)return res.status(409).json({ok:false,error:`Protected component: ${f}`});if(m.classification==='ACTIVE')return res.status(409).json({ok:false,error:`Active dependency: ${f}`});}const out=quarantine(root,files);cache={at:0,data:null};res.status(201).json({ok:true,version:__version,...out,note:'Quarantine only. Permanent deletion is intentionally not exposed through the runtime API.'});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.get('/api/v56/guardian/manifest',auth,ownerOnly,(req,res)=>{try{const m=createManifest(root,{version:__version,config:config()});res.json({ok:true,version:__version,manifest:m});}catch(e){res.status(500).json({ok:false,error:e.message});}});
}

module.exports.registerRoutes=registerRoutes;
