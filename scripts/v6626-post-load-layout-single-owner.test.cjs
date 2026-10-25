'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply,MARKER}=require('../hotfix-assets/apply-v6626-post-load-layout-single-owner.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6626-'));
try{
 for(const dir of ['public','browser_public']){
  const base=path.join(root,dir);fs.mkdirSync(base,{recursive:true});
  fs.writeFileSync(path.join(base,'index.html'),[
   '<!doctype html><html><head><title>SBC</title></head><body><div id="app" class="app">',
   '<aside class="sidebar">Navigation</aside><main class="main"><header class="topbar">Dashboard</header><div class="content">Workspace</div></main></div>',
   '<script id="sbc-v6572-layout-observer">new ResizeObserver(()=>document.querySelector(".main").style.width="300px");</script>',
   '<script id="sbc-v6602-layout-containment">new MutationObserver(()=>document.querySelector(".sidebar").remove());</script>',
   '<link rel="stylesheet" href="/sbc-v6601-reference-cockpit.css">',
   '<script src="/sbc-nav-geometry-v6612.js"></script></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(base,'consultative-revenue-v56-13-5.js'),"/* SBC_V6603_CONSULTATIVE_SINGLETON */target.appendChild(el)");
  fs.writeFileSync(path.join(base,'god-tier-broadcast-v56-13-4.js'),"/* SBC_V6603_BROADCAST_SINGLETON */target.appendChild(el)");
 }
 const out=apply(root);
 assert.equal(out.crmWrites,false);
 assert.equal(out.htmlOnly,true);
 assert.equal(out.removedWholeDocumentMutation,true);
 for(const dir of ['public','browser_public']){
  const s=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  assert.match(s,/sbc-v6626-layout-single-owner/);
  assert.doesNotMatch(s,/<script\b[^>]*id="sbc-v6602-layout-containment"/i);
  assert.doesNotMatch(s,/<script\b[^>]*id="sbc-v6572-layout-observer"/i);
  assert.match(s,/sbc-nav-geometry-v6612\.js/);
  assert.match(s,/<aside class="sidebar">Navigation<\/aside>/);
 }
 assert.throws(()=>apply(root),/repeated patch/);
 console.log('SBC V6626 delayed DOM layout conflict removal regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}