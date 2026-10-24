'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const checks=[];
function check(label,test){assert.ok(test,label);checks.push(label)}
for(const dir of ['public','browser_public']){
 const source=fs.readFileSync(path.join(root,dir,'app.js'),'utf8');
 const start=source.indexOf('function payments(){');
 const end=source.indexOf('\n\nasync function runFullSystemTestOrder',start);
 assert.ok(start>0&&end>start,'Missing payment renderer boundaries in '+dir);
 const code='('+source.slice(start,end).trim()+')()';
 const render=links=>{
  const data={settings:links===undefined?{}:{paymentLinks:links}};
  const state={data};
  const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const money=n=>'$'+Number(n).toFixed(2);
  return vm.runInNewContext(code,{URL,state,esc,money},{timeout:2000});
 };
 let html=render(undefined);
 check(dir+' missing links shows setup',html.includes('SQUARE LINK SETUP NEEDED'));
 check(dir+' missing links never navigates to #',!html.includes('href="#"'));
 check(dir+' eight disabled products',(html.match(/Square link not configured/g)||[]).length===8);
 html=render({starter:'https://square.link/u/abc',basic:'javascript:alert(1)',visibility:'https://square.link.evil.com/u/fake',essentials:'http://square.link/u/notsecure'});
 check(dir+' authentic checkout is clickable',(html.match(/Open Square Checkout/g)||[]).length===1);
 check(dir+' untrusted/unsafe schemes rejected',!html.includes('javascript:')&&!html.includes('square.link.evil.com'));
 check(dir+' does not claim every link ready',!html.includes('SQUARE LINKS READY'));
}
console.log(JSON.stringify({status:'PASS_REAL_PAYMENTS_RENDERER',checks:checks.length,assertions:checks}));
