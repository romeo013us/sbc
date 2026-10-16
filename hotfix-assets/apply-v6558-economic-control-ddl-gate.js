'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6558_ECONOMIC_CONTROL_DDL_GATE',FROM='65.1.57',TO='65.1.58';
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8')}
function write(root,rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
function gateEnsureTables(source){
 if(source.includes(MARKER)){if(!source.includes('global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED()'))throw Error(MARKER+': marker exists but ensureTables guard is missing');return {source,alreadyApplied:true}}
 const opener=/(?:async\s+ensureTables\s*\([^)]*\)\s*\{|ensureTables\s*:\s*async\s*(?:function\s*)?\([^)]*\)\s*=>\s*\{|ensureTables\s*=\s*async\s*\([^)]*\)\s*=>\s*\{|ensureTables\s*\([^)]*\)\s*\{)/g;
 const matches=[...source.matchAll(opener)];
 if(matches.length!==1)throw Error(MARKER+': expected exactly one Economic Control ensureTables function; found '+matches.length);
 const m=matches[0],at=m.index+m[0].length;
 const guard="\n    if (typeof global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED === 'function' && !global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED()) return false; // "+MARKER+"\n";
 return {source:source.slice(0,at)+guard+source.slice(at),alreadyApplied:false};
}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json')),lock=JSON.parse(read(root,'package-lock.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': expected package/lock identity '+FROM);
 let server=read(root,'server.js');
 if(!server.includes(MARKER)){
  const gate=[
   'global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED = function(){',
   "  return SBC_RUNTIME_ROLE === 'writer' && SBC_RUNTIME_READ_ONLY === false &&",
   "    SBC_DDL_ENABLED === true && String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true' &&",
   '    MYSQL_RECOVERY_EVALUATED === true && MYSQL_RECOVERY_REQUIRED !== true && sbcWriterLeaseReady === true;',
   '}; // '+MARKER,''
  ].join('\n');
  server=once(server,'async function initMysql(){',gate+'async function initMysql(){','install runtime-aware schema gate');
 }else if(!server.includes('SBC_DDL_ENABLED === true')||!server.includes('MYSQL_RECOVERY_REQUIRED !== true')||!server.includes('sbcWriterLeaseReady === true'))throw Error(MARKER+': server schema gate is incomplete');
 write(root,'server.js',server);
 const econ='enterprise/v56220-economic-control.js';
 write(root,econ,gateEnsureTables(read(root,econ)).source);
 pkg.version=TO;pkg.description='SBC OS V65.1.58 gates recurring Economic Control schema initialization to the verified Published writer runtime';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6558-economic-control-ddl-gate']='node hotfix-assets/v6558-economic-control-ddl-gate-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6558-economic-control-ddl-gate-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6558-economic-control-ddl-gate-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;if(lock.packages[''].scripts)lock.packages[''].scripts=pkg.scripts;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');
 identity=once(identity,"const RELEASE_VERSION = '65.1.57';","const RELEASE_VERSION = '65.1.58';",'runtime release version');
 identity=once(identity,"const RELEASE_NAME = 'OWNER_FORCE_UNLOCK_AND_OPERATIONAL_GATES';","const RELEASE_NAME = 'ECONOMIC_CONTROL_DDL_GATE';",'runtime release name');
 identity=once(identity,'major:65,minor:1,patch:57','major:65,minor:1,patch:58','runtime semantic version');write(root,'config/release-identity.js',identity);
 for(const rel of ['public/index.html','browser_public/index.html'])if(fs.existsSync(path.join(root,rel))){let s=read(root,rel).replace(/65\.1\.57/g,'65.1.58');if(!s.includes(MARKER))s=s.replace('</head>','<!-- '+MARKER+' -->\n</head>');write(root,rel,s)}
 for(const rel of ['public/app.js','browser_public/app.js'])if(fs.existsSync(path.join(root,rel)))write(root,rel,read(root,rel).replace(/65\.1\.57-owner-force-unlock/g,'65.1.58-economic-control-ddl-gate'));
 for(const rel of ['public/sw.js','browser_public/sw.js'])if(fs.existsSync(path.join(root,rel))){let s=read(root,rel);if(!/const CACHE=['"][^'"]+['"]/.test(s))throw Error(MARKER+': service worker cache key missing in '+rel);s=s.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-58-economic-control-ddl-gate'");if(!s.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)"))throw Error(MARKER+': service worker cache purge guard missing in '+rel);write(root,rel,s)}
 const test=path.join(__dirname,'v6558-economic-control-ddl-gate-test.js');if(!fs.existsSync(test))throw Error(MARKER+': regression test source missing');
 const target=path.join(root,'hotfix-assets','v6558-economic-control-ddl-gate-test.js');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(test,target);fs.copyFileSync(__filename,path.join(root,'hotfix-assets','apply-v6558-economic-control-ddl-gate.js'));
 const version=path.join(root,'VERSION');if(fs.existsSync(version))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.57/g,'65.1.58'));
 return {marker:MARKER,version:TO,recurringEconomicControlSchemaGated:true,requiresPublishedWriter:true,requiresExplicitDdl:true,recoveryAndWriterLeaseGuardsPreserved:true};
}
module.exports={apply,MARKER,FROM,TO,gateEnsureTables};
