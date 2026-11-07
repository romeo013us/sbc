'use strict';
// V66.86: Lorna's optional additional public number is stored as a tagged
// line in existing durable research notes. Synthetic only, never contacts a
// lead, calls Square, writes MySQL or changes researcher permissions.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/lead-research.html'),js=read('public/lead-research.js');
new vm.Script(js,{filename:'public/lead-research.js'});
assert.match(html,/name="phone" type="tel"/);
assert.match(html,/name="secondaryPhone" type="tel"/);
assert.match(html,/name="secondaryPhoneSource"/);
assert.match(html,/\/lead-research\.js\?v=(?:[5-9]|[1-9]\d+)\b/);
assert.match(html,/\/sbc-role-shift-plan\.js\?v=1/);
assert.match(js,/SBC_V6686_SECONDARY_PHONE/);
assert.match(js,/composeSecondaryPhoneNotes\(data\.notes,fd\.get\('secondaryPhone'\),fd\.get\('secondaryPhoneSource'\),data\.phone,2000\)/);
assert.match(js,/await api\('\/api\/workforce\/leads',\{method:'POST',body:JSON\.stringify\(data\)\}\)/);
assert.match(js,/await api\('\/api\/v9\/lead-verification\/'/);
assert.match(js,/secondaryPhoneLabel\(c\)/);
assert.match(js,/splitSecondaryPhoneNotes\(lead\.notes\)/);
assert.doesNotMatch(js,/\/api\/crm\/leads\/import|localStorage\./);
const begin=js.indexOf("var SBC_SECOND_PHONE_TAG=");
const end=js.search(/\nfunction displayLead\(c(?:,\s*inQueue)?\)\{/);
assert.ok(begin>0&&end>begin,'isolated pure-phone helpers must exist in researcher workspace');
const ctx=vm.createContext({});
vm.runInContext(js.slice(begin,end),ctx,{timeout:1000});
const compose=ctx.composeSecondaryPhoneNotes,split=ctx.splitSecondaryPhoneNotes,label=ctx.secondaryPhoneLabel;
const original='Contact line confirmed from Google Business Profile.\nCall during business hours.';
const saved=compose(original,'(305) 555-0123','LinkedIn','305-555-0199',2000);
assert.match(saved,/^\s*Contact line confirmed from Google Business Profile\./);
assert.match(saved,/\[SBC_ALT_PHONE_V1\] \{"phone":"\(305\) 555-0123","source":"LinkedIn"\}/);
const reopened=split(saved);
assert.equal(reopened.phone,'(305) 555-0123');
assert.equal(reopened.source,'LinkedIn');
assert.equal(reopened.notes,original);
assert.equal(label({notes:saved}),'Secondary: (305) 555-0123 (LinkedIn)');
assert.equal(label({notes:'ordinary notes'}),'');
assert.equal(split('ordinary notes').notes,'ordinary notes');
assert.equal(compose(saved,'3055550125','Business website','3055550199',2000).match(/\[SBC_ALT_PHONE_V1\]/g).length,1,'correction replaces not duplicates the stored number');
const changed=compose(saved,'3055550125','Business website','3055550199',2000);
assert.equal(split(changed).phone,'3055550125');
assert.equal(split(changed).notes,original);
assert.equal(compose(saved,'','','3055550199',2000),original,'clearing the extra phone preserves the primary and notes');
assert.equal(compose('', '', '', '3055550199',2000),'');
for(const [phone,source,primary,error] of [
 ['3055550199','LinkedIn','(305) 555-0199',/differ from the primary/],
 ['12','Google','3055550199',/Check the additional/],
 ['', 'LinkedIn','3055550199',/before its source/],
 ['9'.repeat(81),'LinkedIn','3055550199',/too long/],
 ['3055550123','L'.repeat(121),'3055550199',/too long/]
]){
 assert.throws(()=>compose(original,phone,source,primary,2000),error);
}
assert.throws(()=>compose('X'.repeat(1990),'3055550123','LinkedIn','3055550199',2000),/notes are full/);
assert.equal(split('[SBC_ALT_PHONE_V1] malicious not JSON').notes,'[SBC_ALT_PHONE_V1] malicious not JSON','malformed note lines are not discarded');
const injection=compose('', '3055550123','<img src=x onerror=alert(1)>','3055550199',2000);
assert.match(split(injection).source,/<img src=x onerror=alert\(1\)>/);
assert.match(js,/element\('small',null,\[c\.city\|\|c\.address,c\.industry,c\.phone,secondaryPhoneLabel\(c\),c\.email\]/,'numbers are rendered as textContent rather than injected as HTML');
console.log('[SBC V66.86] PASS: 2 sourced phone fields, durable notes round-trip, correction, no duplicate tags, unchanged primary, validation, no database migration');
