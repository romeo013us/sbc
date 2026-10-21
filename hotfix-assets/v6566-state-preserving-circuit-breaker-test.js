'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'v6566-state-preserving-circuit-breaker.js'), 'utf8');
assert.match(source, /SBC_V6566_STATE_PRESERVING_CIRCUIT_BREAKER/);
assert.match(source, /const threshold = 2/);
assert.match(source, /const recoveryMs = 30000/);
assert.match(source, /SBC_STANDBY_GUARDED/);
assert.match(source, /window\.fetch = async function/);
assert.match(source, /Your current screen is preserved/);
assert.match(source, /no records or business actions were changed/);
assert.doesNotMatch(source, /location\.reload|document\.write|localStorage\.clear|DROP TABLE|DELETE FROM/i);
const elements = {};
function el(tag) {
  return {tag,style:{},children:[],parentNode:null,textContent:'',id:'',setAttribute(){},append(...xs){this.children.push(...xs)},appendChild(child){this.children.push(child);child.parentNode=this;elements[child.id]=child},removeChild(child){this.children=this.children.filter(x=>x!==child);child.parentNode=null;delete elements[child.id]}};
}
const body=el('body');
const document={body,createElement:el,getElementById:id=>elements[id]||null};
const listeners={};
let statuses=[503,503,200];
const window={location:{href:'https://example.test/'},fetch:async()=>new Response('{}',{status:statuses.shift()||200}),addEventListener:(n,fn)=>{listeners[n]=fn}};
const context={window,document,URL,Date,Response,console};
vm.runInNewContext(source,context);
(async()=>{
 await window.fetch('/api/me');
 await window.fetch('/api/agent-os/status');
 assert.ok(document.getElementById('sbc-v6566-standby'),'two consecutive 503s should trip standby');
 const before=body.children.length;
 await window.fetch('/api/me');
 assert.equal(body.children.length,before,'open circuit must not duplicate overlay');
 window.fetch = window.fetch; // preserve patched fetch for the probe
 await new Promise(r=>setTimeout(r,1));
 console.log('[SBC V65.1.65 CIRCUIT BREAKER] static safety and two-503 trip tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
