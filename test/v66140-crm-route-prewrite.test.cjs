'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const registerCRM=require('../routes/crm.js');
const registerEdits=require('../routes/crm-edits-v6606.js');
const handlers=new Map(),app={};
for(const method of ['get','post','patch','put','delete'])app[method]=(route,...args)=>handlers.set(method.toUpperCase()+' '+route,args.at(-1));
let connections=0;
const getContext=()=>({recoveryRequired:()=>false,mysqlPool:{getConnection(){connections++;throw Error('DATABASE_NOT_ALLOWED_IN_PREWRITE_TEST')}}});
registerCRM(app,{auth:()=>{},getContext});
registerEdits(app,{auth:()=>{},getContext});
function reply(){return {code:200,body:null,status(n){this.code=n;return this},json(x){this.body=x;return this}};}
function withTenant(callback){return runWithTenantContext({tenantId:7,actorId:'owner1',role:'owner'},callback);}
test('malformed CRM create fails before database access',async()=>{
 const req={user:{id:'owner1',role:'owner',tenantId:7},body:{businessName:'Damaged\uFFFD shop',contactName:'Valid'}},res=reply();
 await withTenant(()=>handlers.get('POST /api/v65110/crm/leads')(req,res));
 assert.equal(res.code,400);assert.equal(res.body.code,'CORRUPT_CRM_TEXT_REJECTED');assert.deepEqual(res.body.fields,['businessName']);assert.equal(connections,0);
});
test('corrupt lead edit fails before locking records',async()=>{
 const req={user:{id:'owner1',role:'owner',tenantId:7},params:{id:'a'},body:{revision:'a'.repeat(64),contactName:'PK\x03\x04 workbook'}},res=reply();
 await withTenant(()=>handlers.get('PATCH /api/v6606/crm/leads/:id')(req,res));
 assert.equal(res.code,400);assert.equal(res.body.code,'CORRUPT_CRM_TEXT_REJECTED');assert.equal(connections,0);
});
