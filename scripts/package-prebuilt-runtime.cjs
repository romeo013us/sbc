'use strict';
// Must run after isolated CI source, browser, and disposable MySQL gates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {buildFingerprint}=require('./runtime-build-fingerprint.cjs');
const {ARCHIVE,MANIFEST,readManifest}=require('./prebuilt-runtime.cjs');
const root=path.resolve(__dirname,'..');
const target=path.resolve(process.env.SBC_PREBUILT_SOURCE||path.join(root,'.sbc-isolated-runtime'));
if(process.env.CI!=='true'||process.env.SBC_PREBUILT_ISOLATED!=='1')
 throw Error('REFUSE: prebuilt packaging requires isolated CI verification');
if(!target.startsWith(root+path.sep)||!fs.existsSync(path.join(target,'server.js'))||
 !fs.existsSync(path.join(target,'public/index.html'))||
 !fs.existsSync(path.join(target,'browser_public/index.html')))
 throw Error('REFUSE: checked compiled runtime is unavailable');
const archive=path.join(root,ARCHIVE),receipt=path.join(root,MANIFEST);
const p=cp.spawnSync('python3',[path.join(__dirname,'package-prebuilt-runtime.py'),target,archive],{cwd:root,encoding:'utf8',timeout:120000});
if(p.status!==0)throw Error('Prebuilt archiving failed: '+(p.stderr||p.error?.message||p.stdout));
console.log(p.stdout.trim());
const bytes=fs.readFileSync(archive);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
const manifest={schema:1,version:'66.0.0',archive:ARCHIVE,archiveSha256:sha,
 sourceFingerprint:buildFingerprint(root),sourceCommit:String(process.env.GITHUB_SHA||'').slice(0,40),
 generatedBy:'isolated-github-ci'};
fs.writeFileSync(receipt,JSON.stringify(manifest,null,2)+'\n');
readManifest(root);
console.log('[SBC PREBUILT PACKAGE] PASS '+sha+' '+bytes.length+' bytes');
