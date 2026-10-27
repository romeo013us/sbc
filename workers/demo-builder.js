'use strict';
const fs=require('fs'),path=require('path');
const RESOURCE_POLICY=require('./tenant-resource-policy');
const ROOT=path.resolve(process.env.SBC_DEMO_SANDBOX_ROOT||path.join(process.cwd(),'sandbox-output'));
const TOKEN=String(process.env.SBC_DEMO_WORKER_TOKEN||'');
if(!TOKEN){process.stderr.write('Demo worker token is not configured');process.exit(78);}
fs.mkdirSync(ROOT,{recursive:true,mode:0o700});
let raw='';let bytes=0;const MAX_INPUT=2*1024*1024;
process.stdin.setEncoding('utf8');process.stdin.on('data',d=>{bytes+=Buffer.byteLength(d);if(bytes<=MAX_INPUT)raw+=d;else{process.stderr.write('Demo worker input limit exceeded');process.exitCode=2;process.stdin.destroy();}});
process.stdin.on('end',()=>{try{const tenantId=String((JSON.parse(raw||'{}').tenantId)||'unknown');const plan=String((JSON.parse(raw||'{}').plan)||'starter');const permit=RESOURCE_POLICY.acquire(tenantId,plan);if(!permit.ok)throw new Error(permit.reason);try{const j=JSON.parse(raw||'{}');if(String(j.workerToken||'')!==TOKEN)throw new Error('Demo worker authentication failed');const slug=String(j.slug||'demo').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,80)||'demo';const target=path.resolve(ROOT,slug+'.html');if(!target.startsWith(ROOT+path.sep))throw new Error('Path boundary rejected');const html=String(j.html||'');if(Buffer.byteLength(html)>1024*1024)throw new Error('Demo HTML output limit exceeded');fs.writeFileSync(target,html,{flag:'w',mode:0o600});process.stdout.write(JSON.stringify({ok:true,file:path.basename(target),bytes:Buffer.byteLength(html),resource:permit}));}finally{RESOURCE_POLICY.release(tenantId)}}catch(e){process.stderr.write(e.message);process.exit(1)}});
