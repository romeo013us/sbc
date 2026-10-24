'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6621_EXPLICIT_DDL_OPTIN';
function apply(root){
 const f=path.join(root,'server.js');
 const before=fs.readFileSync(f,'utf8');
 if(before.includes(MARKER))throw Error(MARKER+': duplicate patch');
 const pattern=/function sbcMayAutoEnableDdl\(\{envMissing,customers,minimum,recoveryRequired,recoveryEvaluated,writerLeaseReady\}\)\{return Boolean\(envMissing\)&&Number\.isFinite\(Number\(customers\)\)&&Number\(customers\)>=Number\(minimum\)&&recoveryEvaluated===true&&recoveryRequired!==true&&writerLeaseReady===true;\}/g;
 const hits=[...before.matchAll(pattern)];
 if(hits.length!==1)throw Error(MARKER+': expected exactly one predicate, found '+hits.length);
 const after=before.replace(pattern,'function sbcMayAutoEnableDdl(){return false;} // '+MARKER+': absence of ENABLE_DDL never permits implicit schema changes');
 if(!after.includes("const SBC_DDL_ENABLED")&&!after.includes("let SBC_DDL_ENABLED"))throw Error(MARKER+': missing DDL gate');
 if(!after.includes('SBC_V6539_SAFE_NO_DDL_STARTUP'))throw Error(MARKER+': existing worker guard missing');
 fs.writeFileSync(f,after);
 return {marker:MARKER,changed:true,implicitDdlDisabled:true};
}
module.exports={apply,MARKER};
