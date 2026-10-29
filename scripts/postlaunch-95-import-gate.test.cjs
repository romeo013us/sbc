'use strict';
/* SBC post-launch import safety gate. READ-ONLY source/CSV checks only.
   Never contacts production, mutates databases, imports leads or deploys. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const server=get('server.js');
const html=get('public/index.html');
const htmlMirror=get('browser_public/index.html');
const ui=get('public/sbc-lead-import-v6541.js');
const uiMirror=get('browser_public/sbc-lead-import-v6541.js');
const privatePage=get('public/sbc-v6667-private-owner-import.js');
const check=(message,ok)=>assert.ok(ok,message);

check('Browser source and deployment HTML match',html===htmlMirror);
check('Browser source and deployed lead importer match',ui===uiMirror);
check('Owner-only import link is present once',html.split('id="sbc-owner-import-link"').length===2);
check('Import link is hidden until owner verification',/id="sbc-owner-import-link"[^>]*href="\/owner\/lead-import"[^>]*hidden/.test(html));
check('Owner navigation uses authenticated identity',html.includes("data.authenticated===true&&data.user&&data.user.role==='owner'"));
check('Owner navigation hides when signing out',html.includes("getElementById('logoutBtn')?.addEventListener('click',hide)"));
check('Old floating import controls remain suppressed',html.includes('SBC_V6632_REMOVE_FLOATING_LEAD_IMPORT'));
check('Owner-only server page remains protected',server.includes("app.get('/owner/lead-import',auth,ownerOnly"));
check('Owner-only server import API remains protected',server.includes("app.post('/api/crm/leads/import',auth,ownerOnly"));
check('Protected packaged-batch endpoint remains protected',server.includes("app.get('/api/owner/lead-import/packaged-batch',auth,ownerOnly"));
check('Preview API writes remain denied',server.includes("return res.status(423).json({ok:false,error:'SBC_READ_ONLY_RUNTIME'"));
check('Import requires writer lease/recovery evaluation',server.includes("SBC_RUNTIME_READ_ONLY||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady"));
check('Import still requires tenant scoping',server.includes("const tenantId=Number(requireRequestTenant(req))"));
check('Import save wraps a database transaction',server.includes("if(!dryRun)await conn.beginTransaction()")&&server.includes("if(!dryRun){await conn.commit()"));
check('Errors trigger rollback',server.includes("if(conn&&!dryRun){try{await conn.rollback()"));
check('Importer uses explicit write request',ui.includes("request({mode:'import',dryRun:false,rows})"));
check('Preview requests are read-only',ui.includes("request({dryRun:true,rows})"));
check('Unconfirmed HTTP 200 is not treated as a write',ui.includes('data.dryRun!==false')&&ui.includes("Number.isFinite(Number(data.imported))"));
check('Private owner page does not auto-import',privatePage.includes('No import runs automatically.')&&privatePage.includes("load.addEventListener('click',async()=>"));
check('Private importer has no automatic commit on load',!privatePage.includes("request({mode:'import'"));
const parseStart=ui.indexOf('function parseCsv(text){');
const parseEnd=ui.indexOf('async function request(body){',parseStart);
check('CSV parsing implementation is present',parseStart>=0&&parseEnd>parseStart);
const parseCsv=Function(ui.slice(parseStart,parseEnd)+'\nreturn parseCsv;')();
for(const [filename,expected] of [
 ['hotfix-assets/sbc-leads-oct-26-27-2026-31.csv',31],
 ['public/sbc-master-prospect-list-2026-10-23.csv',253]
]){
 const rows=parseCsv(get(filename));
 assert.equal(rows.length,expected,filename+' has expected lead rows');
 assert.ok(rows.every(row=>String(row.business_name||'').trim()),filename+' includes business names');
 assert.ok(rows.every(row=>String(row.lead_source||'').trim()),filename+' includes source provenance');
 check(filename+' is within safe batch size',rows.length<=500);
 console.log('PASS',filename,rows.length+' parsed rows (source inspection only)');
}
console.log('PASS SBC post-launch import safety gate: no database contact, no writes, no deployment');
