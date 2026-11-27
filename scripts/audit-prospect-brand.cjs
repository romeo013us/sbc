'use strict';
const fs=require('node:fs/promises');
const {captureAndAudit}=require('../enterprise/creative-intelligence/prospect-brand-auditor.cjs');
(async()=>{
 const [tenantRef,file]=process.argv.slice(2);
 if(process.argv.length!==4||!tenantRef||!file)throw Error('Usage: node scripts/audit-prospect-brand.cjs TENANT_REF LEAD_JSON');
 const stat=await fs.stat(file);if(!stat.isFile()||stat.size>16384)throw Error('INVALID_LEAD_FILE');
 const lead=JSON.parse(await fs.readFile(file,'utf8'));
 console.log(JSON.stringify(await captureAndAudit(lead,tenantRef),null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
