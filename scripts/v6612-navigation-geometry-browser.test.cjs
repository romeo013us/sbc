'use strict';
// Desktop/mobile layout contract on the exact, post-patch SBC sidebar markup,
// styles and rail JS. No live credentials or data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: navigation audit requires readonly CI');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const source=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sidebar=source.match(/<aside class="sidebar">[\s\S]*?<\/aside>/i)?.[0];
if(!sidebar)throw Error('SIDEBAR_MARKUP_MISSING');
const views=[...sidebar.matchAll(/<button\b[^>]*data-view="([^"]+)"/g)].map(m=>m[1]);
if(views.length<10||!views.includes('dashboard')||!views.includes('customers')||!views.includes('crm'))throw Error('PRIMARY_NAV_ROUTES_MISSING');
const pageHtml='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/sbc-v6574-draggable-nav-rail.css"><link rel="stylesheet" href="/sbc-nav-geometry-v6612.css">'+
 '</head><body><div id="app" class="app v56-app">'+sidebar+
 '<main class="main"><header class="topbar"><button id="mobileMenu" type="button" aria-label="Toggle menu">☰</button><h1>Navigation test workspace</h1></header><div id="content" class="content">Live operator content stays in this column.</div></main></div>'+
 '<script src="/sbc-v6574-draggable-nav-rail.js"></script><script src="/sbc-nav-geometry-v6612.js"></script>'+
 '<script>document.getElementById("mobileMenu").addEventListener("click",function(){document.querySelector(".sidebar").classList.toggle("open")});</script></body></html>';
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://127.0.0.1').pathname;
 if(p==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end(pageHtml);}
 if(!/^\/(?:styles\.css|sbc-v6574-draggable-nav-rail\.(?:js|css)|sbc-nav-geometry-v6612\.(?:js|css))$/.test(p)){res.writeHead(404);return res.end('NOT_FOUND');}
 const file=path.resolve(root,'public',p.slice(1));
 if(!file.startsWith(path.resolve(root,'public')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end('MISSING_ASSET');}
 res.writeHead(200,{'content-type':p.endsWith('.css')?'text/css':'application/javascript'});
 res.end(fs.readFileSync(file));
});
const checks=[];
function pass(name,truth){assert.ok(truth,name);checks.push(name)}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:850}});
  page.setDefaultTimeout(9000);
  page.on('pageerror',e=>console.error('NAV_TEST_PAGE_ERROR',e.message));
  page.on('console',m=>{if(m.type()==='error')console.error('NAV_TEST_CONSOLE_ERROR',m.text());});
  page.on('response',r=>{if(!r.ok())console.error('NAV_TEST_HTTP',r.status(),r.url());});
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
  console.log('NAV_FIXTURE_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({aside:!!document.querySelector('.sidebar'),app:!!document.querySelector('#app.app'),navScripts:[...document.scripts].map(s=>s.src),loaded:Boolean(document.body.classList.contains('sbc-nav-rail-ready')),sidebarOuter:document.querySelector('.sidebar')?.outerHTML.slice(0,240),htmlClass:document.documentElement.className,bodyClass:document.body.className}))));
  await page.locator('.sbc-nav-rail-toggle').waitFor();
  const metrics=()=>page.evaluate(()=>{
   const aside=document.querySelector('#app > .sidebar'),main=document.querySelector('#app > .main');
   const a=aside.getBoundingClientRect(),m=main.getBoundingClientRect();
   return {sidebar:{left:a.left,right:a.right,width:a.width,top:a.top},main:{left:m.left,right:m.right,width:m.width},
    asidePosition:getComputedStyle(aside).position,docWidth:document.documentElement.scrollWidth,viewport:innerWidth,
    asideTransform:getComputedStyle(aside).transform,open:aside.classList.contains('open')};
  });
  await page.waitForTimeout(300); // allow sidebar/main width transition to finish before geometry assertions
  let m=await metrics();
  console.log('NAV_DESKTOP_MEASURE',JSON.stringify(m));
  pass('desktop fixed sidebar, no dead-space gap',m.asidePosition==='fixed'&&Math.abs(m.sidebar.left)<2&&Math.abs(m.main.left-m.sidebar.right)<3);
  pass('desktop workspace fills remaining width',Math.abs(m.main.right-m.viewport)<4&&m.docWidth<=m.viewport+3);
  pass('desktop nav items expose accessible names',await page.locator('.sidebar nav button[data-view]:not([aria-label])').count()===0);
  const toggle=page.locator('.sbc-nav-rail-toggle');
  await toggle.click();
  await page.waitForTimeout(280);
  m=await metrics();
  pass('collapsed sidebar is 64px and content follows it',Math.abs(m.sidebar.width-64)<3&&Math.abs(m.main.left-m.sidebar.right)<3);
  pass('collapsed sidebar cannot create horizontal overflow',m.docWidth<=m.viewport+3);
  pass('collapsed items keep visible icons',await page.locator('.sidebar nav button[data-view="dashboard"] span').evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize)>12));
  await toggle.click();
  await page.waitForTimeout(280);
  m=await metrics();
  pass('expanded sidebar restores 260px and workspace alignment',Math.abs(m.sidebar.width-260)<3&&Math.abs(m.main.left-m.sidebar.right)<3);
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(280);
  m=await metrics();
  pass('mobile workspace uses full width and sidebar is offcanvas',Math.abs(m.main.left)<3&&Math.abs(m.main.right-390)<4&&m.sidebar.right<=3);
  pass('mobile navigation cannot cause horizontal overflow',m.docWidth<=393);
  await page.locator('#mobileMenu').click();
  await page.waitForTimeout(280);
  m=await metrics();
  pass('mobile hamburger opens overlay without moving workspace',m.open&&Math.abs(m.sidebar.left)<3&&Math.abs(m.main.left)<3);
  await page.locator('#content').click();
  await page.waitForTimeout(280);
  m=await metrics();
  pass('mobile outside click closes drawer',!m.open&&m.sidebar.right<=3);
  await page.locator('#mobileMenu').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(280);
  pass('mobile Escape closes drawer',!(await page.locator('.sidebar').evaluate(e=>e.classList.contains('open'))));
  pass('required core navigation entries remain present',views.length>=10&&new Set(views).size===views.length);
  console.log(JSON.stringify({status:'PASS_SBC_NAVIGATION_GEOMETRY',checks,sidebarItems:views.length,mode:'real compiled sidebar and CSS in synthetic fixture'},null,2));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('NAVIGATION_GEOMETRY_GATE_FAILED',e.stack||e);process.exitCode=1});
