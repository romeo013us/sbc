'use strict';
/* V66.164: change the canonical owner-only CRM CSV endpoint only in the
 * disposable GoDaddy staging server. Preserve its transactional, tenant,
 * duplicate, writer lease, recovery and authentication checks. */
const fs=require('node:fs');
const path=require('node:path');
const MARK='SBC_V66164_OWNER_CSV_1000';
const ROUTE="app.post('/api/crm/leads/import',auth,ownerOnly,";
const OLD="if(!rows.length||rows.length>500)return res.status(400).json({ok:false,error:'Provide between 1 and 500 lead rows.'});";
const NEW="if(!rows.length||rows.length>1000)return res.status(400).json({ok:false,error:'Provide between 1 and 1000 lead rows.'});";
const OLD_SCRIPT='/sbc-lead-import-v6541.js?v=66.67-owner';
const NEW_SCRIPT='/sbc-lead-import-v6541.js?v=66.164-owner-csv-1000';
function patchServer(input){
 let s=String(input||'');
 if(s.includes('// '+MARK)){
  if(!s.includes(NEW)||s.includes(OLD)||s.includes(OLD_SCRIPT))throw Error('OWNER_CSV_1000_PARTIAL_STAGE');
  return s;
 }
 if(s.split(ROUTE).length!==2||s.split(OLD).length!==2||
  !s.includes('SBC_V6649_REQUIRE_WRITER')||s.split(OLD_SCRIPT).length!==2||
  !s.includes('SBC_RUNTIME_READ_ONLY||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady'))
  throw Error('OWNER_CSV_IMPORT_ROUTE_NOT_FOUND');
 s=s.replace(ROUTE,'// '+MARK+' — existing guarded owner CRM route, maximum 1000 rows\n'+ROUTE);
 s=s.replace(OLD,NEW);
 s=s.replace(OLD_SCRIPT,NEW_SCRIPT);
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js');
 const before=fs.readFileSync(file,'utf8');
 const after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66164_ISOLATED_STAGE!=='YES')throw Error('OWNER_CSV_1000_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,after);
 }
 if(process.argv.includes('--verify-staged')&&before!==after)throw Error('OWNER_CSV_1000_MISSING_FROM_CANDIDATE');
 console.log('[SBC V66.164] Owner CSV limit '+(before===after?'VERIFIED_1000':'READY_TO_STAGE_1000'));
}
module.exports={MARK,patchServer};
