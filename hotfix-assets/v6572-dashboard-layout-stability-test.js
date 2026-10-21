'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply,MARKER}=require('./apply-v6572-dashboard-layout-stability');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6572-'));
try{
 for(const p of ['public/index.html','browser_public/index.html']){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),'<!doctype html><html><head></head><body><main id="content"></main></body></html>');}
 fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'enterprise'),{recursive:true});
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'65.1.71',description:'old'}));
 fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({version:'65.1.71',packages:{'':{version:'65.1.71'}}}));
 fs.writeFileSync(path.join(root,'config/release-identity.js'),"const RELEASE_VERSION = '65.1.71';");
 fs.writeFileSync(path.join(root,'enterprise/v567-nine-nine.js'),"const ACTIVE_PACKAGE_RELEASE='65.1.71';");
 fs.writeFileSync(path.join(root,'VERSION'),'65.1.71');
 const out=apply(root);assert.equal(out.version,'65.1.72');assert.equal(out.crmWrites,false);assert.equal(out.changed.length,2);
 for(const p of ['public/index.html','browser_public/index.html']){const s=fs.readFileSync(path.join(root,p),'utf8');assert.match(s,new RegExp(MARKER));assert.match(s,/ResizeObserver/);assert.match(s,/minmax\(min\(100%,240px\),1fr\)/);assert.match(s,/sbc-master-header/);assert.match(s,/sbc-firewall-badge/);assert.match(s,/sbc-brain-grid-nexus/);assert.match(s,/repeat\(5,minmax\(0,1fr\)\)/);assert.match(s,/max-width:560px/);assert.equal(apply(root).changed.length,0);}
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'65.1.72');
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8')).packages[''].version,'65.1.72');
 assert.ok(fs.readFileSync(path.join(root,'config/release-identity.js'),'utf8').includes('65.1.72'));
 assert.ok(fs.readFileSync(path.join(root,'enterprise/v567-nine-nine.js'),'utf8').includes('65.1.72'));
 console.log('V65.1.72 dashboard layout stability tests passed.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
