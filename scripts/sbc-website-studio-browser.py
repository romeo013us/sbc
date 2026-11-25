"""Rendered acceptance for generated SBC websites. Synthetic, no network or publish."""
import json, os, shutil, subprocess, tempfile
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
FIXTURES=r'''
const {createPrivateConcept}=require('./enterprise/website-studio/index.cjs');
const {compileMultiPageConcept}=require('./enterprise/website-studio/multi-page-concept.cjs');
const {createDraftConcept}=require('./enterprise/website-studio/draft-concept.cjs');
const {checkPrivateBundle}=require('./enterprise/website-studio/qa-gate.cjs');
const assert=require('node:assert/strict');
const categories=['Window Tinting','Hair Salon','Restaurant','Roofing Contractor','Insurance Agency','Neighborhood Store'];
const out={};
for(const [i,category] of categories.entries()){
 const profile={schemaVersion:1,business:{name:'Example '+category,category,city:'Miami',region:'FL'},services:[{name:'First confirmed service',description:'Example service details confirmed for this synthetic fixture.',provenance:{kind:'owner_confirmed'}},{name:'Second confirmed service',description:'Another confirmed example.',provenance:{kind:'owner_confirmed'}}],reviews:[],contact:{phone:'305-555-0110',email:'office@example.test'},verification:{approvedBy:'synthetic-owner',approvedAt:'2026-11-01T00:00:00Z'}};
 const {bundle}=createPrivateConcept({verified_profile:profile,quoteEstimatorEnabled:true});
 out['industry-'+i]=bundle;
 if(i===0)out['multi-page']=compileMultiPageConcept({profile,bundle,offerTier:'essentials'});
}
out.draft=createDraftConcept({status:'Draft',industry:'Barber Shop',customer:{businessName:'Example Draft',city:'Miami'}}).bundle;
for(const [name,bundle] of Object.entries(out)){assert.equal(bundle.publicationReady,false);const qa=checkPrivateBundle(bundle);assert(qa.passed,name+': '+qa.issues.join(','));}
process.stdout.write(JSON.stringify(out));
'''
def run():
    bundles=json.loads(subprocess.check_output(['node','-e',FIXTURES],cwd=ROOT,text=True))
    evidence=Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir()))/'sbc-studio-browser-proof'
    evidence.mkdir(parents=True,exist_ok=True)
    failures,results=[],[]
    with sync_playwright() as p:
        executable=os.environ.get('CHROME_BIN') or shutil.which('google-chrome') or shutil.which('chromium')
        if not executable: raise RuntimeError('Chromium executable is required')
        browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            for name,bundle in bundles.items():
                files=bundle['files']
                for width,height in [(1440,900),(768,1024),(390,844)]:
                    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce',service_workers='block')
                    unexpected=[]
                    def respond(route):
                        req=route.request
                        url=urlsplit(req.url);file=url.path.lstrip('/')
                        if url.scheme=='https' and url.netloc=='studio.test' and req.method=='GET' and not url.query and file=='favicon.ico' and file not in files:
                            route.fulfill(status=204,body='');return
                        if url.scheme!='https' or url.netloc!='studio.test' or req.method!='GET' or url.query or file not in files:
                            unexpected.append(req.method+' '+req.url);route.abort();return
                        mime={'html':'text/html','css':'text/css','js':'application/javascript','json':'application/json'}.get(file.rsplit('.',1)[-1],'text/plain')
                        route.fulfill(status=200,content_type=mime+'; charset=utf-8',body=files[file])
                    context.route('**/*',respond)
                    page=context.new_page();page.set_default_timeout(5000)
                    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                    for file in [f for f in files if f.endswith('.html')]:
                        label=f'{name}/{file}/{width}'
                        errors.clear();unexpected.clear()
                        try:
                            page.goto('https://studio.test/'+file,wait_until='load')
                            page.evaluate('document.fonts.ready')
                            assert page.locator('h1').count()==1 and page.locator('h1').is_visible(),'missing visible page heading'
                            assert page.locator('main').count()==1,'missing main landmark'
                            assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow,noarchive','indexing guard'
                            assert page.evaluate('Array.from(document.styleSheets).some(s=>s.href && s.href.endsWith("/styles.css") && s.cssRules.length>0)'),'stylesheet not loaded'
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),'horizontal overflow'
                            toggle=page.locator('[data-nav-toggle]');nav=page.locator('#main-nav')
                            if toggle.is_visible():
                                toggle.focus();page.keyboard.press('Enter')
                                assert toggle.get_attribute('aria-expanded')=='true' and nav.is_visible(),'keyboard menu open'
                                nav.locator('a').first.focus();page.keyboard.press('Escape')
                                assert toggle.get_attribute('aria-expanded')=='false' and not nav.is_visible(),'Escape must close mobile navigation'
                                assert toggle.evaluate('(el)=>el===document.activeElement'),'Escape must restore focus'
                                toggle.click()
                            link=nav.locator('a[href="contact.html"],a[href="#contact"]').first
                            assert link.count()==1 and link.is_visible(),'contact link missing'
                            dest=link.get_attribute('href');link.click()
                            page.wait_for_url('**/contact.html' if dest=='contact.html' else '**#contact')
                            if dest=='#contact': assert page.locator('#contact').count()==1,'contact target missing'
                            page.goto('https://studio.test/'+file,wait_until='load')
                            form=page.locator('[data-quote-preview]')
                            if form.count():
                                form.locator('input[type=checkbox]').first.check()
                                assert '1 service selected' in form.locator('[data-quote-count]').inner_text(),'quote count'
                                form.locator('[data-quote-prepare]').click()
                                assert 'No message has been sent' in form.locator('[data-quote-status]').inner_text(),'quote preview acknowledgement'
                                assert form.evaluate('(el)=>!el.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))'),'private quote form must prevent default submission'
                            assert not errors,'runtime error: '+str(errors)
                            assert not unexpected,'unexpected request: '+str(unexpected)
                            if name in ('industry-0','industry-1','multi-page') and file=='index.html' and width in (1440,390):
                                page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(evidence/f'{name}-{width}.png'),full_page=True,animations='disabled')
                            results.append(label);print('PASS',label,flush=True)
                        except Exception as exc:
                            failures.append({'case':label,'error':str(exc)});print('FAIL',label,str(exc),flush=True)
                    context.close()
        finally: browser.close()
    report={'scope':'SYNTHETIC_RENDERED_ACCEPTANCE_ONLY','passed':not failures,'casesPassed':len(results),'casesFailed':len(failures),'results':results,'failures':failures,'publicationReady':False}
    (evidence/'results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));return 1 if failures else 0
if __name__=='__main__': raise SystemExit(run())
