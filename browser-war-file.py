from playwright.sync_api import sync_playwright
import json
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--allow-file-access-from-files'])
 for vp in [{'name':'desktop','width':1440,'height':900},{'name':'laptop','width':1280,'height':720},{'name':'mobile','width':390,'height':844}]:
  page=b.new_page(viewport={'width':vp['width'],'height':vp['height']}); ce=[]; pe=[]; fr=[]
  page.on('console',lambda m: ce.append(m.text) if m.type=='error' else None)
  page.on('pageerror',lambda e: pe.append(str(e)))
  page.on('requestfailed',lambda r: fr.append({'url':r.url,'error':r.failure.error_text if r.failure else 'failed'}))
  try: page.goto('file:///mnt/data/war_test/browser_public/index.html',wait_until='domcontentloaded',timeout=15000)
  except Exception as e: pe.append('goto:'+str(e))
  page.wait_for_timeout(2000)
  m=page.evaluate('''()=>({title:document.title,theme:document.body.dataset.theme||null,buttons:document.querySelectorAll('button').length,links:document.querySelectorAll('a').length,inputs:document.querySelectorAll('input,textarea,select').length,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,body:document.body.innerText.slice(0,1800)})''')
  page.screenshot(path=f'/mnt/data/war_test/{vp["name"]}-browser-light.png')
  theme=page.locator('#sbcThemeToggle'); theme_clicked=False
  if theme.count():
   try: theme.click(); page.wait_for_timeout(250); theme_clicked=True; page.screenshot(path=f'/mnt/data/war_test/{vp["name"]}-browser-dark.png')
   except Exception as e: pe.append('theme:'+str(e))
  kim={'launcher':page.locator('#sbcKimLauncher').count()>0,'opened':False,'input':False,'enter':False,'shiftEnter':False}
  if kim['launcher']:
   try:
    page.locator('#sbcKimLauncher').click(); page.wait_for_timeout(200); kim['opened']=page.locator('#sbcAiDock:not(.hidden)').count()>0; kim['input']=page.locator('#sbcAiInput').count()>0
    if kim['input']:
     page.locator('#sbcAiInput').fill('war test'); page.locator('#sbcAiInput').press('Shift+Enter'); kim['shiftEnter']=True; page.locator('#sbcAiInput').press('Enter'); kim['enter']=True
   except Exception as e: pe.append('kim:'+str(e))
  # inspect visible fixed elements and horizontal overflow
  visible=page.evaluate('''()=>[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>40&&r.height>20&&r.top<innerHeight&&r.bottom>0&&s.display!='none'&&s.visibility!='hidden'}).length''')
  results.append({'viewport':vp['name'],'metrics':m,'themeClicked':theme_clicked,'kim':kim,'visibleElementCount':visible,'consoleErrors':ce,'pageErrors':pe,'failedRequests':fr})
  page.close()
 b.close()
print(json.dumps(results,indent=2))
