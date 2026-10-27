'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6541_LEAD_IMPORT',FROM='65.1.39',TO='65.1.41';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function read(root,rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw new Error(MARKER+': missing '+rel);return fs.readFileSync(p,'utf8');}
function write(root,rel,s){fs.writeFileSync(path.join(root,rel),s);}
function apply(root){
 let server=read(root,'server.js');
 if(!server.includes(MARKER)){
 const route=String.raw`
// SBC_V6541_LEAD_IMPORT: authenticated CSV lead import with preview, tenant scoping, duplicate checks, and recovery-safe writes.
app.post('/api/crm/leads/import',auth,ownerOnly,async(req,res)=>{
 const dryRun=req.body?.dryRun!==false,rows=Array.isArray(req.body?.rows)?req.body.rows:[];
 if(!rows.length||rows.length>500)return res.status(400).json({ok:false,error:'Provide between 1 and 500 lead rows.'});
 const clean=(v,max=1000)=>String(v==null?'':v).trim().slice(0,max),normPhone=v=>clean(v,80).replace(/\D/g,''),normEmail=v=>clean(v,254).toLowerCase(),normName=v=>clean(v,255).toLowerCase().replace(/\s+/g,' ');
 const normalized=rows.map((r,i)=>({row:i+1,businessName:clean(r.business_name||r.businessName,255),contactName:clean(r.contact_name||r.contactName,255),phone:clean(r.phone,80),email:clean(r.email,254),website:clean(r.website,1000),websiteStatus:clean(r.website_status||r.websiteStatus,120),source:clean(r.lead_source||r.source,255)||'User-provided lead research',notes:clean(r.research_notes||r.notes,4000),industry:clean(r.business_category||r.industry,255)||'Barber Shop'}));
 if(normalized.some(r=>!r.businessName))return res.status(400).json({ok:false,error:'Every row must include a business name.',invalidRows:normalized.filter(r=>!r.businessName).map(r=>r.row)});
 if(!dryRun&&(SBC_RUNTIME_READ_ONLY||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady))return res.status(423).json({ok:false,code:'SBC_IMPORT_WRITE_LOCKED',error:'Preview is available, but saving is blocked while SBC is read-only, recovery is unevaluated/required, or the exclusive writer lease is unavailable. No records were written.'});
 let conn;
 try{
  const tenantId=Number(requireRequestTenant(req));
  if(!Number.isSafeInteger(tenantId)||tenantId<=0)return res.status(403).json({ok:false,error:'A valid authenticated tenant context is required.'});
  if(!mysqlPool)return res.status(503).json({ok:false,error:'MySQL is unavailable; no records were changed.'});
  conn=await mysqlPool.getConnection();
  const [tenantCols]=await conn.query("SHOW COLUMNS FROM sbc_customers LIKE 'tenant_id'");
  if(!tenantCols.length)return res.status(503).json({ok:false,code:'TENANT_SCHEMA_NOT_READY',error:'The customer table is missing tenant_id. Import is disabled to protect tenant isolation; no records were changed.'});
  if(!dryRun)await conn.beginTransaction();
  const seen=new Set(),results=[],created=[];
  for(const r of normalized){
   const p=normPhone(r.phone),e=normEmail(r.email),b=normName(r.businessName),keys=[p?'p:'+p:'',e?'e:'+e:'',b?'b:'+b:''].filter(Boolean);
   const localKey=keys.find(k=>seen.has(k));let duplicate=null;
   if(localKey)duplicate={business_name:r.businessName,match:'duplicate within uploaded file'};
   else{
    const [matches]=await conn.query("SELECT id,business_name,phone,email FROM sbc_customers WHERE tenant_id=? AND ((? <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')',''),'+','')=?) OR (? <> '' AND LOWER(email)=LOWER(?)) OR (? <> '' AND LOWER(business_name)=LOWER(?))) LIMIT 1",[tenantId,p,p,e,e,b,b]);
    if(matches.length)duplicate={id:matches[0].id,business_name:matches[0].business_name,match:'existing CRM record'};
   }
   if(duplicate){results.push({row:r.row,businessName:r.businessName,status:'duplicate',match:duplicate.match,existingBusinessName:duplicate.business_name});continue;}
   keys.forEach(k=>seen.add(k));results.push({row:r.row,businessName:r.businessName,status:dryRun?'ready':'imported'});if(dryRun)continue;
   const createdAt=now(),c={id:id('cust'),tenantId,businessName:r.businessName,contactName:r.contactName,phone:r.phone,email:r.email,status:'Lead',source:r.source,followUp:'',notes:r.notes,website:r.website,websiteStatus:r.websiteStatus||(!r.website?'No Website':''),industry:r.industry,dealValue:0,assignedTo:'',researcherId:req.user.id,researcherName:req.user.name||req.user.username||'Lead Import',createdAt,updatedAt:createdAt};
   await conn.query("INSERT INTO sbc_customers (id,tenant_id,business_name,contact_name,phone,email,status,source,follow_up,notes,website,industry,website_status,assigned_to,account_notes_json,lead_intelligence_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[c.id,c.tenantId,c.businessName,c.contactName,c.phone,c.email,c.status,c.source,null,c.notes,c.website,c.industry,c.websiteStatus,c.assignedTo,'[]','{}',sqlDateTime(c.createdAt),sqlDateTime(c.updatedAt)]);
   created.push(c);
  }
  if(!dryRun){await conn.commit();if(typeof db!=='undefined'&&Array.isArray(db.customers))created.forEach(c=>db.customers.push(c));}
  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,dryRun,tenantId,total:normalized.length,imported:dryRun?0:created.length,ready:results.filter(r=>r.status==='ready').length,duplicates:results.filter(r=>r.status==='duplicate').length,results,message:dryRun?'Preview complete. No records were written.':'Import complete: '+created.length+' added; '+results.filter(r=>r.status==='duplicate').length+' duplicates skipped.'});
 }catch(e){if(conn&&!dryRun){try{await conn.rollback();}catch{}}console.error('[SBC_V6541_LEAD_IMPORT] import failed:',e&&e.message?e.message:e);res.status(e&&e.code==='TENANT_CONTEXT_REQUIRED'?403:500).json({ok:false,error:'Lead import failed safely. No partial import was committed.',detail:String(e&&e.message||'Unexpected import error').slice(0,300)});}
 finally{if(conn)conn.release();}
});
`;
 const anchor='const startOperationalRuntime=async()=>{',i=server.indexOf(anchor);if(i<0||server.indexOf(anchor,i+anchor.length)!==-1)throw new Error(MARKER+': expected one operational runtime startup anchor');
 // SBC_V6667_PRIVATE_OWNER_CSV_IMPORT: owner route, no PII in public GitHub or automatic imports.
 const ownerImportHtml="<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>SBC · Owner Lead Import</title></head><body><main><h1>SBC · Private Lead Import</h1><p id=\"sbc-import-page-status\">Preparing owner-only CSV review. No leads are imported automatically.</p><p><a href=\"/\">Return to Command Center</a></p><p>Verification, consent, and Do Not Call screening remain required before outreach.</p></main><script src=\"/sbc-lead-import-v6541.js?v=66.67-owner\"></script><script src=\"/sbc-v6667-private-owner-import.js?v=66.67-owner\"></script></body></html>";
 // SBC_V6671_PACKAGED_LEADS_OWNER_READ: CSV from the verified deployment package.
 // Read-only route; still requires authenticated owner. NEVER inserts on GET.
 const ownerBatchReadRoute=[
  "app.get('/api/owner/lead-import/packaged-batch',auth,ownerOnly,(req,res)=>{",
  " const batch=require('node:path').join(__dirname,'hotfix-assets','sbc-leads-oct-26-27-2026-31.csv');",
  " if(!require('node:fs').existsSync(batch))return res.status(404).json({ok:false,code:'SBC_PACKAGED_BATCH_MISSING',error:'The verified 31-lead batch is not present in this runtime. No records were changed.'});",
  " res.setHeader('Cache-Control','private, no-store');",
  " res.setHeader('X-Content-Type-Options','nosniff');",
  " res.setHeader('Content-Disposition','attachment; filename=\"sbc-leads-oct-26-27-2026-31.csv\"');",
  " res.type('text/csv').send(require('node:fs').readFileSync(batch,'utf8'));",
  "});"
 ].join('\n');
 const ownerImportRoute=[
  "app.get('/owner/lead-import',auth,ownerOnly,(req,res)=>{",
  " res.setHeader('Cache-Control','private, no-store');",
  " res.setHeader('X-Content-Type-Options','nosniff');",
  " res.setHeader('Referrer-Policy','no-referrer');",
  " res.setHeader('Content-Security-Policy',\"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\");",
  ' res.type(\'html\').send('+JSON.stringify(ownerImportHtml)+');',
  "});"
 ].join('\n');
 server=server.slice(0,i)+route+'\n'+ownerBatchReadRoute+'\n'+ownerImportRoute+'\n'+server.slice(i);write(root,'server.js',server);
 }
 const pub=path.join(root,'public'),source=path.join(__dirname,'lead-import-v6541.js');
 if(!fs.existsSync(source))throw new Error(MARKER+': missing lead-import-v6541.js');
 fs.copyFileSync(source,path.join(pub,'sbc-lead-import-v6541.js'));
 const ownerEntry=path.join(__dirname,'sbc-v6667-private-owner-import.js');
 if(!fs.existsSync(ownerEntry))throw Error(MARKER+': owner import initializer missing');
 fs.copyFileSync(ownerEntry,path.join(pub,'sbc-v6667-private-owner-import.js'));
 let html=read(root,'public/index.html');
 if(!html.includes('/sbc-lead-import-v6541.js'))html=once(html,'</body>','<script src="/sbc-lead-import-v6541.js?v=65.1.41-lead-import"></script>\n</body>','lead import screen script');
 html=html.replace(/V65\.1\.39/g,'V65.1.41').replace(/65\.1\.39/g,'65.1.41');write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');const cache=sw.match(/const CACHE='[^']+'/);if(!cache)throw new Error(MARKER+': service-worker cache declaration could not be found');sw=sw.replace(cache[0],"const CACHE='sbc-static-v65-1-41'");if(!sw.includes("const CACHE='sbc-static-v65-1-41'"))throw new Error(MARKER+': service-worker cache version could not be updated');write(root,'public/sw.js',sw);
 const pkg=JSON.parse(read(root,'package.json'));if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw new Error(MARKER+': expected '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.41 adds a tenant-scoped CSV Lead Import screen with preview and duplicate checks';pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6541-lead-import']='node hotfix-assets/v6541-lead-import-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6541-lead-import-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6541-lead-import-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw new Error(MARKER+': package-lock root identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');identity=once(identity,"const RELEASE_VERSION = '65.1.39';","const RELEASE_VERSION = '65.1.41';",'release version');identity=once(identity,"const RELEASE_NAME = 'SAFE_NO_DDL_STARTUP';","const RELEASE_NAME = 'LEAD_IMPORT_SCREEN';",'release name');identity=once(identity,'major:65,minor:1,patch:39','major:65,minor:1,patch:41','semantic version');write(root,'config/release-identity.js',identity);
 return {marker:MARKER,version:TO,writeGatePreserved:true,tenantScoped:true,previewWithoutWrites:true};
}
module.exports={apply,MARKER,FROM,TO};
