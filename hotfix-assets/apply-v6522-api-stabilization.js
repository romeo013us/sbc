'use strict';
const fs = require('fs');
const path = require('path');
const MARKER = 'SBC_V6522_API_STABILIZATION';
function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${MARKER}: expected exactly one ${label} anchor, found ${count}`);
  return source.replace(from, to);
}
function apply(rootDir) {
  const serverPath = path.join(rootDir, 'server.js');
  const growthPath = path.join(rootDir, 'routes', 'v56240-autonomous-growth-hardening.js');
  const uiPath = path.join(rootDir, 'public', 'v32-9-enterprise.js');
  for (const p of [serverPath, growthPath, uiPath]) if (!fs.existsSync(p)) throw new Error(`${MARKER}: missing ${path.relative(rootDir,p)}`);
  let server = fs.readFileSync(serverPath, 'utf8');
  if (!server.includes(MARKER)) {
    const from = "app.get('/api/kim/v329/summary',auth,kimV329Gate,async(req,res)=>{\n  const sync=await syncV329CanonicalLeadMesh();\n  const summary=V329.summary();\n  res.setHeader('Cache-Control','no-store');\n  res.json({ok:true,...summary,canonicalLeadMesh:sync,starterLeadMesh:{source:'canonical CRM Active Sales Leads',loaded:sync.activeSalesLeads>0,queue:sync.verificationQueue}});\n});";
    const to = `// ${MARKER}: bound slow MySQL projection so the UI receives explicit degraded state instead of hanging.\napp.get('/api/kim/v329/summary',auth,kimV329Gate,async(req,res)=>{\n  const timeoutMs=2500; let timer;\n  const unavailable={source:'canonical CRM/Lead Mesh',dataStatus:'UNAVAILABLE_TIMEOUT',activeSalesLeads:null,verificationQueue:null,workableQueue:null,verifiedOrSalesReady:null,preservedLeadMeshCandidates:null,records:null,recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED),readOnly:true};\n  const sync=await Promise.race([syncV329CanonicalLeadMesh(),new Promise(resolve=>{timer=setTimeout(()=>resolve(unavailable),timeoutMs);})]).finally(()=>clearTimeout(timer));\n  const summary=V329.summary();\n  res.setHeader('Cache-Control','no-store');\n  res.status(sync.dataStatus==='UNAVAILABLE_TIMEOUT'?503:200).json({ok:sync.dataStatus!=='UNAVAILABLE_TIMEOUT',degraded:sync.dataStatus==='UNAVAILABLE_TIMEOUT',error:sync.dataStatus==='UNAVAILABLE_TIMEOUT'?'Lead data query exceeded the 2500ms response budget; no CRM writes were performed.':undefined,...summary,canonicalLeadMesh:sync,starterLeadMesh:{source:'canonical CRM Active Sales Leads',loaded:Number.isFinite(sync.activeSalesLeads)&&sync.activeSalesLeads>0,queue:Number.isFinite(sync.verificationQueue)?sync.verificationQueue:null}});\n});`;
    server = replaceOnce(server, from, to, 'Kim summary route');
    fs.writeFileSync(serverPath, server);
  }
  let growth = fs.readFileSync(growthPath, 'utf8');
  if (!growth.includes(MARKER)) {
    const from = " app.get('/api/v56240/growth/status',auth,guard,async(req,res)=>{try{res.json(await C().status(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});";
    const to = ` // ${MARKER}: return a bounded, explicit response when a provider/database operation stalls.\n app.get('/api/v56240/growth/status',auth,guard,async(req,res)=>{let timer;try{const result=await Promise.race([C().status(global.__SBC_REQUIRE_TENANT(req)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Growth status exceeded 3500ms response budget; no automatic retry or mutation was started.'),{code:'GROWTH_STATUS_TIMEOUT'})),3500);})]);res.setHeader('Cache-Control','no-store');res.json(result);}catch(e){const timedOut=e.code==='GROWTH_STATUS_TIMEOUT';res.status(timedOut?503:500).json({ok:false,error:e.message,code:e.code||'GROWTH_STATUS_ERROR',recoverySafe:true,readOnly:true});}finally{clearTimeout(timer);}});`;
    growth = replaceOnce(growth, from, to, 'Growth status route');
    fs.writeFileSync(growthPath, growth);
  }
  let ui = fs.readFileSync(uiPath, 'utf8');
  if (!ui.includes(MARKER)) {
    const from = "msg.textContent=`CRM lead mesh connected: ${x.canonicalLeadMesh?.activeSalesLeads||0} active sales leads · ${x.canonicalLeadMesh?.verificationQueue||0} awaiting verification.`;";
    const to = `// ${MARKER}: unknown counts must never be rendered as real zeroes.\n      const leadState=x.canonicalLeadMesh||{};\n      msg.textContent=leadState.dataStatus==='UNAVAILABLE_TIMEOUT'||x.degraded?'CRM/Lead Mesh status unavailable: the data query timed out. Counts are unknown; no data was changed.':\`CRM lead mesh connected: \${Number.isFinite(leadState.activeSalesLeads)?leadState.activeSalesLeads:'unknown'} active sales leads · \${Number.isFinite(leadState.verificationQueue)?leadState.verificationQueue:'unknown'} awaiting verification.\`;`;
    ui = replaceOnce(ui, from, to, 'Enterprise summary status message');
    fs.writeFileSync(uiPath, ui);
  }
  // Promote the fully patched source identity only after all anchors were verified.
  const pkgPath=path.join(rootDir,'package.json');
  const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
  if(pkg.name!=='sbc-business-command-center') throw new Error(`${MARKER}: unexpected package identity`);
  pkg.version='65.1.22';
  pkg.description='SBC OS V65.1.22 bounded API response and CRM truth-state stabilization';
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  const identityPath=path.join(rootDir,'config','release-identity.js');
  if(fs.existsSync(identityPath)) {
    let identity=fs.readFileSync(identityPath,'utf8');
    identity=identity.replace(/(RELEASE_VERSION\s*[:=]\s*['\"])[^'\"]+(['\"])/, '$165.1.22$2');
    fs.writeFileSync(identityPath,identity);
  }
  // Keep EVERY place that carries the release label in step with the identity this overlay sets:
  //  - public/*.js + index.html: the ?v= cache key MUST change, or browsers keep serving the old v32-9-enterprise.js
  //  - scripts/v6510-ui-recovery-buttons-test.js pins the previous overlay's version
  //  - release-identity patch number
  const swap = (file) => {
    if (!fs.existsSync(file)) return;
    const a = fs.readFileSync(file, 'utf8');
    const b = a.split('65.1.21').join('65.1.22').split('65\\.1\\.21').join('65\\.1\\.22').replace(/patch(\s*(?::|===|==)\s*)21\b/g, (m, sep) => 'patch' + sep + '22');
    if (b !== a) fs.writeFileSync(file, b);
  };
  const pub = path.join(rootDir, 'public');
  if (fs.existsSync(pub)) for (const f of fs.readdirSync(pub)) if (/\.(js|html|css)$/.test(f)) swap(path.join(pub, f));
  swap(path.join(rootDir, 'VERSION'));     // the VERSION file must match package.json and the identity
  const scr = path.join(rootDir, 'scripts');
  if (fs.existsSync(scr)) for (const f of fs.readdirSync(scr)) if (/\.js$/.test(f)) swap(path.join(scr, f));   // tests pinned to the previous overlay's version
  if (fs.existsSync(identityPath)) {
    let idt = fs.readFileSync(identityPath, 'utf8');
    idt = idt.replace(/patch:\s*21\b/, 'patch:22');
    fs.writeFileSync(identityPath, idt);
  }
  return { marker: MARKER, changed: true, version:'65.1.22' };
}
module.exports = { apply, MARKER };
