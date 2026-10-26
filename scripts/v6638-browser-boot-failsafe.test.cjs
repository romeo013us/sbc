'use strict';
// True compiled SBC shell regression: unauthenticated login and authenticated
// bootstrap failure must never strand GoDaddy inside an infinite loading page.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')
 throw Error('REFUSE: shell regression requires isolated read-only CI');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const pub=path.join(root,'public');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
for(const rel of ['public/app.js','browser_public/app.js']){
 const code=fs.readFileSync(path.join(root,rel),'utf8');
 const required=["me=await api('/api/me',{timeoutMs:12000})","state.data=await api('/api/bootstrap',{timeoutMs:18000});","SBC is online, but account data could not load","try{return localStorage.getItem('sbc-theme')||'light'}catch"];
 if(rel==='public/app.js')required.push("const rp=await api('/api/owner/recovery/leads',{timeoutMs:10000});");
 for(const needle of required){
  assert.ok(code.includes(needle),'Startup bound or fallback missing from '+rel+': '+needle);
 }
}
let authenticated=false;
const requests=[];
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 const pathname=u.pathname;
 requests.push(pathname);
 const response=(status,body,type='application/json')=>{
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(type==='application/json'?JSON.stringify(body):body);
 };
 if(pathname==='/api/me'){
  console.log('[SBC MOCK SESSION]',JSON.stringify({authenticated,method:req.method,path:pathname}));
  return authenticated?response(200,{ok:true,configured:true,authenticated:true,user:{id:'synthetic-owner',username:'owner',name:'CI Owner',role:'owner'}})
   :response(401,{error:'Authentication required.'});
 }
 if(pathname==='/api/bootstrap')return response(503,{ok:false,error:'Synthetic account-data service unavailable',code:'CI_DATA_UNAVAILABLE'});
 if(pathname.startsWith('/api/'))return response(404,{error:'CI_SYNTHETIC_NOT_FOUND'});
 const candidate=path.resolve(pub,pathname==='/'?'index.html':pathname.slice(1));
 if(!candidate.startsWith(pub+path.sep)||!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())return response(404,{error:'CI_MISSING_ASSET'});
 const mime=candidate.endsWith('.html')?'text/html':candidate.endsWith('.js')?'application/javascript':candidate.endsWith('.css')?'text/css':candidate.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
 res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(fs.readFileSync(candidate));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,origin='http://127.0.0.1:'+port;
 let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const withSession of [false,true]){
   authenticated=withSession;
   const context=await browser.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});
   const page=await context.newPage();
   page.setDefaultTimeout(12000);
   const unexpected=[];
   page.on('pageerror',e=>console.error('[SBC SHELL PAGE ERROR]',String(e.stack||e.message||e).slice(0,1200)));
   page.on('console',m=>{if(m.type()==='error')console.error('[SBC SHELL CONSOLE]',m.text().slice(0,240))});
   page.on('requestfailed',r=>{
    if(r.url().startsWith(origin)&&r.url().endsWith('/app.js'))unexpected.push('app.js failed to load');
   });
   await page.addInitScript(()=>{
    // Reproduce a sandboxed/strict-privacy preview with unavailable Storage.
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Denied by browser preview','SecurityError')}});
   });
   await page.route('**/*',route=>{
    if(route.request().url().startsWith(origin))return route.continue();
    return route.abort();
   });
   await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:20000});
   if(withSession){
    await page.waitForTimeout(1600);
    const info=await page.evaluate(()=>({
      loginClass:document.querySelector('#login')?.className,
      appClass:document.querySelector('#app')?.className,
      content:document.querySelector('#content')?.innerText?.slice(0,400),
      loginError:document.querySelector('#loginError')?.innerText,
      stateMe:typeof state==='object'?state.me:null,
      hasBoot:typeof boot==='function'
    }));
    console.log('[SBC SHELL DEBUG]',JSON.stringify(info),'seen API calls',JSON.stringify(requests.filter(p=>p.startsWith('/api/')).slice(-35)));
    await page.getByRole('heading',{name:'SBC is online, but account data could not load'}).waitFor({timeout:12000});
    assert.equal(await page.locator('#app').isVisible(),true,'authenticated shell must be visible');
    assert.equal(await page.locator('#login').isVisible(),false,'authenticated shell must not show sign-in');
    assert.equal(await page.getByRole('button',{name:'Retry account data'}).count(),1);
   }else{
    await page.locator('#loginForm').waitFor({state:'visible',timeout:12000});
    assert.equal(await page.locator('#app').isVisible(),false,'unauthenticated app must remain hidden');
    assert.equal(await page.getByRole('button',{name:'Sign in'}).count(),1);
   }
   assert.deepEqual(unexpected,[]);
   console.log('[SBC BOOT BROWSER] PASS '+(withSession?'account-data failure displays retryable authenticated shell':'unauthenticated login remains usable')+' with blocked Storage');
   await context.close();
  }
  assert.ok(requests.includes('/api/me')&&requests.includes('/api/bootstrap'));
  console.log('PASS_REAL_V66_SHELL_BOOT_GUARD');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error('V66_SHELL_BOOT_FAILED',e.stack||e);process.exitCode=1});
