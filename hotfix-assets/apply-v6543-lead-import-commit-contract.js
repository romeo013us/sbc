'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6543_LEAD_IMPORT_COMMIT_CONTRACT',FROM='65.1.42',TO='65.1.43';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function read(root,rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw new Error(MARKER+': missing '+rel);return fs.readFileSync(p,'utf8');}
function write(root,rel,s){fs.writeFileSync(path.join(root,rel),s);}
function apply(root){
 let server=read(root,'server.js');
 server=once(server,"const dryRun=req.body?.dryRun!==false,rows=Array.isArray(req.body?.rows)?req.body.rows:[];","const requestedDryRun=req.body?.dryRun;const dryRun=!(requestedDryRun===false||String(requestedDryRun).toLowerCase()==='false'||req.body?.mode==='import');const rows=Array.isArray(req.body?.rows)?req.body.rows:[];",'accept explicit import mode and serialized false');
 server=once(server,"res.json({ok:true,dryRun,tenantId,total:normalized.length,imported:dryRun?0:created.length,ready:results.filter(r=>r.status==='ready').length,duplicates:results.filter(r=>r.status==='duplicate').length,results,message:dryRun?'Preview complete. No records were written.':'Import complete: '+created.length+' added; '+results.filter(r=>r.status==='duplicate').length+' duplicates skipped.'});","res.setHeader('Cache-Control','no-store');const importedCount=dryRun?0:created.length;const duplicateCount=results.filter(r=>r.status==='duplicate').length;res.json({ok:true,dryRun,tenantId,total:normalized.length,imported:importedCount,ready:results.filter(r=>r.status==='ready').length,duplicates:duplicateCount,results,message:dryRun?'Preview complete. No records were written.':(importedCount===0?'No new records were written; '+duplicateCount+' duplicate(s) were skipped.':'Import complete: '+importedCount+' added; '+duplicateCount+' duplicates skipped.')});",'explicit zero-write response');
 write(root,'server.js',server);
 let ui=read(root,'public/sbc-lead-import-v6541.js');
 ui=once(ui,"async function request(body){const response=await fetch('/api/crm/leads/import',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});let data={};try{data=await response.json();}catch{}if(!response.ok||!data.ok)throw new Error(data.error||('Import request failed with HTTP '+response.status));return data;}","async function request(body){const response=await fetch('/api/crm/leads/import',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});let data={};try{data=await response.json();}catch(e){throw new Error('Import API returned a non-JSON response (HTTP '+response.status+'). Check the authenticated session and server logs.');}if(!response.ok||data.ok!==true){const detail=data.detail?' — '+data.detail:'';throw new Error((data.error||data.message||'Import request failed')+' (HTTP '+response.status+')'+detail);}return data;}",'HTTP status and server error details');
 ui=once(ui,"try{const result=await request({dryRun:false,rows});renderResults(result);setStatus(result.message||'Import complete.','ok');preview=result;commitBtn.disabled=true;}catch(e){setStatus(e.message,'error');commitBtn.disabled=false;}","try{const result=await request({mode:'import',dryRun:false,rows});renderResults(result);if(result.dryRun!==false){setStatus('The server returned preview mode instead of committing records. No records were written. Refresh the Command Center and retry. If it repeats, save the error and check the import API response.','error');preview=result;commitBtn.disabled=Number(result.ready||0)===0;return;}if(!Number.isFinite(Number(result.imported))){setStatus('The server did not confirm how many records were saved. Do not retry until the import status is checked.','error');preview=null;commitBtn.disabled=true;return;}if(Number(result.imported)===0){setStatus(result.message||'No new records were written. Review the duplicate results before trying again.','error');preview=null;commitBtn.disabled=true;return;}setStatus(result.message||('Import complete: '+result.imported+' lead(s) saved.'),'ok');preview=result;commitBtn.disabled=true;}catch(e){setStatus(e.message,'error');commitBtn.disabled=false;}",'verify actual commit result before success');
 write(root,'public/sbc-lead-import-v6541.js',ui);
 let html=read(root,'public/index.html');
 html=once(html,'/sbc-lead-import-v6541.js?v=65.1.42-lead-import','/sbc-lead-import-v6541.js?v=65.1.43-import-contract','lead importer cache-busting URL');
 html=html.replace(/V65\.1\.42/g,'V65.1.43').replace(/65\.1\.42/g,'65.1.43');
 write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');const cache=sw.match(/const CACHE='[^']+'/);if(!cache)throw new Error(MARKER+': service-worker cache declaration could not be found');sw=sw.replace(cache[0],"const CACHE='sbc-static-v65-1-43'");write(root,'public/sw.js',sw);
 const pkg=JSON.parse(read(root,'package.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw new Error(MARKER+': expected '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.43 fixes CSV lead-import commit confirmation and HTTP error diagnostics';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));
 if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw new Error(MARKER+': package-lock root identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');
 identity=once(identity,"const RELEASE_VERSION = '65.1.42';","const RELEASE_VERSION = '65.1.43';",'release version');
 identity=once(identity,"const RELEASE_NAME = 'VOICE_CALL_DIAGNOSTICS';","const RELEASE_NAME = 'LEAD_IMPORT_COMMIT_CONTRACT';",'release name');
 identity=once(identity,'major:65,minor:1,patch:42','major:65,minor:1,patch:43','semantic version');
 write(root,'config/release-identity.js',identity);
 const versionPath=path.join(root,'VERSION');if(fs.existsSync(versionPath))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.42/g,'65.1.43'));
 return {marker:MARKER,version:TO,strictCommitConfirmation:true,explicitImportMode:true,tenantAndRecoveryGatesPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
