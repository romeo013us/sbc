'use strict';
/*
 * Read-only, owner-authenticated GoDaddy PREVIEW browser acceptance.
 * --self-test needs Node core only. --run requires playwright installed in a
 * manual GitHub Actions job and secrets scoped to the dedicated Preview host.
 * One permitted mutation: POST /api/login for session establishment.
 * All other POST/PUT/PATCH/DELETE calls are BLOCKED in the browser context.
 * No customer content, screenshots, requests, usernames or messages saved.
 */
const fs=require('node:fs');
const path=require('node:path');

const forbiddenHosts=new Set([
 'sbcmia.com','www.sbcmia.com','sbcwebsites.com','www.sbcwebsites.com',
 'localhost','127.0.0.1','::1'
]);
function validatePreviewTarget(raw,expectedHost){
 let url;
 try{url=new URL(String(raw||''));}catch{throw Error('SBC_PREVIEW_INVALID_TARGET')}
 const host=String(expectedHost||'').trim().toLowerCase();
 if(url.protocol!=='https:'||!host||host!==url.hostname.toLowerCase()||
  forbiddenHosts.has(host)||url.username||url.password||url.search||url.hash||
  url.pathname!=='/'||url.port){
  throw Error('SBC_PREVIEW_UNSAFE_HOST_OR_TARGET');
 }
 return url;
}
function requestPolicy(method,url,origin){
 let parsed;
 try{parsed=new URL(url);}catch{return 'block'}
 const verb=String(method||'').toUpperCase();
 if(['GET','HEAD','OPTIONS'].includes(verb))return 'allow';
 if(verb==='POST'&&parsed.origin===origin&&
  parsed.pathname==='/api/login'&&!parsed.search&&!parsed.hash)return 'login';
 return 'block';
}
const metricNames=[
 'domReadyMs','loadMs','resourceRequests','requestFailures',
 'http5xx','pageErrors','consoleErrors','blockedWrites','authPosts',
 'mobileOverflowPx','lightContrast','darkContrast'
];
function sanitizeReport(raw){
 const m={};
 for(const k of metricNames){
  const value=raw?.metrics?.[k];
  if(typeof value==='number'&&Number.isFinite(value)&&value>=0)
   m[k]=Math.round(value*100)/100;
 }
 return {
  version:'66',
  status:raw?.status==='PASS'?'PASS':'FAIL',
  metrics:m,
  checks:Array.isArray(raw?.checks)?raw.checks.slice(0,30).filter(x=>/^[a-z0-9_-]{1,40}$/.test(String(x?.key||''))).map(x=>({
   key:x.key,ok:x.ok===true
  })):[]
 };
}
async function runBrowser(){
 const {chromium}=require('playwright');
 const target=validatePreviewTarget(process.env.SBC_PREVIEW_URL,process.env.SBC_PREVIEW_ALLOWED_HOST);
 const username=String(process.env.SBC_PREVIEW_OWNER_USERNAME||'');
 const password=String(process.env.SBC_PREVIEW_OWNER_PASSWORD||'');
 if(!username||!password||process.env.SBC_PREVIEW_READ_ONLY_APPROVED!=='YES')
  throw Error('SBC_PREVIEW_MISSING_APPROVED_CREDENTIALS_OR_READ_ONLY_ACK');
 const metrics={domReadyMs:0,loadMs:0,resourceRequests:0,requestFailures:0,
  http5xx:0,pageErrors:0,consoleErrors:0,blockedWrites:0,authPosts:0,
  mobileOverflowPx:0,lightContrast:0,darkContrast:0};
 const checks=[];
 const check=async(key,fn)=>{
  try{await fn();checks.push({key,ok:true});return true;}
  catch{checks.push({key,ok:false});return false;}
 };
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({
   viewport:{width:1440,height:900},colorScheme:'light',
   serviceWorkers:'block',acceptDownloads:false
  });
  await ctx.route('**/*',async route=>{
   const req=route.request(),verdict=requestPolicy(req.method(),req.url(),target.origin);
   metrics.resourceRequests++;
   if(verdict==='login')metrics.authPosts++;
   if(verdict==='block'){metrics.blockedWrites++;await route.abort('blockedbyclient');return;}
   await route.continue();
  });
  const page=await ctx.newPage();
  page.on('pageerror',()=>{metrics.pageErrors++});
  page.on('console',m=>{if(m.type()==='error')metrics.consoleErrors++});
  page.on('requestfailed',()=>{metrics.requestFailures++});
  page.on('response',r=>{if(r.status()>=500)metrics.http5xx++});
  await check('preview-host',async()=>{
   await page.goto(target.origin+'/',{waitUntil:'domcontentloaded',timeout:30000});
   if(new URL(page.url()).origin!==target.origin)throw Error('wrong browser origin');
   await page.locator('#loginForm').waitFor({state:'visible',timeout:15000});
  });
  if(checks.at(-1)?.ok){
   await check('login-single-post',async()=>{
    await page.locator('#loginUsername').fill(username);
    await page.locator('#loginPassword').fill(password);
    await page.locator('#loginForm button').click();
    await page.waitForFunction(()=>!!document.getElementById('app')&&
      !document.getElementById('app').classList.contains('hidden'),{timeout:30000});
    if(metrics.authPosts!==1)throw Error('login duplicate or not requested');
    if(new URL(page.url()).origin!==target.origin)throw Error('unexpected redirect');
   });
   if(checks.at(-1)?.ok){
    await check('dashboard-navigation',async()=>{
     await page.locator('button[data-view="dashboard"]').first().click();
     await page.locator('#viewTitle').waitFor({state:'visible'});
     if(!(await page.locator('#content').innerText()).trim())throw Error('blank dashboard');
    });
    await check('sales-navigation',async()=>{
     await page.locator('#sbcNavSales > summary').click();
     await page.locator('#sbcNavSales button[data-view="crm"]').click();
     if(!(await page.locator('#viewTitle').innerText()).trim())throw Error('blank sales');
    });
    await check('customer360-navigation',async()=>{
     await page.locator('#sbcAdvancedNav > summary').click();
     await page.locator('#sbcAdvancedNav button[data-view="customers"]').click();
     await page.waitForTimeout(250);
     if(!(await page.locator('#content').innerText()).trim())throw Error('blank customers');
     const loaded=await page.evaluate(()=>Boolean(window.__SBC_V6525_CUSTOMER360_WORKSPACE__));
     if(!loaded)throw Error('customer 360 controller missing');
    });
    await check('manual-dialer-controller',async()=>{
     await page.waitForFunction(()=>Boolean(window.SBCManualDialer),{timeout:8000});
    });
    await check('quick-checkout-modal-readonly',async()=>{
     const button=page.locator('#sbc-quick-checkout-nav-link');
     await button.waitFor({state:'visible',timeout:8000});
     await button.click();
     await page.locator('#modal:not(.hidden)').waitFor({state:'visible',timeout:5000});
     if(!(await page.locator('#modalBody').innerText()).trim())throw Error('empty checkout modal');
     // NO submit, quote creation, Square checkout or payment.
    });
    const measureContrast=async()=>page.evaluate(()=>{
     function rgb(raw){
      const m=String(raw||'').match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
      return m?[+m[1],+m[2],+m[3]]:null;
     }
     function lum(v){
      return v.map(n=>{let x=n/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4})
       .reduce((a,n,i)=>a+n*[0.2126,0.7152,0.0722][i],0);
     }
     const label=document.querySelector('#modal:not(.hidden) #modalBody label');
     if(!label) return 0;
     const fg=rgb(getComputedStyle(label).color);if(!fg)return 0;
     let bg=null,el=label;
     while(el){
      const style=getComputedStyle(el);
      if(style.backgroundColor&&!style.backgroundColor.includes('0)')&&
        style.backgroundColor!=='transparent'){bg=rgb(style.backgroundColor);if(bg)break;}
      el=el.parentElement;
     }
     if(!bg)bg=[255,255,255];
     const x=lum(fg),y=lum(bg);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
    });
    await check('light-contrast',async()=>{
     metrics.lightContrast=await measureContrast();
     if(metrics.lightContrast<4.5)throw Error('light mode label contrast');
    });
    await check('dark-contrast',async()=>{
     await page.locator('#sbcThemeToggle').click();
     metrics.darkContrast=await measureContrast();
     if(metrics.darkContrast<4.5)throw Error('dark mode label contrast');
    });
    await check('mobile-overflow',async()=>{
     await page.setViewportSize({width:390,height:844});
     metrics.mobileOverflowPx=await page.evaluate(()=>
      Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
     if(metrics.mobileOverflowPx>12)throw Error('mobile viewport overflow');
    });
    await check('browser-errors',async()=>{
     if(metrics.pageErrors||metrics.consoleErrors||metrics.http5xx)
      throw Error('browser errors or server 5xx observed');
    });
    await check('read-only-barrier',async()=>{
     if(metrics.blockedWrites||metrics.authPosts!==1)
      throw Error('additional mutation attempted or duplicate login');
    });
   }
  }
  const nav=await page.evaluate(()=>{
   const n=performance.getEntriesByType('navigation')[0];
   return {domReadyMs:n?.domContentLoadedEventEnd||0,loadMs:n?.loadEventEnd||0};
  });
  metrics.domReadyMs=nav.domReadyMs;metrics.loadMs=nav.loadMs;
  await ctx.close();
 }finally{await browser.close();}
 const report=sanitizeReport({status:checks.length===11&&checks.every(x=>x.ok)?'PASS':'FAIL',
  metrics,checks});
 const dest=path.resolve('sbc-preview-browser-evidence.json');
 fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 process.stdout.write('[SBC V66 PREVIEW] '+report.status+'; checks '+
  checks.filter(x=>x.ok).length+'/'+checks.length+'; report saved (no customer data)\n');
 if(report.status!=='PASS')process.exitCode=1;
}
if(require.main===module){
 const mode=process.argv[2];
 if(mode==='--self-test'){
  try{
   const u=validatePreviewTarget('https://preview.example.test/','preview.example.test');
   if(requestPolicy('POST',u.origin+'/api/login',u.origin)!=='login'||
    requestPolicy('POST',u.origin+'/api/communications/email',u.origin)!=='block')
    throw Error('Unsafe browser request policy');
   console.log('[SBC V66 PREVIEW] independent policy self-test PASS');
  }catch(e){console.error('SBC_PREVIEW_SELF_TEST_FAILURE');process.exitCode=1;}
 }else if(mode==='--run'){
  runBrowser().catch(()=>{
   console.error('[SBC V66 PREVIEW] FAIL: target, credentials, browser or startup. No sensitive details logged.');
   process.exitCode=1;
  });
 }else{
  console.error('Usage: node scripts/v66-preview-browser-acceptance.cjs --self-test|--run');
  process.exitCode=2;
 }
}
module.exports={validatePreviewTarget,requestPolicy,sanitizeReport};
