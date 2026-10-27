#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const cp=require('child_process');
const root=path.resolve(__dirname,'..');
function ok(x,m){if(!x)throw new Error(m);console.log('PASS',m)}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
ok(pkg.scripts?.start==='node server.js','GoDaddy start script');
ok(pkg.version===require('../config/release-identity.js').RELEASE_VERSION,'package version matches authoritative release identity');
ok(fs.existsSync(path.join(root,'server.js')),'production server.js exists');
ok(fs.existsSync(path.join(root,'enterprise/kevin/kevin-runtime.cjs')),'Kevin production bridge exists');
ok(fs.existsSync(path.join(root,'enterprise/kevin/kevin-kernel.js')),'Kevin kernel exists');
ok(fs.existsSync(path.join(root,'config/kevin-v63.json')),'Kevin governance config exists');
ok(fs.existsSync(path.join(root,'public/kevin-cockpit.html')),'Kevin cockpit exists');
const r=cp.spawnSync(process.execPath,['--check',path.join(root,'enterprise/kevin/kevin-runtime.cjs')],{encoding:'utf8'});ok(r.status===0,'Kevin bridge syntax');
console.log('SBC LEGACY INTEGRATION COMPATIBILITY GATE: PASS');
