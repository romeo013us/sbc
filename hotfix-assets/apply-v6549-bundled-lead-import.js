'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6549_BUNDLED_LEAD_IMPORT',FROM='65.1.47',TO='65.1.48';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8');}
function write(root,rel,s){fs.writeFileSync(path.join(root,rel),s);}
function apply(root){
 const sourceBundle=path.join(__dirname,'sbc-lorna-lead-bundle-169.json');
 if(fs.existsSync(sourceBundle)){
  const parsed=JSON.parse(fs.readFileSync(sourceBundle,'utf8'));
  if(!Array.isArray(parsed.rows)||parsed.rows.length!==169||parsed.rows.some(r=>!String(r.business_name||'').trim()))throw Error(MARKER+': bundled lead data failed validation; expected 169 rows with business names');
  const target=path.join(root,'data','sbc-lorna-lead-bundle-169.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(parsed,null,2)+'\n',{mode:0o600});
 }
 let server=read(root,'server.js');
 const route=String.raw`
// SBC_V6549_BUNDLED_LEAD_IMPORT: owner-authenticated read-only access to the private lead bundle. Actual writes still use the normal tenant/recovery/writer-gated import endpoint.
app.get('/api/crm/leads/import-bundle',auth,ownerOnly,async(req,res)=>{
 try{
  const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'data','sbc-lorna-lead-bundle-169.json');
  if(!fs.existsSync(file))return res.status(404).json({ok:false,error:'No bundled lead file is installed in this build.'});
  const bundle=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(bundle.rows)||bundle.rows.length!==169)return res.status(500).json({ok:false,error:'Bundled lead file failed its row-count check.'});
  res.setHeader('Cache-Control','no-store, private');return res.json({ok:true,total:bundle.rows.length,rows:bundle.rows,source:'SBC private lead bundle'});
 }catch(e){console.error('[SBC_V6549_BUNDLED_LEAD_IMPORT] bundle read failed:',e&&e.message||e);return res.status(500).json({ok:false,error:'Unable to load the private lead bundle.'});}
});
`;
 server=once(server,'const startOperationalRuntime=async()=>{',route+'\nconst startOperationalRuntime=async()=>{','authenticated bundled lead route');
 write(root,'server.js',server);
 let ui=read(root,'public/sbc-lead-import-v6541.js');
 ui=once(ui,'<button type="button" id="sbc-lead-import-preview" class="primary" disabled>Preview import</button>','<button type="button" id="sbc-lead-import-bundle">Load prepared 169 leads</button><button type="button" id="sbc-lead-import-preview" class="primary" disabled>Preview import</button>','bundle loader button');
 const listener=String.raw`byId('sbc-lead-import-bundle').addEventListener('click',async()=>{const bundleBtn=byId('sbc-lead-import-bundle');bundleBtn.disabled=true;previewBtn.disabled=true;commitBtn.disabled=true;setStatus('Loading the private 169-lead bundle…','');try{const response=await fetch('/api/crm/leads/import-bundle',{credentials:'same-origin',headers:{'Accept':'application/json'}});let data;try{data=await response.json();}catch{throw new Error('Bundle endpoint returned non-JSON (HTTP '+response.status+').');}if(!response.ok||data.ok!==true)throw new Error(data.error||('Bundle load failed (HTTP '+response.status+').'));if(!Array.isArray(data.rows)||data.rows.length!==169)throw new Error('Expected exactly 169 bundled leads; received '+(data.rows&&data.rows.length||0)+'.');rows=data.rows;preview=null;fileInput.value='';byId('sbc-lead-import-summary').innerHTML='';byId('sbc-lead-import-tablewrap').hidden=true;previewBtn.disabled=false;setStatus('Loaded '+rows.length+' prepared leads into the importer. Click Preview import, then Import new leads to save them.','ok');}catch(e){setStatus(e.message||'Unable to load bundled leads.','error');}finally{bundleBtn.disabled=false;}});`;
 ui=once(ui,"previewBtn.addEventListener('click',async()=>{",listener+"\npreviewBtn.addEventListener('click',async()=>{",'bundle loader event');
 write(root,'public/sbc-lead-import-v6541.js',ui);
 let html=read(root,'public/index.html');
 html=once(html,'/sbc-lead-import-v6541.js?v=65.1.47-import-contract','/sbc-lead-import-v6541.js?v=65.1.48-bundled-leads','lead importer cache URL');
 html=html.replace(/V65\.1\.47/g,'V65.1.48').replace(/65\.1\.47/g,'65.1.48');write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');const cache=sw.match(/const CACHE=['"][^'"]+['"]/);if(!cache)throw Error(MARKER+': service worker cache key missing');write(root,'public/sw.js',sw.replace(cache[0],"const CACHE='sbc-static-v65-1-48-bundled-leads'"));
 const pkg=JSON.parse(read(root,'package.json'));if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw Error(MARKER+': expected package '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.48 provides a private, owner-authenticated bundled lead loader using the normal guarded import route';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6549-bundled-leads']='node hotfix-assets/v6549-bundled-lead-import-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6549-bundled-lead-import-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6549-bundled-lead-import-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': lockfile root identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');
 identity=once(identity,"const RELEASE_VERSION = '65.1.47';","const RELEASE_VERSION = '65.1.48';",'release version');
 identity=once(identity,"const RELEASE_NAME = 'LEAD_IMPORT_CACHE_CONTRACT';","const RELEASE_NAME = 'BUNDLED_LEAD_IMPORT';",'release name');
 identity=once(identity,'major:65,minor:1,patch:47','major:65,minor:1,patch:48','semantic version');write(root,'config/release-identity.js',identity);
 const browserPath='browser_public/app.js';let browser=read(root,browserPath);
 if(!browser.includes('65.1.47'))throw Error(MARKER+': browser release identity anchor missing');
 write(root,browserPath,browser.replace(/65\.1\.47/g,'65.1.48'));
 const versionPath=path.join(root,'VERSION');if(fs.existsSync(versionPath))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.47/g,'65.1.48'));
 const dir=path.join(root,'hotfix-assets');fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(__filename,path.join(dir,'apply-v6549-bundled-lead-import.js'));
 const testSource=path.join(__dirname,'v6549-bundled-lead-import-test.js');if(fs.existsSync(testSource))fs.copyFileSync(testSource,path.join(dir,'v6549-bundled-lead-import-test.js'));
 return {marker:MARKER,version:TO,bundleEndpointOwnerGated:true,actualWritesUseExistingImportRoute:true,tenantRecoveryWriterGatesPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
