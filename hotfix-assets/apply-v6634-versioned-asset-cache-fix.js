'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6634_VERSIONED_ASSET_CACHE_FIX';
const VERSION='66.34-asset-cache-reset';
function once(s,from,to,label){const count=s.split(from).length-1;if(count!==1)throw Error(MARKER+': '+label+' found '+count+' instances');return s.replace(from,to);}
function apply(root){
 const serverFile=path.join(root,'server.js');
 let server=fs.readFileSync(serverFile,'utf8');
 if(server.includes(MARKER))throw Error(MARKER+': duplicate application');
 // Previously any ?v= caused a one-year immutable cache, even when files
 // changed under unchanged URLs. 66.0.0 dashboard CSS was repeatedly rewritten.
 // Only content-hashed FILENAMES may be immutable. All old query-string
 // 'versioned' assets must instead use the server's existing no-store policy.
 const unsafe=String.raw`if(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(file)&&/[?&]v=|\.[a-f0-9]{8,}\./i.test(String(res.req?.url||'')))`;
 const safe=String.raw`if(/\.[a-f0-9]{12,64}\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(file))`;
 server=once(server,unsafe,safe,'unsafe immutable query-string static caching');
 server=once(server,
  "app.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:",
  "/* "+MARKER+": only content-addressed filenames may be cached immutably. */\napp.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:",
  'static entry boundary');
 if(server.includes(unsafe))throw Error(MARKER+': unsafe immutable caching remains');
 fs.writeFileSync(serverFile,server);
 const changed=['server.js'];
 const re=/((?:src|href)=["']\/[^"'?]+\.(?:js|css)\?v=)[^"'&]+(["'])/g;
 for(const rel of ['public/index.html','browser_public/index.html']){
  const file=path.join(root,rel);let html=fs.readFileSync(file,'utf8');
  if(html.includes(MARKER))throw Error(MARKER+': already in '+rel);
  const matches=[...html.matchAll(re)];
  if(matches.length<(rel.startsWith('browser_public/')?10:110))throw Error(MARKER+': unexpectedly few versioned JS/CSS assets in '+rel+' ('+matches.length+')');
  html=html.replace(re,(all,prefix,quote)=>prefix+VERSION+quote);
  // Active old importer is intentionally disabled; do not reintroduce its UI.
  if(/<script[^>]+src=["']\/sbc-lead-import-v6541\.js/.test(html))throw Error(MARKER+': legacy lead importer re-enabled');
  fs.writeFileSync(file,html);changed.push(rel);
 }
 for(const rel of ['public/sw.js','browser_public/sw.js']){
  const file=path.join(root,rel);if(!fs.existsSync(file))continue;
  let sw=fs.readFileSync(file,'utf8');
  const cache=/const CACHE=['"][^'"]+['"]/;
  if(!cache.test(sw))throw Error(MARKER+': service-worker cache identity missing '+rel);
  sw=sw.replace(cache,"const CACHE='sbc-static-v66-34-content-revalidated'");
  fs.writeFileSync(file,sw);changed.push(rel);
 }
 // SBC_V6638_VISIBLE_BROWSER_BOOT: never strand GoDaddy's app on an
 // indefinite session / CRM bootstrap loading state; no writer/security changes.
 for(const rel of ['public/app.js','browser_public/app.js']){
  const file=path.join(root,rel);
  // Minimal asset-cache regression fixtures do not contain the app shell.
  if(!fs.existsSync(file))continue;
  let app=fs.readFileSync(file,'utf8');
  app=once(app,
   "function sbcTheme(){return localStorage.getItem('sbc-theme')||'light'}",
   "function sbcTheme(){try{return localStorage.getItem('sbc-theme')||'light'}catch{return 'light'}}",
   rel+' storage-safe startup theme');
  app=once(app,
   "document.body.dataset.theme=t;localStorage.setItem('sbc-theme',t);",
   "document.body.dataset.theme=t;try{localStorage.setItem('sbc-theme',t)}catch{};",
   rel+' storage-safe theme persistence');
  app=once(app,
   "me=await api('/api/me')",
   "me=await api('/api/me',{timeoutMs:12000})",
   rel+' bounded initial authentication probe');
  app=once(app,
   "state.data=await api('/api/bootstrap');",
   "state.data=await api('/api/bootstrap',{timeoutMs:18000});",
   rel+' bounded initial CRM bootstrap read');
  if(app.includes("const rp=await api('/api/owner/recovery/leads');"))
   app=once(app,
    "const rp=await api('/api/owner/recovery/leads');",
    "const rp=await api('/api/owner/recovery/leads',{timeoutMs:10000});",
    rel+' bounded read-only recovery projection');
  else if(rel==='public/app.js')
   throw Error(MARKER+': production recovery projection anchor missing');
  app=once(app,
   "$('#login').classList.add('hidden');$('#app').classList.remove('hidden');await load();",
   "$('#login').classList.add('hidden');$('#app').classList.remove('hidden');const startupContent=$('#content');if(startupContent)startupContent.textContent='Loading SBC account data…';await load();",
   rel+' visible authenticated bootstrap');
  const from="    if(login) login.classList.remove('hidden');\n    if(app) app.classList.add('hidden');\n    if(err) err.textContent='SBC could not start. Refresh once. If this message remains, the deployment needs repair.';";
  const to="    // The server is online and the user is authenticated, but the CRM read\n    // failed. Never hide the whole workspace or permit unverified data writes.\n    if(state.me && app && !app.classList.contains('hidden')){\n      const content=document.getElementById('content');\n      if(content){\n        const section=document.createElement('section');section.className='card section';section.setAttribute('role','alert');\n        const head=document.createElement('h2');head.textContent='SBC is online, but account data could not load';\n        const detail=document.createElement('p');detail.textContent='No customer data was changed. Check the connection or session, then retry. CRM and payment actions remain unavailable until data loads.';\n        const why=document.createElement('p');why.className='mini';why.textContent=String(e&&e.message||'Startup data request failed').slice(0,220);\n        const retry=document.createElement('button');retry.type='button';retry.className='btn primary';retry.textContent='Retry account data';\n        retry.addEventListener('click',()=>{retry.disabled=true;boot().catch(err=>console.error('[SBC BOOT RETRY]',err))});\n        section.append(head,detail,why,retry);content.replaceChildren(section);\n      }\n      return;\n    }\n    if(login) login.classList.remove('hidden');\n    if(app) app.classList.add('hidden');\n    if(err) err.textContent='SBC could not validate your session. '+String(e&&e.message||'Request failed').slice(0,160)+' — Retry sign-in or refresh.';";
  app=once(app,from,to,rel+' visible bounded boot failure');
  fs.writeFileSync(file,app);
  changed.push(rel);
 }
 return {marker:MARKER,changed,immutableOnlyForContentHashedFilenames:true,priorStaleAssetUrlsInvalidated:true,legacyUIRemainsDisabled:true,crmWrites:false,tenantProtectionUnchanged:true};
}
module.exports={apply,MARKER,VERSION};