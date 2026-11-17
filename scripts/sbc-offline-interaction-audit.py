#!/usr/bin/env python3
"""SBC offline real-JavaScript functional audit.

Only local static files are served. ALL /api/ calls are intercepted with
synthetic data. External network requests are blocked. No customer data,
real GoDaddy services, payments, calls or messages are used.
"""
import json
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/"public"
OUT=ROOT/"test-results"/"offline-functional"
OUT.mkdir(parents=True,exist_ok=True)
CHECKS=[]
REQUESTS=[]
EVENTS=[]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args): pass

def check(label,ok,details,view):
    CHECKS.append(dict(check=label,passed=bool(ok),details=str(details)[:260],view=view))

def reply(route,data,status=200):
    return route.fulfill(status=status,content_type="application/json",
                         body=json.dumps(data,ensure_ascii=False))

def accounts():
    rows=[{"id":"crm-"+str(i),"businessName":"Synthetic Business "+str(i),
           "status":"Lead","phone":"305-555-"+str(i).zfill(4),
           "managerId":"demo-manager","city":"Miami"} for i in range(120)]
    rows[118]={"id":"crm-118","businessName":"Synthetic Miranda Repairs",
               "status":"Lead","phone":"305-922-0061","managerId":"demo-manager"}
    return rows

def make_route(port,worker,state):
    def handle(route):
        req=route.request
        address=urlparse(req.url)
        if address.netloc!=f"127.0.0.1:{port}":
            EVENTS.append({"type":"blocked-external","url":address.scheme+"://"+address.netloc})
            return route.abort()
        if not address.path.startswith("/api/"):
            return route.continue_()
        REQUESTS.append({"worker":worker,"method":req.method,"path":address.path})
        # Every API operation is a synthetic browser stub; never forward writes.
        if req.method!="GET":
            EVENTS.append({"type":"intercepted-non-get","worker":worker,
                           "method":req.method,"path":address.path})
            return reply(route,{"ok":False,"code":"OFFLINE_AUDIT_NO_WRITES"},403)
        if address.path=="/api/me":
            if state["deny"]:
                return reply(route,{"ok":False,"error":"Authentication required"},401)
            if worker=="manager":
                return reply(route,{"ok":True,"authenticated":True,
                                    "user":{"id":"demo-manager","role":"account_manager","active":True}})
            return reply(route,{"ok":True,"authenticated":True,
                                "user":{"id":"researcher-synth","role":"lead_researcher",
                                        "name":"Synthetic Researcher","active":True}})
        if worker=="manager":
            if address.path=="/api/v6606/crm/account-portfolios/mine":
                return reply(route,{"ok":True,"data":{"tenantId":1,"accounts":accounts()}})
            if address.path=="/api/account-social/v1/research/queue":
                return reply(route,{"ok":True,"data":[]})
            if "/history" in address.path:
                return reply(route,{"ok":True,"notes":[]})
            if "/research" in address.path:
                return reply(route,{"ok":True,"research":[]})
            if "/plan" in address.path:
                return reply(route,{"ok":True,"plan":{"businessName":"Synthetic Miranda Repairs",
                  "customerStage":"LEAD","auditStatus":"NOT_VERIFIED","nextFollowUp":None,
                  "contactStatus":"ALLOWED","actions":[],"caveat":"Synthetic scenario"}})
            if "/social" in address.path or "/channels" in address.path or "/posts" in address.path:
                return reply(route,{"ok":True,"data":[]})
        if worker=="lorna":
            if address.path=="/api/v9/lead-verification":
                return reply(route,{"ok":True,"leads":[
                    {"id":"synth-verified","businessName":"Synthetic Verified Barbers",
                     "leadAssistStatus":"AUTO_VERIFIED","status":"Lead",
                     "phone":"305-555-0111","address":"Sample Street"},
                    {"id":"synth-foreign","businessName":"Another Researcher's Synthetic Lead",
                     "leadAssistStatus":"AUTO_VERIFIED","status":"Lead","phone":"305-555-0112"}]})
            if address.path=="/api/workforce/research-progress":
                return reply(route,{"ok":True,"source":"research-intake-audit",
                      "date":"2026-11-17","todayCount":1,"last7Count":5,
                      "rawSavedAllTimeCount":5,"autoVerifiedTodayCount":1,
                      "needsReviewTodayCount":0,"pendingAutoTodayCount":0,
                      "submittedLeadIds":["synth-verified"]})
            if address.path=="/api/training":
                return reply(route,{"ok":True,"assigned":[],"available":[]})
            if address.path=="/api/v9/time/status":
                return reply(route,{"ok":True,"open":None})
            if address.path=="/api/account-social/v1/research/feedback":
                return reply(route,{"ok":True,"data":[]})
        return reply(route,{"ok":False,"error":"UNMOCKED_AUDIT_ENDPOINT"},404)
    return handle

def load(page,origin,url,worker,state,port):
    page.route("**/*",make_route(port,worker,state))
    page.goto(origin+url,wait_until="domcontentloaded",timeout=35000)

def evaluate_overflow(page):
    return page.evaluate("""() => Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth""")

def manager_case(context,origin,port,label):
    state={"deny":False}
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    load(page,origin,"/sbc-account-manager-v1.html","manager",state,port)
    page.locator("#rolePill").get_by_text("ACCOUNT MANAGER",exact=False).wait_for(timeout=15000)
    name=page.locator("#sbcAccountSearch")
    name.fill("miranda")
    page.wait_for_timeout(170)
    card=page.locator("#accountGrid .account-card")
    found=card.count()==1 and "Synthetic Miranda Repairs" in card.first.inner_text()
    check("find assigned business by name",found,"exact one synthetic matching card",label)
    for q in ("CRM-118","922-0061"):
        name.fill(q)
        page.wait_for_timeout(75)
        check("search by "+q,card.count()==1 and "Synthetic Miranda" in card.first.inner_text(),
              "account ID and phone search operate through actual browser events",label)
    name.fill("miranda")
    card.first.get_by_role("button",name="Open account").click()
    page.locator("#accountDetail").wait_for(state="visible",timeout=6000)
    detail=page.locator("#detailTitle").inner_text()
    check("open correct account",detail=="Synthetic Miranda Repairs",detail,label)
    check("no inadvertent writes",not any(x["worker"]=="manager" and x["method"]!="GET" for x in REQUESTS),
          "GET-only account navigation and search",label)
    check("no horizontal overflow",evaluate_overflow(page)<=12,
          "overflow="+str(evaluate_overflow(page))+"px",label)
    page.screenshot(path=str(OUT/(f"account-manager-{label}.png")),full_page=True,animations="disabled")
    # Real fail-closed branch: the same account data must disappear after access denial.
    state["deny"]=True
    page.locator("#refresh").click()
    page.locator("#rolePill").get_by_text("NOT AUTHORIZED",exact=False).wait_for(timeout=10000)
    check("authentication failure clears account cards",page.locator("#accountGrid .account-card").count()==0,
          "no formerly authorized accounts visible after 401",label)
    check("authentication failure closes account details",page.locator("#accountDetail").is_hidden(),
          "private detail pane closed after refresh denial",label)
    check("no JavaScript runtime exceptions",not errors,"; ".join(errors[:4]) or "none",label)
    page.screenshot(path=str(OUT/(f"account-manager-denied-{label}.png")),full_page=True,animations="disabled")
    page.close()

def lorna_case(context,origin,port,label):
    state={"deny":False}
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    load(page,origin,"/lead-research.html","lorna",state,port)
    page.locator("#workspace").wait_for(state="visible",timeout=16000)
    page.get_by_role("button",name="My Submitted Leads").first.click()
    page.wait_for_timeout(200)
    card=page.locator("#mine-list .lead-row")
    check("researcher sees own submitted lead only",card.count()==1,
          "own-row-count="+str(card.count()),label)
    if card.count():
        check("submitted lead identity", "Synthetic Verified Barbers" in card.first.inner_text(),
              "other researcher's lead filtered out",label)
    btn=page.locator("#mine-list button.sbc-handoff-quick")
    check("one-click handoff is exposed",btn.count()==1,
          "button visible and clickable for synthetic auto-verified lead",label)
    if btn.count():
        btn.click()
        page.locator("#sbc-lorna-handoff-v1").wait_for(state="visible",timeout=5000)
        selected=page.locator('#sbc-handoff-submit input[name="customerId"]').input_value()
        check("handoff selects correct CRM ID",selected=="synth-verified",selected,label)
        check("handoff does not automatically submit",not any(
            x["worker"]=="lorna" and x["method"]!="GET" for x in REQUESTS),
            "no POST or customer contact from opening the modal",label)
    ratio=page.evaluate("""() => {
      const el=document.querySelector('#sbc-full-research-urgent p');
      const panel=document.querySelector('#sbc-full-research-urgent');
      if(!el||!panel)return 0;
      function lum(s){
        const m=s.match(/rgba?\\(([^)]*)\\)/);if(!m)return null;
        const v=m[1].split(/[ ,/]+/).filter(Boolean).slice(0,3).map(Number)
          .map(c=>c/255).map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
        return .2126*v[0]+.7152*v[1]+.0722*v[2];
      }
      const fg=lum(getComputedStyle(el).color),
            bg=lum(getComputedStyle(panel).backgroundColor);
      return fg===null||bg===null?0:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
    }""")
    check("urgent instruction contrast",ratio>=4.5,
          f"real visible paragraph contrast {ratio:.2f}:1",label)
    check("no horizontal overflow",evaluate_overflow(page)<=12,
          "overflow="+str(evaluate_overflow(page))+"px",label)
    check("no JavaScript runtime exceptions",not errors,"; ".join(errors[:4]) or "none",label)
    page.screenshot(path=str(OUT/(f"lorna-{label}.png")),full_page=True,animations="disabled")
    page.close()

def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=str(PUBLIC)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    port=server.server_port
    origin="http://127.0.0.1:"+str(port)
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            for label,width,height in (("phone",390,844),("desktop",1440,900)):
                ctx=browser.new_context(viewport={"width":width,"height":height},
                                        device_scale_factor=1,reduced_motion="reduce",
                                        service_workers="block")
                manager_case(ctx,origin,port,label)
                lorna_case(ctx,origin,port,label)
                ctx.close()
            browser.close()
    finally:
        server.shutdown()
    failed=[r for r in CHECKS if not r["passed"]]
    report={"kind":"OFFLINE_REAL_JS_WORKSTATION_AUDIT",
      "timestamp":datetime.now(timezone.utc).isoformat(),
      "scope":"real employee JS + local HTML/CSS, synthetic API fixtures, blocked external network",
      "notVerified":["production authentication","real CRM persistence","customer permission data",
           "GoDaddy hosting","SMS/calls","payments","customer messaging"],
      "checks":len(CHECKS),"passed":len(CHECKS)-len(failed),"failed":len(failed),
      "findings":CHECKS,"requests":REQUESTS,"externalBlocks":EVENTS}
    (OUT/"report.json").write_text(json.dumps(report,indent=2)+"\n")
    print("SBC OFFLINE WORKSTATION FUNCTIONAL AUDIT",report["checks"],
          "checks",report["passed"],"PASS",report["failed"],"FAIL")
    for row in failed:print("FINDING",row["view"],row["check"],row["details"])
    if failed:raise SystemExit(1)

if __name__=="__main__":
    main()
