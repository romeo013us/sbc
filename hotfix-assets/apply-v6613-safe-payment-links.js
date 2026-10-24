'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6613_SAFE_SQUARE_LINKS';
function patch(source){
 if(source.includes(MARKER))return source;
 const replace=(before,after,name)=>{
  const count=source.split(before).length-1;
  if(count!==1)throw Error(MARKER+': '+name+' expected 1 anchor, got '+count);
  source=source.replace(before,after);
 };
 const prefix=[
  'function payments(){',
  '/* '+MARKER+' */',
  'const links=state.data?.settings?.paymentLinks;',
  'const checkoutLinks={};',
  "if(links&&typeof links==='object'&&!Array.isArray(links)){",
  ' for(const [key,value] of Object.entries(links)){try{',
  "  const url=new URL(String(value||''));",
  "  if(url.protocol!=='https:'||url.username||url.password)continue;",
  "  if(!['square.link','checkout.square.site','square.site','squareup.com'].includes(url.hostname.toLowerCase()))continue;",
  '  checkoutLinks[key]=url.href;',
  ' }catch(_){}}',
  '}',
  'const anyCheckout=Object.keys(checkoutLinks).length>0;',
  'const items='
 ].join('\n');
 replace('function payments(){const links=state.data.settings.paymentLinks;const items=',prefix,'payment function');
 replace('<span class="badge green">SQUARE LINKS READY</span>',
  '<span class="badge ${anyCheckout?\'green\':\'orange\'}">${anyCheckout?\'CHECKOUT LINKS CONFIGURED\':\'SQUARE LINK SETUP NEEDED\'}</span>',
  'readiness badge');
 const bt=String.fromCharCode(96);
 const old='<a class="btn primary wide" href="${links[x[0]]||\'#\'}" ${links[x[0]]?\'target="_blank" rel="noopener"\':\'aria-disabled="true"\'}>${links[x[0]]?\'Open Square Checkout ↗\':\'Square link not configured\'}</a>';
 const safe='${checkoutLinks[x[0]]?'+bt+
  '<a class="btn primary wide" href="${esc(checkoutLinks[x[0]])}" target="_blank" rel="noopener noreferrer">Open Square Checkout ↗</a>'+
  bt+':'+bt+'<span class="btn wide" role="status" aria-disabled="true">Square link not configured</span>'+bt+'}';
 replace(old,safe,'checkout anchor');
 return source;
}
function apply(root){
 const changed=[];
 for(const directory of ['public','browser_public']){
  const file=path.join(root,directory,'app.js');
  if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8'),after=patch(before);
  if(after!==before){fs.writeFileSync(file,after);changed.push(directory+'/app.js');}
 }
 if(!changed.length){
  const p=path.join(root,'public/app.js');
  if(!fs.existsSync(p)||!fs.readFileSync(p,'utf8').includes(MARKER))throw Error(MARKER+': no compatible entrypoint');
 }
 return {marker:MARKER,changed,financialWritesChanged:false};
}
module.exports={MARKER,apply};
