'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6548_LEAD_IMPORT_CACHE_CONTRACT',FROM='65.1.46',TO='65.1.47';
function once(s,a,b,l){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+l+' anchor count '+n);return s.replace(a,b);}
function read(r,p){const f=path.join(r,p);if(!fs.existsSync(f))throw Error(MARKER+': missing '+p);return fs.readFileSync(f,'utf8');}
function write(r,p,s){fs.writeFileSync(path.join(r,p),s);}
function apply(root){
 const uiPath='public/sbc-lead-import-v6541.js';
 let ui=read(root,uiPath);
 if(!ui.includes("request({mode:'import',dryRun:false,rows})")||!ui.includes('result.dryRun!==false'))throw Error(MARKER+': strict commit-confirmation contract missing; refusing to mask an old importer.');
 let html=read(root,'public/index.html');
 html=once(html,'/sbc-lead-import-v6541.js?v=65.1.43-import-contract','/sbc-lead-import-v6541.js?v=65.1.47-import-contract','lead-import script cache bust');
 html=html.replace(/V65\.1\.46/g,'V65.1.47').replace(/65\.1\.46/g,'65.1.47');
 write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');const cache=sw.match(/const CACHE=['"][^'"]+['"]/);
 if(!cache)throw Error(MARKER+': service worker cache key missing');
 write(root,'public/sw.js',sw.replace(cache[0],"const CACHE='sbc-static-v65-1-47-import-contract'"));
 const pkg=JSON.parse(read(root,'package.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw Error(MARKER+': expected package '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.47 invalidates stale lead-import assets and requires explicit commit confirmation';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6548-import-cache-fix']='node hotfix-assets/v6548-lead-import-cache-contract-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6548-lead-import-cache-contract-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6548-lead-import-cache-contract-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));
 if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': lockfile root identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let id=read(root,'config/release-identity.js');
 id=once(id,"const RELEASE_VERSION = '65.1.46';","const RELEASE_VERSION = '65.1.47';",'release version');
 id=once(id,"const RELEASE_NAME = 'TENANT_PROPAGATION';","const RELEASE_NAME = 'LEAD_IMPORT_CACHE_CONTRACT';",'release name');
 id=once(id,'major:65,minor:1,patch:46','major:65,minor:1,patch:47','semantic version');write(root,'config/release-identity.js',id);
 const browserPath='browser_public/app.js';let browser=read(root,browserPath);
 if(!browser.includes('65.1.46'))throw Error(MARKER+': browser release identity anchor missing');
 write(root,browserPath,browser.replace(/65\.1\.46/g,'65.1.47'));
 const versionPath=path.join(root,'VERSION');if(fs.existsSync(versionPath))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.46/g,'65.1.47'));
 const dir=path.join(root,'hotfix-assets');fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(__filename,path.join(dir,'apply-v6548-lead-import-cache-contract.js'));
 const testSource=path.join(__dirname,'v6548-lead-import-cache-contract-test.js');
 if(fs.existsSync(testSource))fs.copyFileSync(testSource,path.join(dir,'v6548-lead-import-cache-contract-test.js'));
 return {marker:MARKER,version:TO,explicitCommitContractPreserved:true,leadImportAssetCacheBusted:true,serviceWorkerCacheBusted:true,tenantAndRecoveryGatesPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
