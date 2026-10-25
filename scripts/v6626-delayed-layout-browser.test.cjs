'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: browser layout audit requires readonly CI');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const src=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const sourceBrowser=fs.readFileSync(path.join(root,'browser_public','index.html'),'utf8');
for(const html of [src,sourceBrowser]){
 assert.match(html,/id="sbc-v6626-layout-single-owner"/);
 assert.doesNotMatch(html,/<script\b[^>]*id=["']sbc-v6602-layout-containment["']/i);
 assert.doesNotMatch(html,/<script\b[^>]*id=["']sbc-v6572-layout-observer["']/i);
}
const style=src.match(/<style id="sbc-v6626-layout-single-owner">[\s\S]*?<\/style>/)?.[0];
assert.ok(style,'new static shell CSS missing');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link rel="stylesheet" href="/sbc-v6601-reference-cockpit.css">'+
 '<link rel="stylesheet" href="/sbc-nav-geometry-v6612.css">'+style+
 '</head><body><div id="app" class="app v56-app"><aside class="sidebar"><nav><button data-view="dashboard">Dashboard</button></nav></aside>'+
 '<main class="main"><header class="topbar">SBC Command Center</header><section id="content" class="content">'+
 '<h1 id="primaryDashboard">Production overview</h1><article id="originalDashboardCard">Lead dashboard</article></section></main></div>'+
 '<script src="/sbc-nav-geometry-v6612.js"></script>'+
 '<script>setTimeout(()=>{const el=document.createElement("section");el.id="sbcConsultativeRevenueMount";el.textContent="Consultative Revenue";document.querySelector("#content").appendChild(el)},900);'+
 'setTimeout(()=>{const el=document.createElement("section");el.id="sbcGodTierBroadcastMount";el.textContent="Ten-Brain Revenue";document.querySelector("#content").appendChild(el)},1800);'+
 'setTimeout(()=>{document.getElementById("sbcConsultativeRevenueMount").appendChild(document.createElement("span"))},2600);</script>'+
 '</body></html>';
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://127.0.0.1').pathname;
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
 if(!['/sbc-v6601-reference-cockpit.css','/sbc-nav-geometry-v6612.css','/sbc-nav-geometry-v6612.js'].includes(p)){res.writeHead(404);return res.end('NOT_FOUND');}
 const file=path.resolve(root,'public',p.slice(1));
 if(!file.startsWith(path.resolve(root,'public')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end('MISSING');}
 res.writeHead(200,{'Content-Type':p.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:840}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const measure=()=>page.evaluate(()=>{
   const aside=document.querySelector('#app>.sidebar'),main=document.querySelector('#app>.main'),content=document.querySelector('#content');
   const s=aside.getBoundingClientRect(),m=main.getBoundingClientRect();
   return {asideRight:s.right,mainLeft:m.left,mainRight:m.right,documentWidth:document.documentElement.scrollWidth,
    mountA:document.querySelector('#sbcConsultativeRevenueMount')?.parentElement?.id||null,
    mountB:document.querySelector('#sbcGodTierBroadcastMount')?.parentElement?.id||null,
    navPresent:!!document.querySelector('#app>.sidebar nav button[data-view="dashboard"]'),
    originalPresent:content.contains(document.getElementById('originalDashboardCard'))};
  });
  const first=await measure();
  await page.waitForTimeout(3500);
  const final=await measure();
  assert.equal(errors.length,0,'no layout JavaScript errors: '+errors.join(' | '));
  assert.equal(final.mountA,'content','consultative card remains in main content');
  assert.equal(final.mountB,'content','revenue card remains in main content');
  assert.equal(final.navPresent,true,'sidebar preserved after polling');
  assert.equal(final.originalPresent,true,'original dashboard preserved after late update');
  assert.ok(Math.abs(first.mainLeft-final.mainLeft)<3,'main column must not jump after 3 seconds');
  assert.ok(Math.abs(first.mainRight-final.mainRight)<3,'main column right edge stable');
  assert.ok(Math.abs(final.asideRight-final.mainLeft)<3,'sidebar and main never overlap or split');
  assert.ok(final.documentWidth<=1369,'no new horizontal overflow');
  console.log(JSON.stringify({status:'PASS_SBC_V6626_DEFERRED_LAYOUT',initial:first,afterLateMounts:final,waitMs:3500,readOnly:true}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('SBC_V6626_DELAYED_LAYOUT_FAILED',e.stack||e);process.exitCode=1;});