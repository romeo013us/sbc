from pathlib import Path
import json,re
root=Path('/mnt/data/v64228')

# package identity
p=root/'package.json'
d=json.loads(p.read_text())
d['version']='64.2.28'
d['description']=d.get('description','').replace('V64.2.26','V64.2.28')
p.write_text(json.dumps(d,indent=2)+"\n")

# Kevin runtime hardening
p=root/'enterprise/kevin/kevin-runtime.cjs'
s=p.read_text()
s=s.replace('SBC V64.2.26', 'SBC V64.2.28').replace('V64.2.26', 'V64.2.28').replace("config.version = '64.2.26';", "config.version = '64.2.28';")
s=s.replace("async function startKevinV6422({app, dbGetter, mysqlPoolGetter, stateKernel, evolutionEngine, auth, ownerOnly, rootDir, recoveryRequired=false}) {", "async function startKevinV6422({app, dbGetter, mysqlPoolGetter, stateKernel, evolutionEngine, auth, ownerOnly, rootDir, recoveryRequired=false}) {")
# Insert recovery predicate and gate after runtime creation.
old="""  const control = new HardenedControlPlane({rootDir,mysqlPoolGetter,stateKernel,evolutionEngine,config});\n  runtime={kernel,kim,config,control,capitalPrediction,kimBriefing};\n"""
new="""  const recoverySafe = () => typeof recoveryRequired === 'function' ? Boolean(recoveryRequired()) : Boolean(recoveryRequired);\n  const control = new HardenedControlPlane({rootDir,mysqlPoolGetter,stateKernel,evolutionEngine,config});\n  runtime={kernel,kim,config,control,capitalPrediction,kimBriefing,recoverySafe:false};\n"""
if old not in s: raise SystemExit('runtime insertion anchor missing')
s=s.replace(old,new)
# Manual heartbeat guard
old="""  app.post('/api/kevin/heartbeat',auth,ownerOnly,async(req,res)=>{try{const out=await control.run({core:kernel.core,dbGetter,dryRun:req.body?.dryRun===false?false:true,tenantId:req.tenantId||1});res.json({ok:true,heartbeat:out});}catch(e){res.status(500).json({ok:false,error:e.message});}});\n"""
new="""  app.post('/api/kevin/heartbeat',auth,ownerOnly,async(req,res)=>{try{if(recoverySafe())return res.status(423).json({ok:false,error:'KEVIN_RECOVERY_SAFE',readOnly:true,recoverySafe:true,message:'Kevin heartbeat is suspended while authoritative CRM recovery is required.'});const out=await control.run({core:kernel.core,dbGetter,dryRun:req.body?.dryRun===false?false:true,tenantId:req.tenantId||1});res.json({ok:true,heartbeat:out});}catch(e){res.status(500).json({ok:false,error:e.message});}});\n"""
if old not in s: raise SystemExit('heartbeat anchor missing')
s=s.replace(old,new)
# Kim briefing manual guard
old="""  app.post('/api/kim/executive-briefing/run',auth,ownerOnly,async(req,res)=>{\n    try{res.json(await kimBriefing.generate({tenantId:req.tenantId||1}));}\n    catch(e){res.status(500).json({ok:false,error:e.message});}\n  });\n"""
new="""  app.post('/api/kim/executive-briefing/run',auth,ownerOnly,async(req,res)=>{\n    try{if(recoverySafe())return res.status(423).json({ok:false,error:'KIM_RECOVERY_SAFE',readOnly:true,recoverySafe:true,message:'Kim executive briefing workers are suspended while authoritative CRM recovery is required.'});res.json(await kimBriefing.generate({tenantId:req.tenantId||1}));}\n    catch(e){res.status(500).json({ok:false,error:e.message});}\n  });\n"""
if old not in s: raise SystemExit('kim briefing anchor missing')
s=s.replace(old,new)
# Replace schema initialization block with recovery-safe branch
old="""  try {\n    await control.ensureSchema();\n    if(mysqlPoolGetter?.()) await stateKernel?.ensure?.();\n    await kimBriefing.ensureSchema();\n    kimBriefing.start();\n  }\n  catch(e) { console.warn('[KEVIN V64.2.28] durable schema init deferred:',e.message); }\n\n  await emitSnapshot();\n"""
new="""  if (recoverySafe()) {\n    runtime.recoverySafe = true;\n    console.log('[KEVIN V64.2.28] RECOVERY_SAFE — schema bootstrap and Kim briefing worker skipped; diagnostics only.');\n  } else {\n    try {\n      await control.ensureSchema();\n      if(mysqlPoolGetter?.()) await stateKernel?.ensure?.();\n      await kimBriefing.ensureSchema();\n      kimBriefing.start();\n    }\n    catch(e) { console.warn('[KEVIN V64.2.28] durable schema init deferred:',e.message); }\n  }\n\n  await emitSnapshot();\n"""
if old not in s: raise SystemExit('schema block anchor missing')
s=s.replace(old,new)
# Runtime status endpoint adds recoverySafe
s=s.replace("app.get('/api/kevin/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...kernel.status(),hardened:control.status()}));", "app.get('/api/kevin/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...kernel.status(),hardened:{...control.status(),recoverySafe:recoverySafe(),heartbeatSuspended:recoverySafe()}}));")
s=s.replace("app.get('/api/kevin/hardened/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...control.status()}));", "app.get('/api/kevin/hardened/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...control.status(),recoverySafe:recoverySafe(),heartbeatSuspended:recoverySafe()}));")
p.write_text(s)

# Server version consistency and recovery gate for verified-lead commit
p=root/'server.js'; s=p.read_text()
s=s.replace("V64.2.25 — OWNER-CONTROLLED VERIFIED LEAD RESTORE BRIDGE", "V64.2.28 — OWNER-CONTROLLED VERIFIED LEAD RESTORE BRIDGE")
s=s.replace("console.log(`[SBC V64.2.25] VERIFIED LEAD RESTORE committed", "console.log(`[SBC V64.2.28] VERIFIED LEAD RESTORE committed")
old="""  try{\n    if(String(req.body?.confirm||'')!=='RESTORE-VERIFIED-LEADS') return res.status(400).json({ok:false,error:'OWNER_CONFIRMATION_REQUIRED',message:'Type RESTORE-VERIFIED-LEADS to authorize the verified lead restore.'});\n    if(!mysqlPool) return res.status(503).json({ok:false,error:'MYSQL_UNAVAILABLE',message:'MySQL is unavailable. No restore was performed.'});\n"""
new="""  try{\n    if(MYSQL_RECOVERY_REQUIRED) return res.status(423).json({ok:false,error:'MYSQL_RECOVERY_REQUIRED',readOnly:true,recoverySafe:true,message:'Verified-lead promotion is blocked while authoritative CRM recovery is required. Run provenance validation now; promote only after the authoritative CRM recovery gate is cleared.'});\n    if(String(req.body?.confirm||'')!=='RESTORE-VERIFIED-LEADS') return res.status(400).json({ok:false,error:'OWNER_CONFIRMATION_REQUIRED',message:'Type RESTORE-VERIFIED-LEADS to authorize the verified lead restore.'});\n    if(!mysqlPool) return res.status(503).json({ok:false,error:'MYSQL_UNAVAILABLE',message:'MySQL is unavailable. No restore was performed.'});\n"""
if old not in s: raise SystemExit('commit gate anchor missing')
s=s.replace(old,new,1)
# Update server runtime identity call to package release marker via log only; runtime owns its identity.
p.write_text(s)
