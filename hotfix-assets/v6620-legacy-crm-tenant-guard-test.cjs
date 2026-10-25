'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {owns,validatePatch}=require('../enterprise/v6620-legacy-crm-tenant-guard.cjs');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
let checks=0;
function test(name,pass){assert.ok(pass,name);checks++}
test('Current tenant record accepted',owns({id:'1',tenantId:1},1));
test('Other tenant record rejected',!owns({id:'1',tenantId:2},1));
test('Tenantless legacy record rejected',!owns({id:'1'},1));
test('snake_case tenant marker supported',owns({tenant_id:3},3));
test('Zero tenant rejected',!owns({tenantId:0},0));
test('Standard customer form patch accepted',!validatePatch({businessName:'ABC',contactName:'Owner',email:'owner@example.com',status:'Lead',source:'Referral',followUp:'2026-10-28',notes:'Called'}));
test('CRM drag/drop stage patch accepted',!validatePatch({status:'Proposal'}));
test('Whole-tenant reassignment rejected',validatePatch({tenantId:2})==='UNAPPROVED_CRM_EDIT_FIELD');
test('Record-ID replacement rejected',validatePatch({id:'other'})==='UNAPPROVED_CRM_EDIT_FIELD');
test('Billing flags are not editable',validatePatch({paymentStatus:'Paid'})==='UNAPPROVED_CRM_EDIT_FIELD');
test('Prototype manipulation rejected',validatePatch(JSON.parse('{"__proto__":{"role":"owner"}}'))==='UNAPPROVED_CRM_EDIT_FIELD');
test('Invalid status rejected',validatePatch({status:'UNAUTHORIZED'})==='INVALID_CRM_STATUS');
test('Oversized notes rejected',validatePatch({notes:'x'.repeat(12001)})==='INVALID_CRM_EDIT_VALUE');
test('Invalid email rejected',validatePatch({email:'not-an-email'})==='INVALID_CRM_EMAIL');
test('Negative invoice value rejected',validatePatch({dealValue:-5})==='INVALID_DEAL_VALUE');
test('Nested object injection rejected',validatePatch({notes:{a:1}})==='INVALID_CRM_EDIT_VALUE');
test('No edit data rejected',validatePatch({})==='EMPTY_CRM_PATCH');
test('Non-object data rejected',validatePatch(null)==='INVALID_CRM_PATCH_BODY');
const routes=[
 "app.post('/api/customers',auth,ownerOnly",
 "app.put('/api/customers/:id',auth,ownerOnly",
 "app.post('/api/customers/:id/account-notes',auth",
 "app.delete('/api/customers/:id',auth,ownerOnly",
 "app.post('/api/customers/bulk-delete',auth,ownerOnly",
 "app.post('/api/quotes',auth,ownerOnly"
];
const parts=routes.map((r,i)=>{const a=server.indexOf(r),b=i+1<routes.length?server.indexOf(routes[i+1],a+1):a+1;assert.ok(a>=0&&(i+1===routes.length||b>a),r);return server.slice(a,b)});
test('Create duplicate scan excludes other tenant',parts[0].includes('V6620_LEGACY_CRM.owns(m.customer,requireRequestTenant(req))'));
test('Owner edits explicitly validate immutable fields',parts[1].includes('V6620_LEGACY_CRM.validatePatch(req.body)'));
test('Owner customer lookup checks tenant',parts[1].includes('V6620_LEGACY_CRM.owns(x,requireRequestTenant(req))'));
test('Owner edit duplicate responses never disclose another tenant',parts[1].includes('leadDuplicateMatches(candidate,c.id).filter(m=>V6620_LEGACY_CRM.owns(m.customer,requireRequestTenant(req)))'));
test('Account note lookup checks tenant',parts[2].includes('V6620_LEGACY_CRM.owns(x,requireRequestTenant(req))'));
test('Single delete lookup checks tenant',parts[3].includes('V6620_LEGACY_CRM.owns(x,requireRequestTenant(req))'));
test('Bulk delete selection checks tenant',parts[4].includes('V6620_LEGACY_CRM.owns(c,tenantId)'));
test('Bulk delete removal checks tenant',parts[4].includes('!(ids.includes(String(c.id))&&V6620_LEGACY_CRM.owns(c,tenantId))'));
test('Existing secure direct-MySQL CRM patch route retained',server.includes("require('./routes/crm-edits-v6606')"));
test('Recovery gate remains intact',server.includes('MYSQL_RECOVERY_REQUIRED')&&server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'));
test('MySQL save failure never silently reports successful persistence',server.includes("throw failed;")&&server.includes("MYSQL_RELATIONAL_COMMIT_FAILED"));
test('Unsafe local JSON fallback removed from relational failure path',!server.includes('preserving local backup instead of crashing:'));
for(let i=0;i<5;i++){
 test('Legacy CRM mutation '+i+' requires live MySQL writer',parts[i].includes('CRM_RELATIONAL_WRITER_UNAVAILABLE'));
 test('Legacy CRM mutation '+i+' responds with a non-success HTTP status on DB failure',parts[i].includes("status(503).json({ok:false,error:'CRM_RELATIONAL_COMMIT_FAILED'"));
}
console.log(JSON.stringify({status:'PASS_V6620_LEGACY_CRM_TENANT_SAFETY',checks,productionCertified:false,knownLimitation:'live GoDaddy write, rollback and stale in-memory state still require operator verification'}));
