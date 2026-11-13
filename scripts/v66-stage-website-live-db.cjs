'use strict';
// Gate repairs to the isolated GoDaddy release candidate; do not mutate
// pinned a-sbc-master/server.js or loosen tenant ownership requirements.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_WEBSITE_LIVE_DB_AFTER_MYSQL_HYDRATION_V1';
const MODULES=[
  'sbc-website-production-routes',
  'sbc-website-appointments',
  'sbc-website-call-desk',
  'sbc-website-sales-board'
];
function patchServer(input){
 if(input.includes(MARK))return input;
 let result=input;
 // Existing source may contain the preview, call-desk and sales-board routes
 // but not the appointment registration. Restore that exact missing route.
 const appointmentPrefix="require('./enterprise/sbc-website-appointments.cjs').register(app,{";
 if(!result.includes(appointmentPrefix)){
   assert(!result.includes("app.post('/api/website-production/appointments'"),'Duplicate appointment route conflict');
   const productionPrefix="require('./enterprise/sbc-website-production-routes.cjs').register(app,{";
   const productionRows=result.split('\n').filter(s=>s.includes(productionPrefix));
   assert.equal(productionRows.length,1,'Must find exactly one website production route');
   const row=productionRows[0];
   const appointmentRegistration="require('./enterprise/sbc-website-appointments.cjs').register(app,{auth,requireTenant:requireRequestTenant,db,getStore:megaData,saveData,writerReady:()=>!SBC_RUNTIME_READ_ONLY&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady});";
   result=result.replace(row,()=>row+'\n'+appointmentRegistration);
 }
 for(const name of MODULES){
   const prefix="require('./enterprise/"+name+".cjs').register(app,{";
   const candidates=result.split('\n').filter(s=>s.includes(prefix));
   assert.equal(candidates.length,1,'Website live DB stage requires one existing module: '+name);
   const line=candidates[0];
   assert(line.includes(',db,'),'Expected old captured db in '+name);
   const replacement=line.replace(',db,',',db:SBC_LIVE_DB,');
   assert.notEqual(replacement,line,'No binding rewritten for '+name);
   result=result.replace(line,()=>replacement);
 }
 const first="require('./enterprise/"+MODULES[0]+".cjs').register(app,{";
 const injection="const SBC_LIVE_DB=require('./enterprise/sbc-live-db-view.cjs').createLiveDbView(()=>db); // "+MARK+"\n";
 assert.equal(result.split(first).length-1,1,'Website Production first route anchor moved');
 result=result.replace(first,()=>injection+first);
 return result;
}
if(require.main===module){
 const file=path.join(__dirname,'../server.js');
 const before=fs.readFileSync(file,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  assert.equal(process.env.SBC_ISOLATED_WEBSITE_DB_STAGE,'YES','Only the disposable staging candidate may change');
  if(before!==after)fs.writeFileSync(file,after);
 }
 console.log('SBC Website live MySQL CRM hydration binding verified');
}
module.exports={patchServer,MARK,MODULES};
