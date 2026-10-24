'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const patch=require('../hotfix-assets/apply-v6621-explicit-ddl-optin.js');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-ddl-optin-'));
try{
 const input="let SBC_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true';\nfunction sbcMayAutoEnableDdl({envMissing,customers,minimum,recoveryRequired,recoveryEvaluated,writerLeaseReady}){return Boolean(envMissing)&&Number.isFinite(Number(customers))&&Number(customers)>=Number(minimum)&&recoveryEvaluated===true&&recoveryRequired!==true&&writerLeaseReady===true;}\n// SBC_V6539_SAFE_NO_DDL_STARTUP";
 fs.writeFileSync(path.join(folder,'server.js'),input);
 assert.equal(patch.apply(folder).implicitDdlDisabled,true);
 const output=fs.readFileSync(path.join(folder,'server.js'),'utf8');
 assert.match(output,/function sbcMayAutoEnableDdl\(\)\{return false;\}/);
 assert.match(output,/SBC_V6539_SAFE_NO_DDL_STARTUP/);
 assert.throws(()=>patch.apply(folder),/duplicate patch/);
 console.log('V6621 explicit schema opt-in regression PASS');
}finally{fs.rmSync(folder,{recursive:true,force:true})}
