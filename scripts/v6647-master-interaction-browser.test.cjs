'use strict';
// Execute actual DOM clicks against the source-compiled F4 controls in isolated
// Chromium. No production credentials, MySQL, outbound calls or payment writes.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: interaction test requires isolated readonly CI');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const MARKER='SBC_V6647_MASTER_INTERACTION_AUDIT';
const files=['fantastic4-launch-os.js','sbc-critical-surfaces-guardian-v56-25-3.js'];
for(const dir of ['public','browser_public']){
 for(const name of files){
  const src=fs.readFileSync(path.join(root,dir,name),'utf8');
  assert.ok(src.includes(MARKER),'Patch absent from '+dir+'/'+name);
  if(name==='fantastic4-launch-os.js'){
   assert.match(src,/window\.f4RevenueVerify=f4RevenueVerify/);
   assert.match(src,/id="f4RevenueActionStatus" role="status" aria-live="polite"/);
  }else{
   assert.doesNotMatch(src,/onclick="window\.f4RevenueVerify\?\.\(\)"/);
   assert.doesNotMatch(src,/onclick="window\.f4RevenueRefresh\?\.\(\)"/);
  }
 }
}
const calls=[];
const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<div id="content">Opening verified owner controls…</div>
<script>
 window.__calls=[];window.__failRevenueStatus=false;window.__failVerify=false;
 window.api=async (url,options)=>{
   window.__calls.push({url,method:options?.method||'GET'});
   if(url==='/api/fantastic4/revenue/verify'){
     if(window.__failVerify)throw Error('Synthetic verification failure');
     return {ok:true,checked:7,passed:5,needsReview:2};
   }
   if(url==='/api/fantastic4/revenue/status'){
     if(window.__failRevenueStatus)throw Error('Synthetic revenue status unavailable');
     return {ok:true,productionOn:true,eligibilityBreakdown:{actionable:5,emailReady:3,smsReady:1,humanCallReady:1,needsVerification:2,unroutable:0}};
   }
   if(url==='/api/fantastic4/summary')return {ok:true,providerGates:{},counts:{}};
   if(url==='/api/fantastic4/alerts')return {ok:true,alerts:[]};
   if(url==='/api/fantastic4/blueprints')return {ok:true,blueprints:[]};
   if(url==='/api/fantastic4/dry-runs')return {ok:true,dryRuns:[]};
   if(url==='/api/fantastic4/architecture')return {ok:true,architecture:{website:'website',commandCenter:'Command Center',officeBox:'Office Box',wordpress:'WordPress'},flow:['Start','Finish']};
   if(url==='/api/fantastic4/autonomous/summary')return {ok:true,paused:false,mode:'GUARDED',metrics:{},exceptions:[]};
   throw Error('No synthetic mock for '+url);
 };
</script>
<script src="/fantastic4-launch-os.js"></script>
<script>window.fantastic4LaunchView().then(html=>{document.getElementById('content').innerHTML=html;}).catch(error=>{document.getElementById('content').textContent=error.message;});</script>
</body></html>`;
(async()=>{
 let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const viewport of [{width:1366,height:800},{width:390,height:844}]){
   const context=await browser.newContext({viewport,serviceWorkers:'block',extraHTTPHeaders:{'x-sbc-runtime-dir':viewport.width===390?'browser_public':'public'}});
   const page=await context.newPage();const errors=[],dialogs=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
   // Network-free synthetic fixture, no local ports and no live API traffic.
   const bare=fixture.slice(0,fixture.indexOf('<script src="/fantastic4-launch-os.js"'))+'</body></html>';
   await page.setContent(bare,{waitUntil:'load'});
   await page.addScriptTag({content:fs.readFileSync(path.join(root,viewport.width===390?'browser_public':'public','fantastic4-launch-os.js'),'utf8')});
   await page.evaluate(()=>window.fantastic4LaunchView().then(html=>{document.getElementById('content').innerHTML=html;}));
   await page.locator('#f4RevenueActionStatus').waitFor();
   assert.equal(await page.locator('button[data-sbc-action="revenue-verify"]').count(),1);
   const missing=await page.evaluate(()=>[...document.querySelectorAll('button[onclick]')].filter(b=>{
    const m=b.getAttribute('onclick').match(/^([A-Za-z_$][\w$]*)\s*\(/);return m&&typeof window[m[1]]!=='function';
   }).map(b=>b.textContent.trim()));
   assert.deepEqual(missing,[],'F4 inline buttons must have bound controller functions');
   await page.locator('button[data-sbc-action="revenue-verify"]').click();
   await page.waitForFunction(()=>document.getElementById('f4RevenueActionStatus')?.textContent.includes('Lead verification complete.'));
   assert.equal(await page.locator('#f4RevenueActionStatus').getAttribute('data-action-state'),'success');
   assert.equal(await page.evaluate(()=>window.__calls.filter(x=>x.url==='/api/fantastic4/revenue/verify').length),1);
   await page.getByRole('button',{name:/CHECK REVENUE STATUS/}).click();
   await page.waitForFunction(()=>document.getElementById('f4RevenueActionStatus')?.textContent.includes('Revenue status checked.'));
   assert.match(await page.locator('#f4RevenueStatus').innerText(),/ACTIONABLE LEADS[\s\S]*5/);
   await page.evaluate(()=>window.__failRevenueStatus=true);
   await page.getByRole('button',{name:/CHECK REVENUE STATUS/}).click();
   await page.waitForFunction(()=>document.getElementById('f4RevenueActionStatus')?.textContent.includes('Revenue status could not be checked'));
   assert.equal(await page.locator('#f4RevenueActionStatus').getAttribute('data-action-state'),'error');
   await page.evaluate(()=>window.__failRevenueStatus=false);
   await page.evaluate(()=>window.__failVerify=true);
   await page.locator('button[data-sbc-action="revenue-verify"]').click();
   await page.waitForFunction(()=>document.getElementById('f4RevenueActionStatus')?.textContent.includes('Lead verification failed'));
   await page.evaluate(()=>{let button=document.createElement('button');button.id='sbcMissingHandler';button.setAttribute('onclick','sbcControllerThatDoesNotExist()');button.textContent='Missing Controller';document.getElementById('content').appendChild(button)});
   await page.locator('#sbcMissingHandler').click();
   assert.ok(dialogs.some(d=>d.includes('No action was performed.')),'Missing handler click must produce explicit notification');
   assert.deepEqual(errors,[],'No uncaught browser errors permitted');
   calls.push({viewport:viewport.width,verifiedClicks:5,dialogCount:dialogs.length,allRenderedActionsBound:true});
   await context.close();
  }
  console.log(JSON.stringify({status:'PASS_MASTER_INTERACTION_BROWSER',scope:'Fantastic4 and guardian revenue controls; synthetic API only',checks:calls},null,2));
 }finally{await browser?.close();}
})().catch(e=>{console.error('MASTER_INTERACTION_BROWSER_FAILED',e.stack||e);process.exitCode=1});