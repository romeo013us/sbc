'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const stage=require('../scripts/v66140-stage-crm-integrity.cjs');
const guard=require('../enterprise/crm-text-integrity-v66140.cjs');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
test('stages input validation without changing pinned server',()=>{
 const before=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const compiled=stage.patchServer(before);
 assert(compiled.includes(stage.MARK));
 assert.equal(stage.patchServer(compiled),compiled);
 assert.equal(fs.readFileSync(path.join(root,'server.js'),'utf8'),before);
 new vm.Script(compiled,{filename:'staged-server.js'});
});
test('both CSV and API inbound reject malformed identities before write',()=>{
 const compiled=stage.patchServer(server);
 assert(compiled.includes("SBC_CRM_TEXT.inspectBatch(normalized)"));
 assert(compiled.includes("SBC_CRM_TEXT.invalidFields(c)"));
 assert(compiled.indexOf("SBC_CRM_TEXT.inspectBatch(normalized)")<compiled.indexOf("if(!dryRun&&(SBC_RUNTIME_READ_ONLY"));
 const inbound=compiled.slice(compiled.indexOf("app.post('/api/crm/inbound/:key'"));
 assert(inbound.indexOf("SBC_CRM_TEXT.invalidFields(c)")>=0 && inbound.indexOf("SBC_CRM_TEXT.invalidFields(c)")<inbound.indexOf("db.customers.unshift(c)"));
});
test('CSV check yields field-level offending-row evidence',()=>{
 const result=guard.inspectBatch([{businessName:'Café Señor'},{businessName:'PK\x03\x04 xl/workbook.xml'},{businessName:'Bangkok ร้านค้า'}]);
 assert.equal(result.ok,false);assert.deepEqual(result.invalid,[{row:2,fields:['businessName']}]);
});
test('workstation submission rejects corrupt aliases before accessing CRM data',async()=>{
 const compiled=stage.patchServer(server);
 const post=workforceHandler(compiled,'post','/api/workforce/leads',{
  canSubmitResearchLeads:()=>true,
  db:{get customers(){throw Error('invalid input must not read or write customer records');}}
 });
 const res=response();
 await post({user:{role:'lead_researcher'},body:{company:'PK\x03\x04 xl/workbook.xml',notes:'First line\nSecond line'}},res);
 assert.equal(res.statusCode,400);
 assert.equal(res.body.code,'CORRUPT_CRM_TEXT_REJECTED');
 assert.deepEqual(res.body.fields,['company']);
});
test('lead correction paths reject unreadable fields without editing the record',async()=>{
 const compiled=stage.patchServer(server);
 for(const [method,url,field] of [['post','/api/v9/lead-verification/:id','verificationSource'],['put','/api/workforce/leads/:id','contactName']]){
  const lead={id:'synthetic',businessName:'Café Señor'};
  const correct=workforceHandler(compiled,method,url,{
   canEditResearchLead:()=>true,sbcLornaRole:()=>false,db:{customers:[lead]}
  });
  const res=response();
  await correct({user:{role:'owner'},params:{id:lead.id},body:{businessName:'Different business',[field]:'Broken\uFFFD text'}},res);
  assert.equal(res.statusCode,400);
  assert.deepEqual(res.body.fields,[field]);
  assert.equal(lead.businessName,'Café Señor');
  assert.equal(lead[field],undefined);
 }
});
function response(){
 return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
function workforceHandler(compiled,method,url,context){
 const start=compiled.indexOf("app."+method+"('"+url+"',auth,async(req,res)=>{");
 assert.notEqual(start,-1);
 const end=compiled.indexOf('\n});',start);
 assert.notEqual(end,-1);
 let handler;
 const app={[method]:(_url,_auth,fn)=>{handler=fn;}};
 vm.runInNewContext(compiled.slice(start,end+4),{
  ...context,app,auth(){},require:(name)=>{
   assert.equal(name,'./enterprise/crm-text-integrity-v66140.cjs');
   return guard;
  }
 });
 assert.equal(typeof handler,'function');
 return handler;
}
test('direct CRM routes include prewrite validation gate',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert(read('routes/crm.js').includes('CORRUPT_CRM_TEXT_REJECTED'));
 assert(read('routes/crm-edits-v6606.js').includes('CORRUPT_CRM_TEXT_REJECTED'));
});
test('staged process contains gate in staged builds',()=>{
 if(process.argv.includes('--staged'))assert.equal(stage.patchServer(server),server);
});
