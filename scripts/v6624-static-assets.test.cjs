'use strict';
// SBC V66.24: reproduce real HTTP asset delivery without authentication,
// persistent state, payment gateways, or starting the production CRM runtime.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const serverSource=fs.readFileSync(path.join(root,'server.js'),'utf8');
const patchSource=fs.readFileSync(path.join(root,'scripts/v6606-quote-server-hardening.cjs'),'utf8');
const marker='SBC_V6608_PROSPECT_CSV_PRIVACY_GATE';
const anchor=serverSource.indexOf(marker);
assert.ok(anchor>=0,'public CSV privacy guard must remain');
assert.ok(serverSource.slice(anchor+marker.length).startsWith('\napp.use(express.static'),
  'Express static handler must start after a REAL newline, never inside // comment');
assert.ok(!serverSource.includes(marker+'\\napp.use(express.static'),
  'literal backslash-n would comment out the entire static handler');
const generatorMarker=patchSource.lastIndexOf(marker);
assert.ok(generatorMarker>=0,'source patch generator must retain CSV guard');
const generated=patchSource.slice(generatorMarker+marker.length);
assert.ok(generated.startsWith('\\napp.use(express.static'),
  'generator string literal must use a single escaped newline');
assert.ok(!generated.startsWith('\\\\napp.use(express.static'),
  'double escaping recreates the broken production static route');
const begin=serverSource.lastIndexOf('app.use((req,res,next)=>{const name=',anchor);
const end=serverSource.indexOf('// V65.1.3:',anchor);
assert.ok(begin>=0&&end>anchor,'static guard and middleware extraction boundaries');
const app=express();
new Function('app','express','path','__dirname',serverSource.slice(begin,end))(app,express,path,root);
app.get('*',(req,res)=>res.status(200).type('html').send('<!doctype html><title>SPA FALLBACK</title>'));
async function run(){
 const listener=await new Promise(resolve=>{
  const server=app.listen(0,'127.0.0.1',()=>resolve(server));
 });
 try{
  const port=listener.address().port;
  async function request(pathname){
   return new Promise((resolve,reject)=>{
    http.get({hostname:'127.0.0.1',port,path:pathname},res=>{
      const buffers=[];res.on('data',c=>buffers.push(c));
      res.on('end',()=>resolve({status:res.statusCode,type:String(res.headers['content-type']||''),body:Buffer.concat(buffers).toString('utf8')}));
    }).on('error',reject);
   });
  }
  const assets=[
   ['/sbc-light-contrast-v6601.css?v=66.0.1',/text\/css/i],
   ['/sbc-login-controller-v6623.js?v=66.0.23-login-access',/javascript/i],
   ['/app.js?v=66.0.23',/javascript/i],
   ['/vendor/sbc-twilio-voice-sdk-2.18.5.min.js',/javascript/i],
   ['/manifest.webmanifest',/json|manifest/i],
   ['/assets/sbc-logo.jpg',/image\/jpeg/i]
  ];
  for(const [url,mime] of assets){
   const response=await request(url);
   assert.equal(response.status,200,url+' response status');
   assert.match(response.type,mime,url+' MIME type');
   assert.doesNotMatch(response.body,/<!doctype html><title>SPA FALLBACK<\/title>/i,
    url+' must not receive SPA index instead of asset');
   if(url==='/manifest.webmanifest')assert.ok(JSON.parse(response.body).name);
  }
  const denied=await request('/starter-leads/prospects.csv');
  assert.equal(denied.status,404,'prospect CSV remains inaccessible');
  assert.equal(denied.body,'','CSV guard must terminate before SPA fallback');
  console.log('[SBC V6624 STATIC ASSETS] PASS: actual Express HTTP CSS/JS/manifest/logo, CSV blocked, no HTML fallback, generator newline protected');
 }finally{await new Promise((resolve,reject)=>listener.close(e=>e?reject(e):resolve()));}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});