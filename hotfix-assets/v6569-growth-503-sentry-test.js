'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6569-'));
function put(rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
try{
 const pkg={name:'sbc-business-command-center',version:'65.1.67',scripts:{'test:all':'node bootstrap.js --verify'}};
 const lock={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version,scripts:{}}}};
 put('package.json',JSON.stringify(pkg));put('package-lock.json',JSON.stringify(lock));
 put('server.js',"let   app = express();\nif(e?.code==='SESSION_STORE_UNAVAILABLE'){res.setHeader('Retry-After',String(Math.max(1,Number(e.retryAfterSeconds||1))));return res.status(503).json({error:'Session validation temporarily unavailable.',code:'SESSION_STORE_UNAVAILABLE',retryable:true,retryAfterSeconds:Math.max(1,Number(e.retryAfterSeconds||1)),requestId:req.requestId||null});}\n");
 const r=require('./apply-v6569-growth-503-sentry.js').apply(root);
 assert.equal(r.version,'65.1.68');assert.equal(r.guardsChanged,false);
 const s=get('server.js');
 cp.execFileSync(process.execPath,['--check',path.join(root,'server.js')]);
 assert.match(s,/SBC_V6569_GROWTH_503_SENTRY/);assert.match(s,/growth_status_5xx/);assert.match(s,/SESSION_STORE_UNAVAILABLE/);assert.match(s,/tenantContextPresent/);assert.match(s,/writerLeaseReady/);assert.match(s,/recoveryRequired/);assert.match(s,/res\.status\(503\)/);
 assert.doesNotMatch(s,/req\.headers\.cookie/);assert.doesNotMatch(s,/req\.body/);assert.doesNotMatch(s,/Authorization: Bearer/);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.68');assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.68');
 cp.execFileSync(process.execPath,['--check',path.join(__dirname,'apply-v6569-growth-503-sentry.js')]);
 console.log('[SBC V65.1.68 GROWTH 503 SENTRY] PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
