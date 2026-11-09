'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const g=require('../enterprise/crm-text-integrity-v66140.cjs');
test('allows unicode accented and international business names',()=>{
 for(const name of ['Café Renée','李氏维修','La Niña Servicios','شركة الهدى','שירותים'])assert.deepEqual(g.invalidFields({businessName:name,contactName:name}),[]);
});
test('rejects ZIP/workbook binary corruption and replacement glyph',()=>{
 for(const name of ['PK\x03\x04 xl/workbook.xml','Removed\uFFFDtext','\u0000Mangled'])assert.deepEqual(g.invalidFields({businessName:name}),['businessName']);
});
test('rejects control chars in identity but allows real multiline notes',()=>{
 assert.equal(g.invalidText('Name\nInjected'),true);
 assert.equal(g.invalidText('Good\nnotes',{allowLineBreaks:true}),false);
});
test('batch returns stable row positions and no changes',()=>{
 const input=[{businessName:'Valid'},{businessName:'\uFFFD damaged'}];const before=JSON.stringify(input);
 const result=g.inspectBatch(input);assert.deepEqual(result.invalid,[{row:2,fields:['businessName']}]);assert.equal(JSON.stringify(input),before);
});
test('rejects non-object rows safely',()=>{
 assert.deepEqual(g.invalidFields(null),['record']);
});
