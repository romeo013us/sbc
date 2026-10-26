'use strict';
// Real Chromium validation: static synthetic page, mocked same-origin JSON, no external traffic.
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const H=require(path.join(root,'enterprise/v6662-client-hub-security.cjs'));
const playwright=require(process.env.SBC_PLAYWRIGHT_PATH||'playwright');
const token='e3'.repeat(24),site='https://sbc-client-test.invalid',pageData=H.render(token);
const EVIL='<img src=x onerror="window.__sbcInjected=true">';
const response={
 customer:{contactName:EVIL,businessName:'SBC <svg onload=alert(1)>'},
 company:{name:'Successful By Choice',phone:'(305) 555-0100',email:'support@example.test'},
 projects:[{packageName:'<script>window.__sbcInjected=true</script>',status:'Pending',steps:[{name:EVIL,status:'Completed'}]}],
 tickets:[{subject:'Example'}]
};
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1365,height:768},{width:390,height:844}]){
   const context=await browser.newContext({viewport});
   const page=await context.newPage();
   let accessed=0,other=0;
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==site){other++;return route.abort();}
    if(u.pathname==='/client/'+token)return route.fulfill({
     status:200,contentType:'text/html',headers:{'content-security-policy':pageData.csp,'cache-control':'no-store','referrer-policy':'no-referrer'},body:pageData.html
    });
    if(u.pathname==='/api/public/client/'+token){accessed++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});}
    if(u.pathname==='/assets/sbc-logo.jpg')return route.fulfill({status:200,contentType:'image/jpeg',body:Buffer.from([0xff,0xd8,0xff,0xd9])});
    other++;return route.abort();
   });
   await page.goto(site+'/client/'+token,{waitUntil:'domcontentloaded'});
   await page.locator('h1').waitFor({timeout:8000});
   const heading=await page.locator('h1').textContent();
   assert.ok(heading.includes(EVIL),'untrusted contact text must render verbatim, not as markup');
   assert.equal(await page.locator('script').count(),1,'only the controlled nonce script is executable');
   assert.equal(await page.locator('img').count(),1,'untrusted image payload did not create DOM elements');
   const injected=await page.evaluate(()=>window.__sbcInjected);
   assert.equal(injected,undefined,'no customer-provided JavaScript executed');
   assert.ok(await page.getByText('1 support request(s) on file.').isVisible());
   assert.ok(accessed>=1,'customer hub fetched same-origin token protected API');
   assert.equal(other,0,'no unexpected external requests');
   const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(geometry.scrollWidth<=geometry.width+4,'client hub has no major horizontal overflow at '+viewport.width);
   await context.close();
  }
  console.log('[SBC V6662 CHROMIUM] PASS '+String(process.env.SBC_AUDIT_PASS||'1')+': script injection blocked, CSP enforced, no external requests, desktop/mobile stable');
 }finally{await browser.close();}
})().catch(e=>{console.error('[SBC V6662 CHROMIUM] FAIL',e.stack||e);process.exitCode=1});
