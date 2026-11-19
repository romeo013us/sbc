'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isPreviewAssetRequest:allow}=require('../enterprise/sbc-ai-preview-edge-allowlist.cjs');
const STEM='/api/website-production/customers/cust_mwmyu55h_7f834d9d/ai-proposals/uploads/up_'+
  'a'.repeat(32)+'/render/'+'B'.repeat(43)+'/';
const req=(route,method='GET')=>({path:route,method});
test('realistic ZIP preview HTML/CSS/JS/images/font paths can reach the ticket verifier without a browser session',()=>{
 for(const file of ['index.html','assets/styles.css','assets/app.js','assets/img/car-art.svg','assets/font.woff2','about.html']){
  assert.equal(allow(req(STEM+file)),true,file);
 }
 assert.equal(allow(req(STEM+'index.html','HEAD')),true);
});
test('download, data APIs, upload, legacy authenticated previews and mutation requests never bypass zero trust',()=>{
 for(const value of [
  '/api/website-production/customers/c1/ai-proposals/uploads',
  '/api/website-production/customers/c1/ai-proposals/uploads/up_'+'a'.repeat(32)+'/download',
  STEM.replace('/render/','/preview/').replace('/'+'B'.repeat(43),'')+'index.html',
  '/api/customers','/api/owner/lead-readiness','/api/payments/square/readiness','/api/website-production/work-orders'
 ])assert.equal(allow(req(value)),false,value);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(allow(req(STEM+'index.html',method)),false,method);
});
test('invalid ticket, escape and non-web files never bypass zero trust',()=>{
 const wrongTickets=['bad','z'.repeat(42),'z'.repeat(44),'z'.repeat(42)+'$'];
 for(const ticket of wrongTickets){
  const pathWithBadTicket=STEM.replace('B'.repeat(43),ticket);
  assert.equal(allow(req(pathWithBadTicket+'index.html')),false);
 }
 for(const asset of ['../original.zip','./index.html','assets/../index.html','assets\\evil.css',
  'assets//app.js','private.env','original.zip','settings.php','index.html/download','assets/x.css/../index.html']){
  assert.equal(allow(req(STEM+asset)),false,asset);
 }
});
test('actual outer middleware dispatches only plausible preview URLs to downstream private grant checker',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const start=server.indexOf('const ZERO_TRUST_PUBLIC_API_ALLOWLIST=');
 assert(start>0,'outer zero-trust gate must exist');
 const gate=server.slice(start,start+900);
 const bypass='if(SBC_PRIVATE_PREVIEW_EDGE.isPreviewAssetRequest(req))return next();';
 assert(gate.includes(bypass),'preview path must be recognized at outer gate');
 assert(gate.indexOf(bypass)<gate.indexOf("if(sessionCookieToken(req)"),
  'ticket path must be considered before rejecting absent login cookies');
 assert(gate.includes("return res.status(401)"),
  'all other API routes remain locked');
 assert(server.includes("const SBC_PRIVATE_PREVIEW_EDGE="));
 assert(server.includes("sbc-ai-preview-edge-allowlist.cjs"));
 // Avoid embedding an inert require(...) string: the release inventory
 // intentionally scans even test text for unresolved CommonJS imports.
});
