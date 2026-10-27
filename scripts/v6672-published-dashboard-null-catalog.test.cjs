'use strict';
// V66.72: reproduce and eliminate the user's exact Published dashboard crash.
// No credentials, external connections, production writes, or mock-paid orders.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const primary=read('public/app.js'),mirror=read('browser_public/app.js');
assert.equal(primary,mirror,'Published and browser mirror must match');
assert(primary.includes('SBC_V6672_CATALOG_BOOTSTRAP_TRUTH'));
assert(primary.includes('catalog:{packages:[],services:[]},trainingCourse:null'),
 'app must never initialize the current catalog as null');
assert(!primary.includes('catalog:null,trainingCourse:null'));
assert(!primary.includes('state.catalog.packages.map('),
 'all direct package map calls must tolerate uninitialized catalogs');
const a=primary.indexOf('function dashboard(){'),b=primary.indexOf('\nfunction ',a+12);
assert(a>=0&&b>a,'expected production dashboard renderer');
const script=new vm.Script(primary.slice(a,b)+'\ndashboard()',{filename:'compiled-dashboard.js'});
function execute(catalog){
 const context={
  state:{view:'dashboard',data:{customers:[],quotes:[],orders:[],renewals:[],activities:[]},catalog,me:{role:'owner'},aiBriefing:null},
  esc:x=>String(x??''),money:n=>'$'+Number(n||0).toFixed(2),today:()=>'',dt:x=>String(x??'')
 };
 return script.runInNewContext(context,{timeout:2000});
}
for(let i=1;i<=3;i++){
 const catalog=i===1?null:i===2?undefined:{packages:[{name:'SBC Business',price:199}]};
 const html=execute(catalog);
 assert(html.includes('Top SBC packages'),'dashboard must remain renderable without catalog');
 if(i===3)assert(html.includes('SBC Business'),'healthy catalog must still render live packages');
 assert(!html.includes('RENDER ERROR'));
 console.log('[SBC V6672] PASS '+i+'/3 catalog='+String(catalog===null?'null':typeof catalog));
}
const square='<div class="label">SQUARE</div><div class="value">READY</div>';
const twilio='<div class="label">TWILIO</div><div class="value">READY</div>';
assert(!primary.includes(square)&&!primary.includes(twilio),'unverified providers must not be shown as READY');
assert(primary.includes('<div class="label">SQUARE</div><div class="value">VERIFY</div>'));
assert(primary.includes('<div class="label">TWILIO</div><div class="value">VERIFY</div>'));
new vm.Script(primary,{filename:'public/app.js'});
console.log('[SBC V6672] PASS Published null-catalog crash, browser parity, source syntax, honest Square/Twilio labels');
