"""Exercise the actual display controller in a network-isolated Chromium fixture.
This is a UI contract test, not a hosted production or authentication test.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
JS=ROOT/'public/sbc-command-center-focus-v1.js'
HTML=(ROOT/'public/index.html').read_text()
STYLE=re.search(r'<style id="sbc-owner-clean-display-v2">([\s\S]*?)</style>',HTML).group(1)
FIXTURE="""<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="app"><aside class="sidebar"><nav class="v56-primary-nav">
<button class="nav-item" data-view="dashboard"><span>H</span>Home</button>
<button id="sbc-website-production-nav">Website production</button>
<details><summary>Sales</summary><button class="nav-item" data-view="crm">Sales</button></details>
<details><summary>Operations</summary><button class="nav-item" data-view="orders">Orders</button><button class="nav-item" data-view="workforce">Team</button></details>
<details id="sbcAdvancedNav"><summary>Advanced</summary><div class="v56-legacy-tools">
<button class="nav-item" data-view="customers">Customers</button>
<button class="nav-item" data-view="acquisition">Acquisition</button>
<button class="nav-item" data-view="training">Training</button>
</div></details></nav><div class="sidebar-bottom"><button id="logoutBtn">Sign out</button></div></aside>
<main><header class="topbar"><div class="top-actions">
<button id="sbc-revenue-today-owner">Revenue today</button>
<button id="sbc-website-call-desk-topbar">Website call desk</button>
<button id="sbc-connected-journey-owner">Customer journey</button>
<button id="sbc-website-sales-pipeline-topbar" hidden>Pipeline restricted</button>
<button id="sbcThemeToggle">Theme</button></div></header>
<div id="content">
<section id="sbcV56240GrowthHardening">Growth</section><section id="sbcSalesOperatingModelV6563">Old hiring plan</section>
<div class="hero"><div class="hero-actions"><button id="daily1">New Lead</button><button id="daily2">Quote</button><button id="daily3">Checkout</button><button id="daily4">Order</button></div></div>
<section id="sbcProductionControlDashboard">Production</section>
<div class="card section ai-role-briefing"><button id="briefing">Kim briefing</button></div>
<div class="grid stats" data-sbc-owner-legacy-daily>Live stats</div>
<div class="card"><div class="card-head"><h2>Upcoming attention</h2></div></div>
<div class="grid two section"><div class="card"><div class="card-head"><h2>Recent activity</h2></div><button id="activity">Activity</button></div>
<div class="card"><div class="card-head"><h2>Internal package catalog · includes legacy offers</h2></div></div></div>
</div><section id="sbcGodTierBroadcastMount">Old revenue</section><section id="sbcConsultativeRevenueMount">Old solution engine</section><section id="sbcV329Panel">Legacy enterprise</section><section id="sbcV330Panel">Legacy launch</section></main></div>
<script>
window.state={me:{role:'owner'},view:'dashboard',data:{recovery:{required:false}}};
window.calls=0;document.getElementById('sbc-connected-journey-owner').onclick=()=>window.calls++;
localStorage.setItem('sbc-focus-workspace-v1','all');
</script></body></html>"""
def run(browser,viewport):
    page=browser.new_page(viewport=viewport)
    def route_handler(route):
        if route.request.url=='https://sbc-cleanup.fixture.test/':
            route.fulfill(status=200,content_type='text/html; charset=utf-8',body=FIXTURE)
        else:
            route.abort()
    page.route('**/*',route_handler)
    page.goto('https://sbc-cleanup.fixture.test/')
    page.add_style_tag(content=(ROOT/'public/sbc-command-center-focus-v1.css').read_text()+STYLE)
    page.add_script_tag(path=str(JS))
    page.wait_for_function("document.documentElement.dataset.sbcOwnerClean==='true'")
    assert page.locator('#sbcFocusNav > button').count()==8
    assert page.locator('#sbcProductionControlDashboard').is_visible()
    assert page.locator('#daily3').is_visible(), 'checkout must not be hidden by arbitrary action folding'
    assert page.evaluate('document.characterSet')=='UTF-8'
    assert page.locator('h2', has_text='Internal package catalog · includes legacy offers').count()==1
    assert page.locator('details[data-sbc-owner-dashboard-detail="briefing"]').count()==1
    assert page.locator('details[data-sbc-owner-dashboard-detail="reference"]').count()==1
    assert page.locator('details[data-sbc-owner-dashboard-detail]').count()==2
    assert not page.locator('#activity').is_visible()
    legacy=['#sbcV56240GrowthHardening','#sbcSalesOperatingModelV6563','#sbcGodTierBroadcastMount','#sbcConsultativeRevenueMount']
    for panel in legacy:
        assert not page.locator(panel).is_visible(), panel
    page.evaluate("window.state.view='customers';window.dispatchEvent(new Event('sbc:view-rendered'))")
    for panel in legacy:
        assert not page.locator(panel).is_visible(), panel+' on Leads & Accounts'
    page.evaluate("window.state.view='dashboard';window.dispatchEvent(new Event('sbc:view-rendered'))")
    assert not page.locator('#sbcV329Panel').is_visible()
    assert not page.locator('#sbcV330Panel').is_visible()
    assert page.locator('#sbc-revenue-today-owner').is_visible()
    # Exercise the actual homepage renderer and shared payment evidence classifier.
    daily=re.search(r'/\* SBC_OWNER_DAILY_HOME_BEGIN \*/([\s\S]*?)/\* SBC_OWNER_DAILY_HOME_END \*/',(ROOT/'public/app.js').read_text()).group(1)
    ops=(ROOT/'public/v32-2-upgrade.js').read_text()
    capture=ops[ops.index('function recordedSquareCapture('):ops.index('  function metrics(){')]
    page.add_script_tag(content=capture+'\n'+daily)
    page.evaluate("""() => {
        const paid={price:199,squareOrderId:'o1',squarePaymentId:'p1',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-26T05:10:00Z'};
        Object.assign(window.state.data,{orders:[paid,{...paid}],quotes:[{status:'Won',total:999}],customers:[],tasks:[],appointments:[],users:[]});
        document.querySelector('#content').insertAdjacentHTML('afterbegin',sbcOwnerDailyMarkup(window.state,new Date('2026-11-26T05:30:00Z')));
        window.sbcNavigate=(view)=>{window.lastDailyRoute=view};
    }""")
    home=page.locator('#sbc-owner-daily-home')
    assert home.is_visible()
    assert home.locator('[data-sbc-owner-daily-card]').count()==6
    assert '$199.00' in home.locator('[data-sbc-owner-daily-card="revenue"]').inner_text()
    assert '$600.00' in home.locator('[data-sbc-owner-daily-card="revenue"]').inner_text()
    assert not page.locator('[data-sbc-owner-legacy-daily]').is_visible()
    columns=home.evaluate("e => getComputedStyle(e).gridTemplateColumns.split(' ').length")
    assert columns==(1 if viewport['width']<=760 else 2)
    home.get_by_role('button',name='Payments',exact=True).click()
    assert page.evaluate('window.lastDailyRoute')=='payments'
    assert 'Administration & System Tools' in page.locator('#sbcAdvancedNav > summary').inner_text()
    page.locator('#sbcOwnerExtraShortcuts summary').click()
    assert page.locator('#sbc-connected-journey-owner').is_visible()
    assert not page.locator('#sbc-website-sales-pipeline-topbar').is_visible(), 'do not override existing hidden permission state'
    page.locator('#sbc-connected-journey-owner').click()
    assert page.evaluate('window.calls')==1
    page.evaluate("""() => {const b=document.createElement('button');b.id='lateLegacyNav';b.textContent='Legacy report';document.querySelector('nav.v56-primary-nav').appendChild(b);}""")
    page.wait_for_function("document.querySelector('#sbcAdvancedNav #lateLegacyNav')!==null")

    # Lazy-mounted primary navigation remains primary; original handlers and
    # explicit role-hidden state survive relocation, unlike a new duplicate button.
    page.evaluate("""() => {
        const p=document.getElementById('sbc-website-production-nav');
        p.hidden=true;p.onclick=()=>window.productionClicks=(window.productionClicks||0)+1;
        document.querySelector('nav.v56-primary-nav').appendChild(p);
    }""")
    page.wait_for_function("document.querySelector('#sbcFocusNav > #sbc-website-production-nav')!==null")
    assert not page.locator('#sbc-website-production-nav').is_visible()
    page.evaluate("""() => {
        const p=document.getElementById('sbc-website-production-nav');
        p.hidden=false;document.querySelector('.sbc-focus-secondary').appendChild(p);
    }""")
    page.wait_for_function("document.querySelector('#sbcFocusNav > #sbc-website-production-nav')!==null")
    assert page.locator('#sbc-website-production-nav').count()==1
    page.locator('#sbc-website-production-nav').click()
    assert page.evaluate('window.productionClicks')==1

    page.evaluate("""() => {window.state.data.recovery.required=true;window.dispatchEvent(new Event('sbc:view-rendered'));}""")
    for panel in legacy:
        assert page.locator(panel).is_visible(), panel+' during recovery'
    assert page.locator('#sbcV329Panel').is_visible()
    assert page.locator('#sbcV330Panel').is_visible()
    assert not home.is_visible()
    assert page.locator('[data-sbc-owner-legacy-daily]').is_visible()
    assert page.locator('#activity').is_visible()
    page.evaluate("""() => {window.state.data.recovery.required=false;window.SBC_COMMAND_FOCUS.showAll();}""")
    for panel in legacy:
        assert page.locator(panel).is_visible(), panel+' in Show all tools'
    assert page.locator('#sbcOwnerExtraShortcuts').count()==0
    assert page.locator('.top-actions > #sbc-connected-journey-owner').is_visible()
    assert page.locator('#sbcAdvancedNav').get_attribute('open') is not None
    assert not home.is_visible()
    assert page.locator('[data-sbc-owner-legacy-daily]').is_visible()
    assert page.locator('#activity').is_visible()
    page.evaluate("""() => {window.state.me={role:'account_manager'};window.dispatchEvent(new Event('sbc:authenticated'));}""")
    assert page.evaluate("document.documentElement.dataset.sbcOwnerClean")=='false'
    assert page.evaluate("localStorage.getItem('sbc-focus-workspace-v1')")=='all'
    assert page.locator('details[data-sbc-owner-dashboard-detail]').count()==0
    page.close()

def run_cascade(browser,viewport):
    """Use the actual release CSS, including the legacy forced-grid rules."""
    page=browser.new_page(viewport=viewport)
    page.set_content('''<html data-sbc-owner-routine="true"><body><div id="app" class="app"><main class="main"><div id="content" class="content"><section id="sbc-owner-daily-home">Six cards</section><div id="sbcProductionControlDashboard">Production</div><div id="legacyGrid" class="grid two section" data-sbc-owner-legacy-daily>Duplicate pipeline</div><div id="quote" data-sbc-owner-legacy-daily>Quotes</div><div id="attention" data-sbc-owner-legacy-daily>Attention</div></div></main></div><div id="sbcGodTierBroadcastMount">Revenue</div><div id="sbcConsultativeRevenueMount">Solutions</div></body></html>''')
    canonical=re.search(r'href="/(sbc-v6636-styles\.[a-f0-9]+\.css)"',HTML).group(1)
    page.add_style_tag(content=(ROOT/'public'/canonical).read_text())
    page.add_style_tag(content=STYLE)
    duplicates=['#legacyGrid','#quote','#attention','#sbcGodTierBroadcastMount','#sbcConsultativeRevenueMount']
    for selector in duplicates:
        assert not page.locator(selector).is_visible(), 'legacy cascade leak '+selector
    assert page.locator('#sbc-owner-daily-home').is_visible()
    assert page.locator('#sbcProductionControlDashboard').is_visible()
    app=(ROOT/'public/app.js').read_text()
    for title in ['Quote Pipeline','Upcoming attention']:
        assert '<div class="card" data-sbc-owner-legacy-daily><div class="card-head"><h2>'+title+'</h2>' in app
    # Use the actual notification controller with a strictly read-only fake provider.
    page.evaluate('''() => {window.state={me:{role:'owner'},view:'dashboard'};window.statusCode=200;window.notice={recoveryRequired:false,channels:{email:{configured:true},sms:{configured:true}}};window.fetch=async(url,opts={})=>{if(url!=='/api/owner/notifications/status'||(opts.method&&opts.method!=='GET'))throw Error('Unexpected request');return new Response(JSON.stringify(window.notice),{status:window.statusCode});};}''')
    page.add_script_tag(path=str(ROOT/'public/sbc-unattended-notifications-v6504.js'))
    page.evaluate('window.SBCNotificationsV6504.refresh()')
    notice=page.locator('#sbcUnattendedNotificationsMount')
    assert notice.get_attribute('data-sbc-notification-routine')=='true'
    assert not notice.is_visible(), 'configured settings belong in Action Queue'
    page.evaluate('window.notice.recoveryRequired=true;window.SBCNotificationsV6504.refresh()')
    assert notice.is_visible(), 'recovery must remain visible'
    page.evaluate('window.notice.recoveryRequired=false;window.notice.channels.email.configured=false;window.SBCNotificationsV6504.refresh()')
    assert notice.is_visible(), 'unconfigured notification channel must remain visible'
    page.evaluate('window.notice.channels.email.configured=true;window.SBCNotificationsV6504.refresh()')
    assert not notice.is_visible()
    page.evaluate('window.statusCode=503;window.SBCNotificationsV6504.refresh()')
    assert notice.is_visible(), 'status request failure must remain visible'
    page.evaluate('window.statusCode=200;window.SBCNotificationsV6504.refresh()')
    page.evaluate("document.documentElement.dataset.sbcOwnerRoutine='false'")
    assert notice.is_visible()
    for selector in duplicates:
        assert page.locator(selector).is_visible(), 'Show all or recovery '+selector
    page.evaluate("document.documentElement.dataset.sbcOwnerRoutine='true';document.getElementById('sbc-owner-daily-home').remove()")
    assert notice.is_visible(), 'dedicated Notifications page has no home suppression'
    page.close()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for viewport in [{'width':1440,'height':900},{'width':390,'height':844}]:
        run_cascade(browser,viewport)
        run(browser,viewport)
    browser.close()
print('PASS owner clean display: desktop/mobile, actual controller, late navigation, intact handlers, recovery visibility, and role switch')
