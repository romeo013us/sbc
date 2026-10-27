import { chromium } from 'playwright';
const base='http://127.0.0.1:8765/index.html';
const results=[];
const browser=await chromium.launch({headless:true,args:['--disable-gpu-sandbox']});
for (const vp of [{name:'desktop',width:1440,height:900},{name:'laptop',width:1280,height:720},{name:'mobile',width:390,height:844}]) {
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height}});
  const consoleErrors=[]; const pageErrors=[]; const failed=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
  await page.goto(base,{waitUntil:'networkidle',timeout:20000}).catch(e=>pageErrors.push('goto:'+e.message));
  await page.waitForTimeout(1200);
  const title=await page.title();
  const bodyText=(await page.locator('body').innerText()).slice(0,3000);
  const metrics=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
    scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,
    theme:document.body.getAttribute('data-theme'),
    buttons:[...document.querySelectorAll('button')].length,
    links:[...document.querySelectorAll('a')].length,
    inputs:[...document.querySelectorAll('input,textarea,select')].length,
    dead:[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>20&&r.height>20&&r.top<innerHeight&&r.bottom>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'}).length
  }));
  await page.screenshot({path:`/mnt/data/war_test/${vp.name}-light.png`,fullPage:false});
  // Theme toggle if available
  const toggle=page.locator('#sbcThemeToggle');
  if(await toggle.count()){
    await toggle.click().catch(e=>pageErrors.push('theme-click:'+e.message));
    await page.waitForTimeout(200);
    await page.screenshot({path:`/mnt/data/war_test/${vp.name}-dark.png`,fullPage:false});
  }
  // Kim launcher/dock + keyboard Enter
  const launcher=page.locator('#sbcKimLauncher');
  let kim={exists:await launcher.count(),opened:false,enter:false,input:false};
  if(await launcher.count()){
    await launcher.click().catch(e=>pageErrors.push('kim-launch:'+e.message));
    await page.waitForTimeout(150);
    kim.opened=await page.locator('#sbcAiDock:not(.hidden)').count()>0;
    kim.input=await page.locator('#sbcAiInput').count()>0;
    if(kim.input){
      await page.locator('#sbcAiInput').fill('war test');
      await page.locator('#sbcAiInput').press('Shift+Enter');
      await page.locator('#sbcAiInput').press('Enter');
      kim.enter=true;
    }
  }
  results.push({viewport:vp.name,title,metrics,kim,consoleErrors,pageErrors,failed,bodyText});
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results,null,2));
