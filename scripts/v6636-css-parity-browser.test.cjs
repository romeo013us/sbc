'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('SBC_V6636: readonly CI required');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const pub=path.join(root,'public'),mirror=path.join(root,'browser_public');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
const m=html.match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/);
if(!m)throw Error('BUNDLED_CSS_MISSING');
const combined=m[1],text=fs.readFileSync(path.join(pub,combined),'utf8');
const original=[...text.matchAll(/\/\* source (\/[a-zA-Z0-9/_-]+\.css) \*\//g)].map(m=>m[1]);
if(original.length<60||original.length>90)throw Error('INVALID_ORIGINAL_CSS_COUNT '+original.length);
if(fs.readFileSync(path.join(mirror,'index.html'),'utf8')!==html)throw Error('SECONDARY_BROWSER_ENTRYPOINT_DIFFERS');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname.slice(1));
 if(!/^[a-zA-Z0-9/_-]+\.css$/.test(name)){res.writeHead(404);return res.end('not found')}
 const filename=path.join(pub,name);
 if(!filename.startsWith(pub+path.sep)||!fs.existsSync(filename)){res.writeHead(404);return res.end('missing CSS '+name)}
 res.writeHead(200,{'content-type':'text/css','cache-control':'no-store'});res.end(fs.readFileSync(filename));
});
const fake=(css)=>['<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
 css.map(src=>'<link rel="stylesheet" href="/'+src.replace(/^\\//,'')+'">').join(''),
 '</head><body><div id="app" class="app">',
 '<aside class="sidebar"><div class="sidebar-inner"><nav><button>Home</button></nav></div></aside>',
 '<main class="main"><header class="topbar">SBC Command Center</header>',
 '<div class="content" id="content"><div class="dashboard">',
 '<div class="sbc-card card panel" id="sample-card">Sales pipeline</div>',
 '<section id="sales" class="panel"><div class="kpi">Performance</div></section>',
 '</div></div></main></div>',
 "<script>setTimeout(()=>{const x=document.createElement('section');x.id='sbcProductionControlDashboard';x.className='card';x.textContent='Production';document.getElementById('content').appendChild(x)},1500);</script>",
 '</body></html>'].join('');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [1366,390]){
   const pages=await Promise.all([browser.newPage({viewport:{width,height:850}}),browser.newPage({viewport:{width,height:850}})]);
   const [before,after]=pages;
   for(const [page,css] of [[before,original],[after,['/'+combined]]]){
    await page.route('**/start',route=>route.fulfill({status:200,contentType:'text/html',body:fake(css)}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/start',{waitUntil:'load'});
   }
   const measure=page=>page.evaluate(()=>{
    const selectors=['#app','.sidebar','.main','#content','.dashboard','#sample-card','#sales','#sbcProductionControlDashboard'];
    const props=['display','position','width','minWidth','maxWidth','overflowX','gridTemplateColumns','gridColumn','color','backgroundColor','marginLeft','paddingLeft','fontSize','boxSizing'];
    const out={scrollWidth:document.documentElement.scrollWidth,rules:[...document.styleSheets].reduce((n,s)=>n+s.cssRules.length,0)};
    for(const selector of selectors){
     const node=document.querySelector(selector);
     if(!node){out[selector]=null;continue;}
     const computed=getComputedStyle(node);
     out[selector]=Object.fromEntries(props.map(p=>[p,computed[p]]));
    }return out;
   });
   for(const ms of [250,1900,12500]){
    await before.waitForTimeout(ms-(before._sbcWait||0));before._sbcWait=ms;
    const [legacy,bundle]=await Promise.all([measure(before),measure(after)]);
    assert.deepEqual(bundle,legacy,'bundled CSS parity failed at viewport '+width+' after '+ms+'ms');
    console.log('SBC_V6636_CSS_PARITY',JSON.stringify({width,ms,panelWidth:bundle['#sample-card']?.width,styleRules:bundle.rules}));
   }
   await Promise.all(pages.map(p=>p.close()));
  }
  console.log('V6636 CSS parity PASS at desktop/mobile through deferred dashboard hydration');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('V6636_CSS_PARITY_FAILED',e.stack||e);process.exitCode=1});