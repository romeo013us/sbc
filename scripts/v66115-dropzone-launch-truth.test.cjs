'use strict';
/* Release contract regression: exact no-DDL startup; this is not a live provider test. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {patch,verify,OLD,NEW}=require('./v66115-stage-dropzone-launch-truth.cjs');
const src=fs.readFileSync(path.resolve(__dirname,'..','server.js'),'utf8');
const fixed=patch(src);
assert.equal(patch(fixed),fixed,'second pass changes release');
assert(verify(fixed),'staged release must pass');
assert.equal(fixed.split(NEW).length-1,1,'exactly one no-DDL guarded default-on expression');
const block=fixed.slice(fixed.indexOf('SBC_V66110_DDL_FREE_DROPZONE_ONLY_LAUNCH'),fixed.indexOf('  await pulse();',fixed.indexOf('SBC_V66110_DDL_FREE_DROPZONE_ONLY_LAUNCH')));
assert(!block.includes(OLD),'legacy default-off expression remains');
const expression=NEW.slice(3,-1);
for(const [value,expected]of [[undefined,true],['',true],['true',true],['false',false],['FALSE',false]]){
 const sandbox={process:{env:{SBC_AUTOPILOT_DROPZONE_ENABLED:value}}};
 const result=vm.runInNewContext(expression,sandbox);
 assert.equal(Boolean(result),expected,'flag case '+String(value));
}
assert(!fixed.includes('SBC_V66115_ENABLE_GLOBAL_OUTBOUND'));
assert(block.includes('dropzoneOnly:true'),'must preserve only CSV ingestion');
assert(fixed.includes('SBC_REVENUE_AUTOPILOT_ENABLED'),'do not remove prior approved features');
if(process.argv.includes('--staged'))assert.equal(src,fixed,'packaged server lacks exact launch patch');
console.log('[SBC V66.115] PASS: no-DDL healthy writer Dropzone default-on, false disables, zero customer contacts, DDL unaffected');
