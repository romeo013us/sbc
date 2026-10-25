'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6625_LEAD_READINESS_TRUTH';
function once(source,needle,replacement,label){const count=source.split(needle).length-1;if(count!==1)throw Error(MARKER+': '+label+' count '+count);return source.replace(needle,replacement);}
function apply(root){
 const file=path.join(root,'server.js');let s=fs.readFileSync(file,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': already applied');
 s=once(s,'const workableMigration=promoteAllActiveLeadsToWorkable();if(workableMigration.changed)await saveData();','const workableMigration={changed:0,automaticPromotionDisabled:true};','prevent bulk startup promotion');
 s=once(s,'workable ${workableMigration.changed||0}','workablePromotedThisBoot ${workableMigration.changed||0} (not total actionable leads; use /api/owner/lead-readiness)','clarify legacy log');
 const route=[
  '// SBC_V6625_LEAD_READINESS_TRUTH — owner-only, read-only, tenant-scoped counts.',
  "const SBC_V6625_AUDIT=require('./enterprise/v6625-lead-readiness-audit.cjs');",
  "app.get('/api/owner/lead-readiness',auth,ownerOnly,(req,res)=>{",
  "  res.setHeader('Cache-Control','no-store');",
  "  try{const tenantId=requireRequestTenant(req);",
  "    const result=SBC_V6625_AUDIT.inspect(db.customers,tenantId,{limit:req.query?.limit});",
  "    res.json({ok:true,version:BUILD_VERSION,recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED),...result,note:'Record verification is not proof of consent or identity. This endpoint never promotes, contacts or changes leads.'});",
  "  }catch(e){res.status(Number(e.status||503)).json({ok:false,error:String(e.code||'LEAD_READINESS_UNAVAILABLE')});}",
  "});"
 ].join('\n');
 s=once(s,"app.get('/api/owner/launch-gates',auth,ownerOnly,async(req,res)=>{",route+"\napp.get('/api/owner/launch-gates',auth,ownerOnly,async(req,res)=>{",'owner endpoint');
 for(const invariant of ['requireRequestTenant(req)','MYSQL_RECOVERY_REQUIRED','SBC_RUNTIME_WRITER_LEASE_REQUIRED'])if(!s.includes(invariant))throw Error(MARKER+': missing '+invariant);
 const helper=path.join(__dirname,'..','enterprise','v6625-lead-readiness-audit.cjs');
 const target=path.join(root,'enterprise','v6625-lead-readiness-audit.cjs');
 if(!fs.existsSync(helper))throw Error(MARKER+': missing helper');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(helper,target);fs.writeFileSync(file,s);
 return {marker:MARKER,changed:true,readOnly:true,tenantScoped:true,automaticPromotionDisabled:true};
}
module.exports={apply,MARKER};