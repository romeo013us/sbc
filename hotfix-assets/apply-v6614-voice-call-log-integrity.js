'use strict';
/*
 * SBC V66.1.4 - fail-closed call-log tenant ownership and accurate lifecycles.
 * Applies only to the reconstructed runtime, not live data or Twilio secrets.
 */
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6614_VOICE_CALL_LOG_INTEGRITY';

function exactly(source,before,after,count,reason){
  const actual=source.split(before).length-1;
  if(actual!==count)throw Error(MARKER+': '+reason+': expected '+count+' anchors, found '+actual);
  return source.split(before).join(after);
}
function apply(root){
  const file=path.join(root,'server.js');
  let original=fs.readFileSync(file,'utf8');
  if(original.includes(MARKER))return {marker:MARKER,changed:false};
  let s=original;
  // All authorizations must derive from the authenticated request tenant.
  // Orphan rows must never become accessible across tenants.
  const oldCustomer="const customer=(db.customers||[]).find(c=>String(c.id)===customerId);if(!customer||(customer.tenantId!=null&&Number(customer.tenantId)!==Number(tenantId)))";
  const newCustomer="const customer=(db.customers||[]).find(c=>String(c.id)===customerId&&Number(c.tenantId??c.tenant_id)===Number(tenantId));if(!customer)";
  s=exactly(s,oldCustomer,newCustomer,2,'tenant-specific customer lookup for voice read/write');
  // A Set object is always truthy. Check membership instead of the Set itself.
  s=exactly(s,
    "endedAt:terminal?String(b.endedAt||stamp).slice(0,40):''",
    "endedAt:terminal.has(status)?String(b.endedAt||stamp).slice(0,40):''",
    1,'new connecting calls must not be prematurely ended');
  s=exactly(s,
    "if(terminal)log.endedAt=String(b.endedAt||stamp).slice(0,40)",
    "if(terminal.has(status))log.endedAt=String(b.endedAt||stamp).slice(0,40)",
    1,'nonterminal update must not set endedAt');
  const at=s.indexOf("app.get('/api/voice/logs',auth,");
  if(at<0)throw Error(MARKER+': voice log endpoint missing');
  s=s.slice(0,at)+"// "+MARKER+": verified tenant scoping + terminal-status timestamp checks.\n"+s.slice(at);
  fs.writeFileSync(file,s);
  const destination=path.join(root,'scripts','v6614-voice-call-log-integrity-test.cjs');
  const testSource=path.join(__dirname,'v6614-voice-call-log-integrity-test.cjs');
  if(!fs.existsSync(testSource))throw Error(MARKER+': expected call-log regression suite');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(testSource,destination);
  return {marker:MARKER,changed:true,voiceCredentialsChanged:false,writerGuardsChanged:false,databaseMigrations:false};
}
module.exports={apply,MARKER};
