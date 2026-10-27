import os,re,zipfile,hashlib,shutil,subprocess,glob
src='/mnt/data/v64223'
out='/mnt/data/v64224'
shutil.rmtree(out,ignore_errors=True); shutil.copytree(src,out)
# version bump in active package identity files only, broadly safe
for root,_,files in os.walk(out):
  for fn in files:
    if not fn.endswith(('.js','.cjs','.mjs','.html','.json','.md','.txt','.css')): continue
    p=os.path.join(root,fn)
    try:s=open(p,'r',encoding='utf-8').read()
    except: continue
    if '64.2.23' in s:
      s=s.replace('64.2.23','64.2.24')
      open(p,'w',encoding='utf-8').write(s)

pub=os.path.join(out,'public')
css='''/* SBC V64.2.24 — CANONICAL KIM SURFACE */\n#sbcAiDock.sbc-kim-canonical{position:fixed!important;z-index:2147483646!important;display:none;flex-direction:column;left:auto;top:auto;right:24px;bottom:24px;width:560px;height:720px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);min-width:360px;min-height:520px;background:#0b1424;color:#eef6ff;border:1px solid rgba(92,190,255,.38);border-radius:22px;box-shadow:0 24px 90px rgba(0,0,0,.55),0 0 45px rgba(31,147,255,.16);overflow:hidden;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}\n#sbcAiDock.sbc-kim-canonical:not(.hidden){display:flex!important}\n#sbcAiDock.sbc-kim-canonical *{box-sizing:border-box}\n#sbcAiDock.sbc-kim-canonical .ck-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);background:#0e1b2e;cursor:move;touch-action:none}\n#sbcAiDock.sbc-kim-canonical .ck-brand{display:flex;align-items:center;gap:11px}.ck-avatar{width:42px;height:42px;border-radius:12px;overflow:hidden;border:1px solid rgba(92,190,255,.5);flex:0 0 auto}.ck-avatar img{width:100%;height:100%;object-fit:cover}.ck-title{display:flex;flex-direction:column;gap:2px}.ck-title strong{font-size:16px}.ck-title small{font-size:10px;color:#82d9ff;letter-spacing:.08em;text-transform:uppercase}.ck-status{font-size:10px;color:#72efb0;letter-spacing:.05em}.ck-actions{display:flex;gap:6px}.ck-icon{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#14243a;color:#fff;cursor:pointer;font-size:18px}.ck-icon:hover{background:#1b3350}\n#sbcAiDock.sbc-kim-canonical .ck-body{display:flex;flex-direction:column;min-height:0;flex:1}.ck-context{padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.08);font-size:11px;color:#a9bdd1;background:#0b1728}.ck-context b{color:#fff}.ck-messages{flex:1;min-height:0;overflow:auto;padding:16px;background:#091321}.ck-empty{color:#91a8bd;text-align:center;padding:45px 22px;font-size:13px;line-height:1.55}.ck-msg{display:flex;margin:0 0 12px}.ck-msg.user{justify-content:flex-end}.ck-bubble{max-width:84%;padding:10px 12px;border-radius:14px;line-height:1.45;font-size:13px;white-space:pre-wrap;word-break:break-word}.ck-msg.assistant .ck-bubble{background:#13263b;border:1px solid rgba(111,195,255,.16)}.ck-msg.user .ck-bubble{background:#1769d1;color:#fff}.ck-quick{display:flex;gap:7px;overflow:auto;padding:9px 12px;border-top:1px solid rgba(255,255,255,.08);background:#0b1728}.ck-quick button{white-space:nowrap;border:1px solid rgba(100,190,255,.2);background:#102238;color:#bfe9ff;border-radius:999px;padding:7px 10px;font-size:11px;cursor:pointer}.ck-compose{display:flex;gap:8px;padding:11px 12px 7px;border-top:1px solid rgba(255,255,255,.08);background:#0e1b2e}.ck-compose textarea{flex:1;min-width:0;min-height:44px;max-height:130px;resize:none;border:1px solid #29425d;border-radius:13px;background:#07111f;color:#fff;padding:11px 12px;outline:none;font:inherit;font-size:13px;pointer-events:auto!important;user-select:text!important}.ck-compose textarea:focus{border-color:#37a9ff;box-shadow:0 0 0 2px rgba(55,169,255,.12)}.ck-send{width:48px;height:44px;border:0;border-radius:13px;background:#1878dc;color:#fff;font-size:20px;cursor:pointer}.ck-send:disabled{opacity:.55;cursor:wait}.ck-hint{padding:0 13px 11px;background:#0e1b2e;color:#7189a0;font-size:10px}.ck-resize{position:absolute;right:4px;bottom:4px;width:18px;height:18px;cursor:nwse-resize}.ck-resize:after{content:"";position:absolute;right:2px;bottom:2px;width:9px;height:9px;border-right:2px solid #7c98b2;border-bottom:2px solid #7c98b2}.ck-launcher{position:fixed!important;right:24px;bottom:24px;z-index:2147483645;border:1px solid rgba(91,191,255,.4);background:#0d1e32;color:#fff;border-radius:999px;padding:9px 14px;display:flex;align-items:center;gap:9px;box-shadow:0 14px 45px rgba(0,0,0,.4);cursor:pointer}.ck-launcher .orb{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#fff 0 6%,#61d4ff 20%,#126bd2 55%,#081528 75%)}.ck-launcher small{display:block;color:#80dfff;font-size:9px;letter-spacing:.12em;text-align:left}.ck-launcher strong{display:block;font-size:13px}.ck-launcher.hidden{display:none!important}\n@media(max-width:650px){#sbcAiDock.sbc-kim-canonical{left:6px!important;top:6px!important;right:auto!important;bottom:auto!important;width:calc(100vw - 12px)!important;height:calc(100vh - 12px)!important;max-width:none!important;max-height:none!important;border-radius:18px}.ck-launcher{right:12px;bottom:12px}}\n'''
open(os.path.join(pub,'sbc-kim-canonical-v6424.css'),'w').write(css)
js=r'''/* SBC V64.2.24 — CANONICAL KIM UI
   Single owner for the Kim surface. Uses existing app.js askSbcAI bridge.
*/
(function(){'use strict';
const ID='sbcAiDock', KEY='sbc.kim.canonical.v64.2.24';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
let drag=null,resize=null,booted=false;
function dock(){return document.getElementById(ID)}
function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function save(d){try{const r=d.getBoundingClientRect();localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}))}catch{}}
function ensure(){let d=dock();if(!d){d=document.createElement('div');d.id=ID;document.body.appendChild(d)}
  // Remove competing legacy launcher/dock surfaces, but preserve our canonical dock.
  document.querySelectorAll('#sbcKimLauncher,.akx-launcher,.sbc-kim-bottom-launcher').forEach(x=>x.remove());
  d.className='sbc-kim-canonical hidden';d.hidden=true;d.setAttribute('aria-hidden','true');
  if(d.dataset.ckMarkup==='1')return d;
  d.dataset.ckMarkup='1';
  d.innerHTML=`<header class="ck-head" id="ckDrag"><div class="ck-brand"><div class="ck-avatar"><img src="/assets/kim-avatar.png" alt="Kim"></div><div class="ck-title"><strong>Kim · AI Chief of Staff</strong><small>SBC OPERATIONS · CANONICAL CONTROL SURFACE</small><span class="ck-status" id="sbcAiStatus">● READY</span></div></div><div class="ck-actions"><button class="ck-icon" id="ckMin" type="button" title="Minimize">−</button><button class="ck-icon" id="ckClose" type="button" title="Close">×</button></div></header><div class="ck-body"><div class="ck-context"><b>LIVE CONTEXT:</b> <span id="ckPage">Dashboard</span> · <span id="sbcAiContextState">Connecting…</span></div><div class="ck-messages" id="sbcAiMessages" aria-live="polite"><div class="ck-empty">Kim is ready. Ask about leads, customers, operations, revenue, the Command Center, or a problem that needs diagnosis.</div></div><div class="ck-quick"><button data-ck-prompt="Give me a quick executive read of what matters right now.">Executive read</button><button data-ck-prompt="Review the current Command Center and give me the next three useful actions.">Next 3 moves</button><button data-ck-prompt="Troubleshoot the thing currently not working and tell me exactly what to do.">Troubleshoot</button></div><div class="ck-compose"><textarea id="sbcAiInput" rows="1" placeholder="Message Kim…" aria-label="Message Kim"></textarea><button class="ck-send" id="sbcAiSend" type="button">➤</button></div><div class="ck-hint">ENTER to send · SHIFT+ENTER for a new line</div></div><div class="ck-resize" id="ckResize" title="Resize Kim"></div>`;
  return d;
}
function restore(d){const s=saved(),mobile=innerWidth<=650;if(mobile)return;const w=clamp(Number(s.width)||560,360,Math.max(360,innerWidth-16)),h=clamp(Number(s.height)||720,520,Math.max(520,innerHeight-16));d.style.width=w+'px';d.style.height=h+'px';place(d,Number.isFinite(+s.left)?+s.left:innerWidth-w-24,Number.isFinite(+s.top)?+s.top:innerHeight-h-24)}
function place(d,l,t){const r=d.getBoundingClientRect();d.style.right='auto';d.style.bottom='auto';d.style.left=clamp(l,6,Math.max(6,innerWidth-r.width-6))+'px';d.style.top=clamp(t,6,Math.max(6,innerHeight-r.height-6))+'px'}
function context(){const p=$('#ckPage');if(p)p.textContent=$('#viewTitle')?.textContent||window.state?.view||'Dashboard';try{window.loadSbcKimLiveContext?.()}catch{}}
function open(prefill){const d=ensure();restore(d);d.classList.remove('hidden');d.hidden=false;d.style.display='flex';d.setAttribute('aria-hidden','false');const l=$('#ckLauncher');if(l)l.classList.add('hidden');context();const i=$('#sbcAiInput');if(prefill&&i){i.value=String(prefill);i.focus()}else setTimeout(()=>i?.focus(),50);return true}
function close(){const d=dock();if(!d)return;d.classList.add('hidden');d.hidden=true;d.style.display='none';d.setAttribute('aria-hidden','true');$('#ckLauncher')?.classList.remove('hidden')}
function send(text){const i=$('#sbcAiInput'),t=String(text||i?.value||'').trim();if(!t)return;i.value='';if(typeof window.askSbcAI==='function'){window.askSbcAI(t)}else{const s=$('#sbcAiStatus');if(s)s.textContent='● AI BRIDGE OFFLINE'}}
function bind(){if(booted)return;booted=true;const d=ensure();restore(d);if(!$('#ckLauncher')){const b=document.createElement('button');b.id='ckLauncher';b.className='ck-launcher';b.type='button';b.innerHTML='<span class="orb">✦</span><span><small>ASK KIM</small><strong>Open Chief of Staff</strong></span>';document.body.appendChild(b);b.onclick=()=>open()}
  $('#ckClose').onclick=e=>{e.preventDefault();close()};$('#ckMin').onclick=e=>{e.preventDefault();close()};$('#sbcAiSend').onclick=e=>{e.preventDefault();send()};$('#sbcAiInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};$('#sbcAiInput').oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'};document.querySelectorAll('[data-ck-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.ckPrompt));
  const h=$('#ckDrag'),g=$('#ckResize');h.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:r.left,t:r.top};try{h.setPointerCapture(e.pointerId)}catch{}e.preventDefault()};h.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;place(d,drag.l+e.clientX-drag.x,drag.t+e.clientY-drag.y);e.preventDefault()};h.onpointerup=e=>{if(drag&&e.pointerId===drag.id){save(d);drag=null}};g.onpointerdown=e=>{if(e.button!==0)return;const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{g.setPointerCapture(e.pointerId)}catch{}e.preventDefault()};g.onpointermove=e=>{if(!resize||e.pointerId!==resize.id)return;d.style.width=clamp(resize.w+e.clientX-resize.x,360,Math.max(360,innerWidth-12))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,520,Math.max(520,innerHeight-12))+'px';e.preventDefault()};g.onpointerup=e=>{if(resize&&e.pointerId===resize.id){save(d);resize=null}};addEventListener('resize',()=>{if(!d.classList.contains('hidden')){if(innerWidth<=650){d.style.left='6px';d.style.top='6px';d.style.width='calc(100vw - 12px)';d.style.height='calc(100vh - 12px)'}else{place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top)}save(d)}},{passive:true});
  const oldOpen=window.openSbcAI;window.__SBC_LEGACY_OPEN_KIM__=oldOpen;window.openSbcAI=open;window.closeSbcAI=close;window.sbcKimCanonical={open,close,ensure};context();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
'''
open(os.path.join(pub,'sbc-kim-canonical-v6424.js'),'w').write(js)
# Inject canonical CSS+JS at end so it becomes final UI owner.
idx=os.path.join(pub,'index.html')
s=open(idx,encoding='utf-8').read()
needle='</body>'
insert='<link rel="stylesheet" href="/sbc-kim-canonical-v6424.css?v=64.2.24"><script src="/sbc-kim-canonical-v6424.js?v=64.2.24"></script>'
s=s.replace(needle,insert+needle)
open(idx,'w',encoding='utf-8').write(s)
# Fix visible stale Kim V64.2.20 labels in active dashboard text
for p in [os.path.join(pub,'app.js'),os.path.join(pub,'index.html')]:
    t=open(p,encoding='utf-8').read();t=t.replace('V64.2.20','V64.2.24');open(p,'w',encoding='utf-8').write(t)
# Add focused test
scripts=os.path.join(out,'scripts');os.makedirs(scripts,exist_ok=True)
test='''const fs=require('fs'); const path=require('path');\nconst root=path.join(__dirname,'..','public'); const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');\nfunction ok(x,m){if(!x)throw new Error(m)}\nok(idx.includes('sbc-kim-canonical-v6424.js?v=64.2.24'),'canonical Kim JS not loaded');\nok(idx.includes('sbc-kim-canonical-v6424.css?v=64.2.24'),'canonical Kim CSS not loaded');\nconst js=fs.readFileSync(path.join(root,'sbc-kim-canonical-v6424.js'),'utf8');\nok(js.includes("window.openSbcAI=open"),'canonical open bridge missing');\nok(js.includes("window.closeSbcAI=close"),'canonical close bridge missing');\nok(js.includes('sbcAiInput')&&js.includes('sbcAiSend'),'canonical composer missing');\nok(js.includes('ckResize'),'canonical resize missing');\nconsole.log('V64.2.24 canonical Kim integrity: PASS');\n'''
open(os.path.join(scripts,'v64224-kim-integrity-test.js'),'w').write(test)
# update package version
pkg=os.path.join(out,'package.json')
if os.path.exists(pkg):
 t=open(pkg,encoding='utf-8').read();t=t.replace('"version": "64.2.23"','"version": "64.2.24"');open(pkg,'w',encoding='utf-8').write(t)
# syntax checks
files=[]
for root,_,fs in os.walk(out):
 for f in fs:
  if f.endswith(('.js','.cjs','.mjs')): files.append(os.path.join(root,f))
failed=[]
for p in files:
 r=subprocess.run(['node','--check',p],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 if r.returncode: failed.append((p,r.stderr[:500]))
print('syntax',len(files),'failed',len(failed))
if failed:
 print(failed[:5]);raise SystemExit(1)
r=subprocess.run(['node',os.path.join(scripts,'v64224-kim-integrity-test.js')],capture_output=True,text=True)
print(r.stdout,r.stderr)
if r.returncode: raise SystemExit(r.returncode)
zipout='/mnt/data/SBC-OS-V64.2.24-KIM-CANONICAL-UI-GODADDY.zip'
with zipfile.ZipFile(zipout,'w',zipfile.ZIP_DEFLATED) as z:
 for root,_,fs in os.walk(out):
  for f in fs:
   p=os.path.join(root,f);z.write(p,os.path.relpath(p,out))
h=hashlib.sha256(open(zipout,'rb').read()).hexdigest()
print('ZIP',zipout,os.path.getsize(zipout),'SHA256',h)
