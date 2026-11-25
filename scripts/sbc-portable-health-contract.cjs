'use strict';
// Evidence classification only: never converts a sandbox result into production certification.
function classifyHealth(h,expected){
 if(!h||h.ok!==true||h.app!=='SBC Business Command Center'||h.database!=='connected'||h.writerLeaseReady!==false||h.recoveryEvaluated!==true)throw Error('PORTABLE_MYSQL_READONLY_BOOT_NOT_PROVEN');
 if(expected==='empty'&&h.storage==='mysql-recovery-required'&&h.recoveryRequired===true&&h.productionReady===false)return 'ISOLATED_EMPTY_DB_FAIL_CLOSED';
 if(expected==='hydrated'&&h.storage==='mysql-relational-read-only'&&h.recoveryRequired===false&&h.productionReady===true)return 'ISOLATED_HYDRATED_READONLY';
 throw Error('PORTABLE_RECOVERY_STATE_MISMATCH');
}
if(require.main===module){
 try{const fs=require('node:fs');const h=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify({scope:classifyHealth(h,process.argv[2]),productionCertified:false,writerVerified:false,realDataRestored:false}));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={classifyHealth};
