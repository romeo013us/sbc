'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply,MARKER,VERSION}=require('./apply-v6600-release-layout');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6600-'));
try{
 for(const rel of ['public/index.html','browser_public/index.html']){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'<!doctype html><html><head><title>SBC V65.1.61</title><link href="/app.css?v=65.1.61"></head><body><div class="dashboard-viewport"><aside class="navigation-rail-container"></aside><main class="main-content-area"></main></div></body></html>')}
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'sbc-business-command-center',version:'65.1.73'}));
 fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({version:'65.1.73',packages:{'':{version:'65.1.73'}}}));
 const result=apply(root);assert.equal(result.version,VERSION);assert.equal(result.crmWrites,false);assert.equal(result.databaseChanges,false);
 for(const rel of ['public/index.html','browser_public/index.html']){const html=fs.readFileSync(path.join(root,rel),'utf8');assert.ok(html.includes(MARKER));assert.match(html,/grid-template-columns:var\\(--sbc-nav-width\\) minmax\\(0,1fr\\)/);assert.match(html,/app\\.css\\?v=66\\.0\\.0/);assert.doesNotMatch(html,/65\\.1\\.61/)}
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,VERSION);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'))).packages[''].version,VERSION);
 console.log('[SBC V6600] PASS: responsive shell, both HTML entrypoints, and release metadata verified; no database writes.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
