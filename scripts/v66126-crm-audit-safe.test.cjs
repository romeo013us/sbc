'use strict';
// Deterministic non-network regression: a legacy "audit & dedupe" request must
// not change a single customer or run a save, even when supplied old POST flags.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const audit=require('../enterprise/v66126-crm-audit-preview.cjs');
const stage=require('./v66126-stage-crm-audit-safe.cjs');
const base=[
 {id:'lead1',tenantId:1,businessName:'Sweetwater Barber Shop',city:'Miami',phone:'+13055550101',leadTemperature:'Warm'},
 {id:'lead2',tenantId:1,businessName:'Sweetwater Barber Shop',city:'Miami',phone:'+13055550102',leadTemperature:'Cold'},
 {id:'lead3',tenantId:1,businessName:'Deleted PK\u0003\u0004 xl/workbook.xml',city:'Miami',leadTemperature:'Hot'},
 {id:'lead4',tenantId:1,businessName:'Café Renée 汽车',city:'Miami',leadTemperature:'Warm'},
 {id:'outside',tenantId:2,businessName:'Other tenant PK\u0003\u0004',city:'Miami',leadTemperature:'Hot'}
];
const snapshot=JSON.stringify(base),result=audit.preview(base,1,{includeIds:true});
assert.equal(result.total,4);assert.equal(result.potentialDuplicateGroups,1);
assert.equal(result.suspiciousTextRecords,1);
assert.deepEqual(result.suspiciousRecordIds,['lead3']);
assert.equal(result.removedDuplicates,0);
assert.equal(result.noRecordsChanged,true);
assert.equal(audit.preview(base,1).suspiciousRecordIds,undefined);
assert.equal(audit.preview(base,2).total,1);
assert(!audit.suspicious(base[3]),'accents and CJK names must be allowed');
assert.equal(JSON.stringify(base),snapshot,'audit must never modify source objects');
assert.throws(()=>audit.preview(base,0),/CRM_AUDIT_TENANT_REQUIRED/);

const src=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const compiled=stage.patchServer(src);
assert.equal(stage.patchServer(compiled),compiled,'staging must be idempotent');
assert(compiled.includes(stage.MARK),'CRM safety marker required');
assert(compiled.includes('const leadAudit=auditLeadPool({dedupe:false,rate:true});'));
assert(!compiled.includes('const leadAudit=auditLeadPool({dedupe:true,rate:true});'));
const start=compiled.indexOf("app.post('/api/crm/leads/audit',auth,async(req,res)=>{");
const end=compiled.indexOf("\napp.post('/api/crm/inbound/:key'",start);
assert(start>=0&&end>start,'legacy API must be replaced');
const handlers=new Map(),data=JSON.parse(snapshot);
const ctx={app:{post:(route,auth,handler)=>{assert.equal(auth,'AUTH');handlers.set(route,handler)}},
 auth:'AUTH',SBC_V66126_AUDIT:audit,db:{customers:data},
 requireRequestTenant:req=>req.tenantId};
vm.runInNewContext(compiled.slice(start,end),ctx,{timeout:2000});
const handler=handlers.get('/api/crm/leads/audit');
assert.equal(typeof handler,'function');
async function submit(tenantId,role,body){
 const output={statusCode:200,json:null,headers:{},
  status(code){this.statusCode=code;return this},
  setHeader(k,v){this.headers[k]=v;return this},
  json(value){this.json=value;return this}};
 await handler({tenantId,user:{role},body},output);
 return output;
}
(async()=>{
 const r=await submit(1,'owner',{dedupe:true,rate:true,confirm:true});
 assert.equal(r.statusCode,200);assert.equal(r.json.readOnly,true);
 assert.equal(r.json.total,4);assert.equal(r.json.removedDuplicates,0);
 assert.equal(r.json.suspiciousRecordIds.length,1);
 assert.equal(r.headers['Cache-Control'],'no-store');
 const researcher=await submit(1,'lead_researcher',{dedupe:true});
 assert.equal(researcher.statusCode,200);
 assert.equal(researcher.json.suspiciousRecordIds,undefined);
 const denied=await submit(1,'caller',{dedupe:true});
 assert.equal(denied.statusCode,403);
 const missingTenant=await submit(0,'owner',{dedupe:true});
 assert.equal(missingTenant.statusCode,403);
 assert.equal(JSON.stringify(data),snapshot,'legacy API must never delete, merge, sort or rescore');
 if(process.argv.includes('--staged'))assert.equal(src,compiled,'compiled GoDaddy runtime missing audit guard');
 console.log('[SBC V66.126 CRM AUDIT] PASS nonmutating tenant preview, suspicious IDs owner-only, valid Unicode, no startup dedupe');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
