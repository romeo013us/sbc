'use strict';
/* Regression tests for SBC owner cleanup preview: no live CRM calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const preview=require('../public/sbc-crm-cleanup-preview.js');
const source=fs.readFileSync(path.join(__dirname,'../public/sbc-crm-cleanup-preview.js'),'utf8');
const shell=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
assert(shell.includes('/sbc-crm-cleanup-preview.js?v=1'), 'owner page must load cleanup preview');
assert(!/fetch\s*\(|XMLHttpRequest|\/api\/customers\/bulk-delete/.test(source), 'preview must not call the customer API');
const csv='DATE,Business Name ,Phone,Email,Source,Research Notes,For Jonathan’s Verification\r\n'+
 '10/1/2026,"A, B Shop",1 (305) 555-0100,,https://example.org,"Site says ""closed""; double-check",\r\n'+
 '10/2/2026,Another Shop,786-555-0200,,,Verify ownership\r\n'+
 '10/3/2026,,,,,,\r\n';
const rows=preview.parseCSV(csv);
assert.equal(rows.length,2);
assert.equal(rows[0].name,'A, B Shop');
assert.equal(rows[0].notes,'Site says "closed"; double-check');
assert.equal(rows[1].owner,'Verify ownership');
assert.throws(()=>preview.parseCSV('[Content_Types].xml,x\nfake,fake'),/Export/);
const lead={id:'lead-1',businessName:'A, B Shop',phone:'3055550100',status:'Lead',source:'Research'};
const test={id:'qa-1',businessName:'SBC SYSTEM TEST — DO NOT SERVICE',phone:'3055550999',status:'Contacted',source:'QA'};
const input=[lead,test];
const snapshot=JSON.stringify(input);
const result=preview.compare(rows,input);
assert.equal(result.exact,1,'normalized phone + business name');
assert.equal(result.unmatched,1,'genuinely unmatched lead stays unmatched');
assert.equal(result.tests.length,1,'internal QA recognition');
assert.equal(JSON.stringify(input),snapshot,'comparison must not modify input CRM');
assert.equal(result.matches[1].flags.includes('Owner verification note'),true);
const repeated=preview.compare(rows,[lead,{...lead,id:'lead-2'}]);
assert.equal(repeated.repeated.length,1,'same business and phone grouped for review');
assert.equal(repeated.matches[0].result,'REVIEW — repeated exact record');
assert.equal(preview.phone('1 305 555 0100'),'3055550100');
console.log('PASS: SBC CRM cleanup preview — CSV parser, owner notes, matching, duplicates, no API mutation');
