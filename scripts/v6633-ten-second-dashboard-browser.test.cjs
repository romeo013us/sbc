'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: deferred browser fixture requires readonly CI');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const pub=path.join(root,'public');
const cssPaths=['sbc-v6562-executive-dashboard.css','sbc-v6601-reference-cockpit.css','sbc-nav-geometry-v6612.css'];
for(const name of cssPaths)if(!fs.existsSync(path.join(pub,name)))throw Error('MISSING_COMPILED_CSS '+name);
const html=[
 '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
 ...cssPaths.map(f=>'<link rel="stylesheet" href="/'+f+'">'),
 '</head><body><div id="app" class="app">',
 '<aside class="sidebar"><nav><button data-view="dashboard">Home</button></nav></aside>',
 '<main class="main"><div class="topbar">SBC Command Center</div>',
 '<div class="content" id="content">',
 '<div id="primary-overview" class="panel">Executive overview content</div>',
 '<div id="sales-metrics" class="card">Sales metrics</div>',
 '<div id="pipeline" class="panel">Pipeline</div>',
 '</div></main></div><script src="/sbc-nav-geometry-v6612.js"></script>',
 "<script>setTimeout(()=>{const d=document.createElement('section');d.id='sbcProductionControlDashboard';d.textContent='Production dashboard';document.querySelector('#content').appendChild(d)},9000);</script>",
 '</body></html>'
].join('\n');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end(html)}
 const name=url.pathname.slice(1);
 if(!cssPaths.includes(name)&&name!=='sbc-nav-geometry-v6612.js'){res.writeHead(404);return res.end('NO_NETWORK');}
 const f=path.join(pub,name);res.writeHead(200,{'content-type':name.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(f));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:840}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForTimeout(500);
  const measure=()=>page.evaluate(()=>{
   const c=document.getElementById('content'),a=document.getElementById('primary-overview'),m=document.querySelector('#app>.main');
   return {hasDeck:!!document.getElementById('sbcProductionControlDashboard'),contentDisplay:getComputedStyle(c).display,columns:getComputedStyle(c).gridTemplateColumns,mainWidth:Math.round(m.getBoundingClientRect().width),firstCardWidth:Math.round(a.getBoundingClientRect().width),documentWidth:document.documentElement.scrollWidth};
  });
  const before=await measure();
  await page.waitForTimeout(10500);
  const after=await measure();
  console.log('SBC_V6633_TEN_SECOND_LAYOUT',JSON.stringify({before,after}));
  assert.equal(after.hasDeck,true,'production deck appended at nine seconds');
  assert.equal(after.contentDisplay,'block','deferred deck must not turn workspace into 12-track grid');
  assert.ok(after.firstCardWidth>550,'full-width card must not collapse to 70px');
  assert.ok(Math.abs(after.firstCardWidth-before.firstCardWidth)<50,'dashboard width remains stable over ten seconds');
  assert.ok(after.mainWidth>900,'workspace remains wide');
  assert.ok(after.documentWidth<=1369,'no desktop horizontal overflow');
  assert.equal(errors.length,0,errors.join(' | '));
  console.log(JSON.stringify({status:'PASS_SBC_V6633_TEN_SECOND_DEFERRED_GRID',before,after,readOnly:true}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('V6633_DEFERRED_GRID_FAILED',e.stack||e);process.exitCode=1;});