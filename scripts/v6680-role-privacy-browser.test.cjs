'use strict';
// Chromium synthetic role fixture. Does not access production data or APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('READONLY_CI_REQUIRED');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=html.match(/<style id="sbc-v6679-researcher-workspace">([\s\S]*?)<\/style>/);
const guard=html.match(/<script id="sbc-lorna-least-privilege-ui">([\s\S]*?)<\/script>/);
assert(css&&guard,'compiled role CSS and role controller required');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
function fixture(role){
 return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'
 +'<style>html,body{margin:0}*,*:before,*:after{box-sizing:border-box}#app{display:flex;min-height:100vh}.sidebar{width:220px;flex:0 0 220px;padding:10px;border-right:1px solid #888}.sidebar button{display:block;width:100%}.main{flex:1;min-width:0;padding:16px}.stat{height:50px;margin-bottom:8px;border:1px solid #888}@media(max-width:600px){.sidebar{width:125px;flex-basis:125px}}</style>'
 +'<style id="sbc-v6679-researcher-workspace">'+css[1]+'</style></head><body>'
 +'<div id="app" class="app"><aside class="sidebar"><nav>'
 +'<button data-view="dashboard">Owner dashboard</button><button data-view="leadresearch">Lead Research</button>'
 +'<button data-view="leadverification">Lead Verification</button><button data-view="training">Training</button>'
 +'<button data-view="timeclock">Time Clock</button><button data-view="revenue90">Owner goals</button>'
 +'</nav><div class="sidebar-group-label">OWNER TOOLS</div><div class="sidebar-bottom"><a href="/office-box">Office Box</a></div></aside>'
 +'<main class="main"><div id="viewEyebrow">WORKFORCE</div><div id="content" class="content">'
 +'<div id="leadCard" class="stat">Lead Research Desk</div><div id="leadCard2" class="stat">Drafts and lead verification</div>'
 +'<section id="sbcAgentOSPanel" class="owner-only">Owner finances</section><section id="sbcV329Panel">Company controls</section>'
 +'<section id="sbcV330Panel">Onboarding</section><section id="sbcSalesOperatingModelV6563">Company goals</section>'
 +'</div></main></div>'
 +'<script>window.state={me:{role:'+JSON.stringify(role)+'},view:"'+(role==='owner'?'dashboard':'leadresearch')+'"};window.render=function(){};</script>'
 +'<script>'+guard[1]+'</script></body></html>';
}
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(fixture(req.url.includes('owner')?'owner':'lead_researcher'));});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [390,1366]){
   const context=await browser.newContext({viewport:{width,height:850}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/researcher');
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('sbc:authenticated',{detail:{user:window.state.me}})));
   const a=await page.evaluate(()=>{
    const shown=e=>!!e&&getComputedStyle(e).display!=='none';
    const nav=n=>shown(document.querySelector('[data-view="'+n+'"]'));
    const rect=document.getElementById('leadCard').getBoundingClientRect();
    return {role:document.body.classList.contains('sbc-researcher-mode'),lead:nav('leadresearch'),verify:nav('leadverification'),training:nav('training'),clock:nav('timeclock'),home:nav('dashboard'),revenue:nav('revenue90'),agent:shown(document.getElementById('sbcAgentOSPanel')),enterprise:shown(document.getElementById('sbcV329Panel')),sales:shown(document.getElementById('sbcSalesOperatingModelV6563')),x:rect.x,y:rect.y};
   });
   assert(a.role&&a.lead&&a.verify&&a.training&&a.clock,'researcher sees required tools');
   assert(!a.home&&!a.revenue&&!a.agent&&!a.enterprise&&!a.sales,'researcher hides owner controls');
   await page.evaluate(()=>{for(let i=0;i<20;i++){const x=document.createElement('section');x.className='owner-only';x.id='late-owner-'+i;x.textContent='Owner metrics';document.getElementById('content').prepend(x);}});
   await page.waitForTimeout(350);
   const b=await page.evaluate(()=>{const r=document.getElementById('leadCard').getBoundingClientRect();return {x:r.x,y:r.y,scroll:document.documentElement.scrollWidth,width:innerWidth,hidden:getComputedStyle(document.getElementById('late-owner-0')).display};});
   assert(Math.abs(a.y-b.y)<=2&&Math.abs(a.x-b.x)<=2,'late owner widgets cannot move researcher content');
   assert.equal(b.hidden,'none');
   assert(b.scroll<=b.width+4,'no horizontal overflow');
   assert.deepEqual(errors,[],'no browser errors');
   await page.goto('http://127.0.0.1:'+server.address().port+'/owner');
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('sbc:authenticated',{detail:{user:window.state.me}})));
   const c=await page.evaluate(()=>({role:document.body.classList.contains('sbc-researcher-mode'),sales:getComputedStyle(document.getElementById('sbcSalesOperatingModelV6563')).display,home:getComputedStyle(document.querySelector('[data-view="dashboard"]')).display}));
   assert(!c.role&&c.sales!=='none'&&c.home!=='none','owner view unchanged');
   await context.close();
   console.log('[SBC V6680 CHROMIUM] PASS '+width+'px role privacy, no delayed layout jumps, owner parity');
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
