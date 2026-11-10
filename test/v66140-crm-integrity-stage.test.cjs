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
  const lead={id:'synthetic',tenantId:1,businessName:'Café Señor'};
  const correct=workforceHandler(compiled,method,url,{
   canEditResearchLead:()=>true,sbcLornaRole:()=>false,requireRequestTenant:()=>1,db:{customers:[lead]}
  });
  const res=response();
  await correct({user:{role:'owner'},params:{id:lead.id},body:{businessName:'Different business',[field]:'Broken\uFFFD text'}},res);
  assert.equal(res.statusCode,400);
  assert.deepEqual(res.body.fields,[field]);
  assert.equal(lead.businessName,'Café Señor');
  assert.equal(lead[field],undefined);
 }
});
test('a valid foreign lead ID cannot be read or changed through the workforce routes',async()=>{
 const compiled=stage.patchServer(server);
 const foreign={id:'synthetic',tenantId:9,businessName:'Private tenant record'};
 for(const [method,url] of [['get','/api/workforce/leads/:id'],['put','/api/workforce/leads/:id'],['post','/api/v9/lead-verification/:id']]){
  const handler=workforceHandler(compiled,method,url,{
   canEditResearchLead:()=>true,sbcLornaRole:()=>false,requireRequestTenant:()=>1,db:{customers:[foreign]}
  });
  const res=response();
  await handler({user:{role:'manager'},params:{id:foreign.id},body:{businessName:'Overwritten'}},res);
  assert.equal(res.statusCode,404);
  assert.equal(foreign.businessName,'Private tenant record');
 }
});
test('workforce edits update memory only after tenant-scoped durable readback',async()=>{
 const compiled=stage.patchServer(server);
 const lead={id:'synthetic',tenantId:7,businessName:'Original'};
 const calls=[];
 let readback=[];
 const handler=workforceHandler(compiled,'put','/api/workforce/leads/:id',{
  canEditResearchLead:()=>true,requireRequestTenant:()=>7,db:{customers:[lead]},
  leadIntel:()=>({}),sanitizeLeadIntel:x=>x,now:()=>new Date().toISOString(),sqlDateTime:x=>x,audit(){},
  mysqlPool:{async query(sql,args){calls.push({sql,args});return [sql.startsWith('SELECT')?readback:{affectedRows:1}];}}
 });
 const req={user:{role:'owner'},params:{id:lead.id},body:{businessName:'Updated'}};
 const failed=response();
 await handler(req,failed);
 assert.equal(failed.statusCode,503);
 assert.equal(lead.businessName,'Original');
 readback=[{id:lead.id}];
 const saved=response();
 await handler(req,saved);
 assert.equal(saved.body.persistence.verified,true);
 assert.equal(lead.businessName,'Updated');
 for(const {sql,args} of calls){
  assert.match(sql,/WHERE tenant_id=\? AND id=\?/);
  assert.deepEqual(Array.from(args).slice(-2),[7,lead.id]);
 }
});
test('overlapping workforce edits to one tenant lead preserve both accepted changes',async()=>{
 const compiled=stage.patchServer(server);
 const lead={id:'serial-synthetic',tenantId:7,businessName:'Original',phone:'3050000000'};
 let releaseFirst,announceFirst;
 const firstStarted=new Promise(resolve=>{announceFirst=resolve;});
 const firstBlocked=new Promise(resolve=>{releaseFirst=resolve;});
 const updates=[];
 const handler=workforceHandler(compiled,'put','/api/workforce/leads/:id',{
  canEditResearchLead:()=>true,requireRequestTenant:()=>7,db:{customers:[lead]},
  leadIntel:()=>({}),sanitizeLeadIntel:x=>x,now:()=>new Date().toISOString(),sqlDateTime:x=>x,audit(){},
  mysqlPool:{async query(sql,args){
   if(sql.startsWith('UPDATE')){
    updates.push(Array.from(args));
    if(updates.length===1){announceFirst();await firstBlocked;}
    return [{affectedRows:1}];
   }
   return [[{id:lead.id}]];
  }}
 });
 const nameResult=response(),phoneResult=response();
 const saveName=handler({user:{role:'owner'},params:{id:lead.id},body:{businessName:'Updated'}},nameResult);
 await firstStarted;
 const savePhone=handler({user:{role:'owner'},params:{id:lead.id},body:{phone:'3055550100'}},phoneResult);
 await Promise.resolve();
 assert.equal(updates.length,1,'second request must wait for first durable update');
 releaseFirst();
 await Promise.all([saveName,savePhone]);
 assert.equal(updates.length,2);
 assert.equal(updates[1][0],'Updated','second full-row write must retain committed business name');
 assert.equal(updates[1][2],'3055550100');
 assert.equal(lead.businessName,'Updated');
 assert.equal(lead.phone,'3055550100');
 assert.equal(nameResult.body.persistence.verified,true);
 assert.equal(phoneResult.body.persistence.verified,true);
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
  SBC_WORKFORCE_LEAD_EDIT_TAILS:new Map(),...context,app,auth(){},require:(name)=>{
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
