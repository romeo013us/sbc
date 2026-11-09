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
 assert(compiled.indexOf("SBC_CRM_TEXT.invalidFields(c)")<compiled.indexOf("db.customers.unshift(c)"));
});
test('CSV check yields field-level offending-row evidence',()=>{
 const result=guard.inspectBatch([{businessName:'Café Señor'},{businessName:'PK\x03\x04 xl/workbook.xml'},{businessName:'Bangkok ร้านค้า'}]);
 assert.equal(result.ok,false);assert.deepEqual(result.invalid,[{row:2,fields:['businessName']}]);
});
test('direct CRM routes include prewrite validation gate',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert(read('routes/crm.js').includes('CORRUPT_CRM_TEXT_REJECTED'));
 assert(read('routes/crm-edits-v6606.js').includes('CORRUPT_CRM_TEXT_REJECTED'));
});
test('staged process contains gate in staged builds',()=>{
 if(process.argv.includes('--staged'))assert.equal(stage.patchServer(server),server);
});
