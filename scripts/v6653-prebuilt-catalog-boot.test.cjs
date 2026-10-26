'use strict';
// Regression against the exact extracted shipping prebuilt archive.
// No provider credentials, customer data, network requests, or database writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const cp=require('node:child_process');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const expected={
 'data/v433-edge-suite.json':'0a656d1acd2b58eb7fe72d0c7354ca30c692206b40905f389cad2c09b3f9df7e',
 'data/v434-resilience-suite.json':'6db1b8ab64eacb3f56a8b3380468dd073fe7930576ccb61b06485b41aead671b',
 'data/v434-brand-intelligence.json':'5dd3bb9e912d01d0355a43f2579eaa9a28fd859ba092b6a736c80e97a7732488',
 'data/v4341-kim-resilience-control.json':'283821af395ff26e6f012d87586e72850f9fb6731e7cca6797570e13301bb2e1',
 'data/kim-greatness-100.json':'c9494969197a5549ccc8f85ca7516bca5967e256b4c4231e5b946b69a92ff108'
};
assert.deepEqual(fs.readdirSync(path.join(root,'data')).sort(),
 Object.keys(expected).map(x=>path.basename(x)).sort(),
 'release must contain precisely the approved catalogs, never customer state');
for(const [rel,digest] of Object.entries(expected)){
 const b=fs.readFileSync(path.join(root,rel));
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),digest,rel);
}
const edge=require(path.join(root,'enterprise/v433-edge-suite.js'));
const resilience=require(path.join(root,'enterprise/v434-resilience-brand.js'));
const kim=require(path.join(root,'enterprise/v4341-kim-resilience-control.js'));
const greatness=require(path.join(root,'enterprise/kim-greatness-100.js'));
assert.equal(edge.REG.items.length,150,'no silent empty edge catalog');
assert.equal(resilience.catalog().resilience.length,88);
assert.equal(resilience.catalog().brand.length,50);
assert.equal(kim.catalog().kimControl.length,132);
assert.equal(greatness.catalog().capabilities.length,114);
// Prove the actual boot module would throw without the JSON: catches regressions
// where a future packager accidentally excludes catalogs while source CI stays green.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6653-negative-'));
try {
 const mod=path.join(tmp,'enterprise/v434-resilience-brand.js');
 fs.mkdirSync(path.dirname(mod),{recursive:true});
 fs.copyFileSync(path.join(root,'enterprise/v434-resilience-brand.js'),mod);
 const test=cp.spawnSync(process.execPath,['-e','require('+JSON.stringify(mod)+')'],
   {encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH||''}});
 assert.notEqual(test.status,0);
 assert.match(test.stderr,/ENOENT/);
}finally {fs.rmSync(tmp,{recursive:true,force:true});}
console.log('[SBC V6653] PASS five immutable startup catalogs present; required modules load; no customer data packaged');
