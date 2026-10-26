'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6643_DURABLE_OWNER_VETO_AND_KEVIN_REVENUE';
function replace(s,needle,repl,label){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error(MARKER+': '+label+' anchor count='+count);
 return s.replace(needle,repl);
}
function apply(root){
 const rel='enterprise/kevin/kevin-runtime.cjs',target=path.join(root,rel);
 const helper=path.join(__dirname,'../enterprise/kevin/owner-veto-store.cjs');
 const installed=path.join(root,'enterprise/kevin/owner-veto-store.cjs');
 if(!fs.existsSync(target)||!fs.existsSync(helper))throw Error(MARKER+': source missing');
 let c=fs.readFileSync(target,'utf8');
 if(c.includes(MARKER))throw Error(MARKER+': applied twice');
 c=replace(c,"const crypto = require('crypto');",
 "const crypto = require('crypto');\nconst {confirmedPaid}=require('../v6640-payment-evidence.cjs');\nconst vetoStore=require('./owner-veto-store.cjs');\n// "+MARKER,
 'shared evidence and durable store');
 c=replace(c,
 "  const collectedRevenue = orders.reduce((n,o) => n + Number(o?.paidAmount ?? o?.amountPaid ?? o?.totalPaid ?? (String(o?.status||'').toLowerCase()==='paid' ? o?.total : 0) ?? 0), 0);",
 "  const collectedRevenue = orders.reduce((n,o) => n + (confirmedPaid(o) ? Number(o?.paidAmount ?? o?.amountPaid ?? o?.totalPaid ?? o?.total ?? o?.price ?? 0) : 0), 0);",
 'never infer collected revenue from workflow order status');
 c=replace(c,
 "  config.governance = {...config.governance, ownerVetoActive:false, credentialModification:false, unrestrictedProductionMutation:false, selfPromotion:false, selfEscalation:false};",
 "  const vetoReceipt=vetoStore.read(rootDir);\n"+
 "  config.governance = {...config.governance, ownerVetoActive:vetoReceipt.active, credentialModification:false, unrestrictedProductionMutation:false, selfPromotion:false, selfEscalation:false};\n"+
 "  if(!vetoReceipt.verified)console.warn('[KEVIN OWNER VETO] fail-closed',vetoReceipt.reason);",
 'recover owner veto on restart');
 c=replace(c,
 "  app.post('/api/kevin/owner-veto',auth,ownerOnly,async(req,res)=>{config.governance.ownerVetoActive=Boolean(req.body?.active);kernel.core.governance.setOwnerVeto(config.governance.ownerVetoActive);res.json({ok:true,ownerVetoActive:config.governance.ownerVetoActive});});",
 "  app.post('/api/kevin/owner-veto',auth,ownerOnly,async(req,res)=>{\n"+
 "    if(typeof req.body?.active!=='boolean')return res.status(400).json({ok:false,code:'KEVIN_VETO_BOOLEAN_REQUIRED'});\n"+
 "    if(String(process.env.SBC_RUNTIME_ROLE||'readonly').toLowerCase()!=='writer')return res.status(423).json({ok:false,code:'KEVIN_VETO_WRITER_REQUIRED'});\n"+
 "    try{\n"+
 "      const record=vetoStore.save(rootDir,req.body.active);\n"+
 "      kernel.core.governance.setOwnerVeto(record.active);\n"+
 "      return res.json({ok:true,ownerVetoActive:record.active,durable:true});\n"+
 "    }catch(e){\n"+
 "      // A veto may be raised even if persistence failed, but never silently cleared.\n"+
 "      if(req.body.active===true)kernel.core.governance.setOwnerVeto(true);\n"+
 "      return res.status(503).json({ok:false,code:'KEVIN_VETO_PERSIST_FAILED',ownerVetoActive:config.governance.ownerVetoActive});\n"+
 "    }\n"+
 "  });",
 'persist owner veto before reporting success');
 c=replace(c,
 "    if (autonomyBand === 'GREEN' && !dryRun) {",
 "    if (this.config.governance?.ownerVetoActive) {\n"+
 "      status='FROZEN';execution={status:'FROZEN',reason:'OWNER_VETO'};this.metrics.redBlocked++;\n"+
 "    } else if (autonomyBand === 'GREEN' && !dryRun) {",
 'recheck owner veto at execution boundary');
 c=replace(c,
 "  async executeSafe(payload) {\n",
 "  async executeSafe(payload) {\n"+
 "    if(this.config.governance?.ownerVetoActive)throw Error('KEVIN_OWNER_VETO_ACTIVE');\n",
 'direct safe action guard');
 c=replace(c,
 "  async stageYellow({ tenantId, proposalId, type, payload, idempotencyKey }) {\n",
 "  async stageYellow({ tenantId, proposalId, type, payload, idempotencyKey }) {\n"+
 "    if(this.config.governance?.ownerVetoActive)return {status:'FROZEN',reason:'OWNER_VETO'};\n",
 'direct stage guard');
 c=replace(c,
 "module.exports={startKevinV6422, startKevinV641:startKevinV6422, startKevinV63:startKevinV6422, deterministicIdempotencyKey, HardenedControlPlane};",
 "module.exports={startKevinV6422, startKevinV641:startKevinV6422, startKevinV63:startKevinV6422, deterministicIdempotencyKey, HardenedControlPlane, sbcV6643SummarizeDb:summarizeDb};",
 'expose pure financial summary for audited regression');
 new vm.Script(c,{filename:rel});
 new vm.Script(fs.readFileSync(helper,'utf8'),{filename:'owner-veto-store.cjs'});
 fs.copyFileSync(helper,installed);
 fs.writeFileSync(target,c);
 return {marker:MARKER,files:[rel,'enterprise/kevin/owner-veto-store.cjs'],
    defaultFailClosed:true,readOnlyPreviewWrites:false,ownerVetoDurable:true,
    noCredentialChange:true,noSchemaChange:true,noPaymentMutation:true};
}
module.exports={apply,MARKER};
