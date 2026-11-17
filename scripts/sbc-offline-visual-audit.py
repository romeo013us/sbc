#!/usr/bin/env python3
"""Static, browser-rendered SBC workstation layout audit, no customer access."""
import json
import re
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/"public"
OUT=ROOT/"test-results"/"offline-visual"
OUT.mkdir(parents=True,exist_ok=True)
VIEWPORTS=[("phone",390,844),("tablet",768,1024),("desktop",1440,900)]
SCENARIOS=[("owner-login","/","login"),("owner-shell","/","shell"),
           ("website-preview","/","site"),("lorna","/lead-research.html","lorna"),
           ("account-manager","/sbc-account-manager-v1.html","manager")]
checks=[]

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,format,*args): pass

def record(name,scenario,viewport,ok,detail):
 checks.append({"check":name,"scenario":scenario,"viewport":viewport,
                "pass":bool(ok),"detail":str(detail)[:300]})

def prep(page,mode):
 if mode in ("shell","site"):
  page.evaluate("""() => {
   document.querySelector('#login')?.classList.add('hidden');
   document.querySelector('#app')?.classList.remove('hidden');
  }""")
 if mode=="site":
  page.evaluate("""() => {
   document.querySelector('#modal')?.classList.remove('hidden');
   const el=document.querySelector('#modalBody');
   el.innerHTML='<section id="sbcAiDesk"><div class="sbc-ai-heading"><h3>Website proposal review</h3><p>Offline test layout</p></div>'+
    '<section class="sbc-ai-instructions"><label for="sbcAIQuickTier">Website package</label><select id="sbcAIQuickTier"><option>$199 Starter</option></select>'+
    '<button type="button" class="btn primary sbc-ai-upload">Upload ZIP and preview</button>'+
    '<small>Original ZIP versions remain saved for recovery.</small></section>'+
    '<div class="sbc-ai-current"><p class="sbc-ai-meta">Preview checks complete. Review all pages.</p>'+
    '<a class="btn" href="#">Download customer website backup</a></div></section>';
  }""")
 if mode=="lorna":
  page.evaluate("""() => {
   document.querySelector('#workspace')?.removeAttribute('hidden');
   document.querySelector('#access')?.setAttribute('hidden','');
  }""")

def inspect(page,name,viewport,mode):
 size=page.evaluate("""() => ({
  viewport:innerWidth,
  document:document.documentElement.scrollWidth,
  body:document.body.scrollWidth
 })""")
 excess=max(size["body"],size["document"])-size["viewport"]
 record("horizontal overflow",name,viewport,excess<=12,f"width excess {excess}px")
 selectors={
  "login":["#login h1","#login label"],
  "shell":["#viewTitle"],
  "site":["#sbcAiDesk .sbc-ai-heading h3","#sbcAiDesk .sbc-ai-meta","#sbcAiDesk small"],
  "lorna":[".welcome h2",".welcome p"],
  "manager":[".section-head h2",".sbc-account-search label"]
 }[mode]
 for selector in selectors:
  data=page.evaluate("""(selector)=>{
   const el=document.querySelector(selector);
   if(!el)return {error:'not found'};
   const rect=el.getBoundingClientRect();
   if(!rect.width||!rect.height)return {error:'not visible'};
   const foreground=getComputedStyle(el).color;
   let bg='rgb(255,255,255)',cur=el;
   while(cur){
    const value=getComputedStyle(cur).backgroundColor;
    if(value&&value!=='transparent'&&!/rgba?\\(0, 0, 0, 0\\)/.test(value)){bg=value;break;}
    cur=cur.parentElement;
   }
   function lum(c){
    const m=c.match(/rgba?\\(([^)]*)\\)/);if(!m)return null;
    const p=m[1].split(/[ ,/]+/).filter(Boolean).slice(0,3).map(Number);
    if(p.length!==3||p.some(Number.isNaN))return null;
    const v=p.map(z=>z/255).map(z=>z<=.04045?z/12.92:Math.pow((z+.055)/1.055,2.4));
    return .2126*v[0]+.7152*v[1]+.0722*v[2];
   }
   const f=lum(foreground),b=lum(bg);
   return {ratio:f===null||b===null?null:(Math.max(f,b)+.05)/(Math.min(f,b)+.05),fg:foreground,bg};
  }""",selector)
  if data.get("error"):
   record("visible selector",name,viewport,False,selector+" "+data["error"])
  elif data.get("ratio") is None:
   record("contrast",name,viewport,False,selector+" unable to resolve color")
  else:
   ratio=data["ratio"]
   record("contrast",name,viewport,ratio>=4.5,
          f"{selector}: {ratio:.2f}:1; {data['fg']} on {data['bg']}")
 if mode=="site":
  dims=page.locator(".sbc-ai-upload").bounding_box()
  record("upload touch target",name,viewport,bool(dims and dims["height"]>=44),
         f"height {dims['height'] if dims else 'not rendered'}")
 if mode=="manager":
  record("find-account",name,viewport,page.locator("#sbcAccountSearch").count()>0,
         "account search control available")
 if mode=="lorna":
  record("my-submitted-leads",name,viewport,page.locator('[data-tab="mine"]').count()>0,
         "submitted lead navigation available")
 page.screenshot(path=str(OUT/(name+"-"+viewport+".png")),full_page=True,animations="disabled")

def main():
 server=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=str(PUBLIC)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 origin="http://127.0.0.1:"+str(server.server_port)
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True)
   for label,width,height in VIEWPORTS:
    ctx=browser.new_context(viewport={"width":width,"height":height},reduced_motion="reduce",
                            service_workers="block",device_scale_factor=1)
    for name,path,mode in SCENARIOS:
     page=ctx.new_page()
     def route_handler(route):
      req=urlparse(route.request.url)
      if req.netloc!="127.0.0.1:"+str(server.server_port):
       return route.abort()
      if req.path=="/" or req.path.endswith(".html"):
       source=PUBLIC/("index.html" if req.path=="/" else req.path.lstrip("/"))
       if not source.is_file():return route.abort()
       html=source.read_text(encoding="utf-8")
       # A CSS/layout audit must not run application requests, customer code or inline scripts.
       html=re.sub(r'<script\b[^>]*>.*?</script\s*>','',html,flags=re.I|re.S)
       return route.fulfill(status=200,content_type="text/html",body=html)
      if req.path.endswith(".js"):return route.fulfill(status=200,content_type="text/javascript",body="")
      return route.continue_()
     page.route("**/*",route_handler)
     page.goto(origin+path,wait_until="domcontentloaded",timeout=30000)
     page.wait_for_timeout(120)
     prep(page,mode)
     inspect(page,name,label,mode)
     page.close()
    ctx.close()
   browser.close()
 finally:
  server.shutdown()
 bad=[x for x in checks if not x["pass"]]
 report={"kind":"STATIC_OFFLINE_BROWSER_AUDIT","generatedAt":datetime.now(timezone.utc).isoformat(),
         "source":"checked-out SBC source; no live customer information",
         "scope":"Chromium HTML/CSS only, synthetic website modal, 390/768/1440px; JavaScript disabled",
         "notTested":["authenticated user workflows","production API","data persistence",
                      "payment","SMS/voice","GoDaddy deployment"],
         "total":len(checks),"passed":len(checks)-len(bad),"failed":len(bad),"findings":checks}
 (OUT/"report.json").write_text(json.dumps(report,indent=2)+"\n")
 print("SBC OFFLINE CHROMIUM",report["total"],"checks",
       report["passed"],"PASS",report["failed"],"FAIL")
 for item in bad:
  print("FINDING",item["scenario"],item["viewport"],item["check"],item["detail"])
 print("STATIC BROWSER RENDER ONLY: no production authentication, API or customer data.")
 if bad:raise SystemExit(1)

if __name__=="__main__":main()
