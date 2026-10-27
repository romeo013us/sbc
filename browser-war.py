from playwright.sync_api import sync_playwright
import json, os
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--disable-gpu-sandbox'])
    for vp in [{'name':'desktop','width':1440,'height':900},{'name':'laptop','width':1280,'height':720},{'name':'mobile','width':390,'height':844}]:
        page=browser.new_page(viewport={'width':vp['width'],'height':vp['height']})
        console_errors=[]; page_errors=[]; failed=[]
        page.on('console',lambda m: console_errors.append(m.text) if m.type=='error' else None)
        page.on('pageerror',lambda e: page_errors.append(str(e)))
        page.on('requestfailed',lambda r: failed.append({'url':r.url,'error':r.failure.error_text if r.failure else 'failed'}))
        try: page.goto('http://127.0.0.1:8765/index.html',wait_until='networkidle',timeout=20000)
        except Exception as e: page_errors.append('goto:'+str(e))
        page.wait_for_timeout(1500)
        metrics=page.evaluate('''()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,theme:document.body.getAttribute('data-theme'),buttons:document.querySelectorAll('button').length,links:document.querySelectorAll('a').length,inputs:document.querySelectorAll('input,textarea,select').length,bodyText:document.body.innerText.slice(0,2500)})''')
        page.screenshot(path=f"/mnt/data/war_test/{vp['name']}-light.png")
        toggle=page.locator('#sbcThemeToggle')
        theme_ok=False
        if toggle.count():
            try: toggle.click(); page.wait_for_timeout(250); theme_ok=True; page.screenshot(path=f"/mnt/data/war_test/{vp['name']}-dark.png")
            except Exception as e: page_errors.append('theme:'+str(e))
        kim={'exists':page.locator('#sbcKimLauncher').count()>0,'opened':False,'input':False,'enter':False}
        if kim['exists']:
            try:
                page.locator('#sbcKimLauncher').click(); page.wait_for_timeout(200)
                kim['opened']=page.locator('#sbcAiDock:not(.hidden)').count()>0
                kim['input']=page.locator('#sbcAiInput').count()>0
                if kim['input']:
                    page.locator('#sbcAiInput').fill('war test')
                    page.locator('#sbcAiInput').press('Shift+Enter')
                    page.locator('#sbcAiInput').press('Enter')
                    kim['enter']=True
            except Exception as e: page_errors.append('kim:'+str(e))
        results.append({'viewport':vp['name'],'themeToggleClicked':theme_ok,'metrics':metrics,'kim':kim,'consoleErrors':console_errors,'pageErrors':page_errors,'failedRequests':failed})
        page.close()
    browser.close()
print(json.dumps(results,indent=2))
