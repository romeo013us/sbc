'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const publicJs=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const browserJs=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(publicJs,browserJs,'desktop/mobile activity display must remain identical');
const start=publicJs.indexOf('/* SBC_V66123_ACTIVITY_TEXT_SAFETY');
const end=publicJs.indexOf('/* SBC_V6529_OPEN_READINESS',start);
assert(start>0&&end>start,'readable activity helper must be installed before dashboard');
const safe=vm.runInNewContext(publicJs.slice(start,end)+'\nsbcReadableActivity',{});
for(const name of ['Deleted Manny Transmission & Auto Repair','Deleted Café Renée 汽车','Deleted João Auto','Customer sent a note','Deleted Richard O\'Brien'])
 assert.equal(safe(name),name,'valid activity must be unchanged');
for(const msg of ['Deleted \uFFFDgqq\u0001\u0003\uFFFD\uFFFD','Deleted \u0000bad\u0007','Deleted \u0085unreadable'])
 assert.equal(safe(msg),'Deleted CRM record — saved name unreadable','malformed deleted name should be suppressed in presentation');
const note='Internal note with \uFFFD from a different source';
assert.equal(safe(note),note,'non-deletion historical notes remain unchanged for owner investigation');
assert.equal((publicJs.match(/esc\(sbcReadableActivity\(a\.message\)\)/g)||[]).length,2,'dashboard and customer detail use readable display');
assert(!publicJs.includes('db.activities='),'front-end must never rewrite audit data');
const acquisition=fs.readFileSync(path.join(root,'public/v33-0-launch-acquisition.js'),'utf8');
const acquisitionMirror=fs.readFileSync(path.join(root,'browser_public/v33-0-launch-acquisition.js'),'utf8');
assert.equal(acquisition,acquisitionMirror,'Customer Acquisition module label must match desktop/mobile');
assert(acquisition.includes('Customer Acquisition Setup Checklist'),'20-step counter must be clearly scoped');
assert(acquisition.includes('Not an overall production-health score'),'do not misrepresent the module checklist as live production QA');
assert(!acquisition.includes('⚙️ First-Run Setup'),'ambiguous system-wide checklist label must be removed');
console.log('[SBC V66.123] PASS malformed deleted-record activity display; historical data preserved, Unicode names and both UIs unchanged');
