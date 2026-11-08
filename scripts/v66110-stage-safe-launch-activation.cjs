'use strict';
/* SBC V66.110: disposable release staging only; regenerate manifest and receipt after applying. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const serverPath=path.join(root,'server.js');
const autopilotPath=path.join(root,'enterprise/v56150-revenue-autopilot.js');
const notifierPath=path.join(root,'enterprise/sbc-unattended-notifications-v6504.cjs');
const MARK='SBC_V66110_DDL_FREE_DROPZONE_ONLY_LAUNCH';
const verify=process.argv.includes('--verify-staged');
const apply=process.argv.includes('--apply');
if(!verify&&!apply)throw Error('Specify --apply or --verify-staged');
let server=fs.readFileSync(serverPath,'utf8');
let auto=fs.readFileSync(autopilotPath,'utf8');
let notifier=fs.readFileSync(notifierPath,'utf8');
function replaceOnce(input,needle,replacement,label){
 const n=input.split(needle).length-1;
 assert.equal(n,1,label+': expected one anchor; found '+n);
 return input.replace(needle,replacement);
}
if(apply&&!server.includes(MARK)){
 server=replaceOnce(server,
   "async function smtpSendWithFallback(payload){\n  if(!smtpConfig())",
   "async function smtpSendWithFallback(payload){\n  if(SBC_RUNTIME_ROLE==='writer'){const receipt=await require('./enterprise/sbc-hosting-'+'email-gateway.cjs').sendEmail(payload);return {info:{messageId:receipt.messageId,accepted:[payload.to]},port:0,host:'platform-loopback',kind:'platform-gateway'};}\n   if(!smtpConfig())",
   'Published must use platform mail gateway');
 server=replaceOnce(server,
   "async function sendEmail(customer,subject,body){\n  if(RUNTIME_GATE.blocked('AUTONOMOUS_OUTREACH')) throw new Error('AUTONOMOUS_OUTREACH_PAUSED_BY_OWNER');\n  if(!smtpConfig())",
   "async function sendEmail(customer,subject,body){\n  if(RUNTIME_GATE.blocked('AUTONOMOUS_OUTREACH')) throw new Error('AUTONOMOUS_OUTREACH_PAUSED_BY_OWNER');\n  if(SBC_RUNTIME_ROLE!=='writer'&&!smtpConfig())",
   'Published manual email must work without SMTP credentials');
 server=replaceOnce(server,
   "autoDemo:String(process.env.SBC_AUTOPILOT_DEMO_ENABLED||'true').toLowerCase()!=='false',autoOutbound:false",
   "autoDemo:false,autoOutbound:false",
   'Disable unattended auto-demo');
 server=replaceOnce(server,
   "String(process.env.SBC_SMTP_RELAY_ENABLED||'true').toLowerCase()!=='false'",
   "String(process.env.SBC_SMTP_RELAY_ENABLED||'false').toLowerCase()==='true'",
   'Require explicit relay opt-in');
 server=replaceOnce(server,
   "if(candidate.auth!==false) options.auth={user:cfg.user,pass:cfg.pass};",
   "if(candidate.auth!==false) options.auth={user:cfg.user,pass:cfg.pass};\n  if(Number(candidate.port)===587 && candidate.auth!==false){options.requireTLS=true;options.tls={minVersion:'TLSv1.2',servername:cfg.host};}",
   'Require STARTTLS on 587');
 const anchor="  await pulse();\n  sbcNoDdlAdvisoryTimer=setInterval(pulse,";
 const insert=[
 "  // "+MARK+": one verified writer, no database DDL, external outreach, or auto-demo.",
 "  if(String(process.env.SBC_AUTOPILOT_DROPZONE_ENABLED||'true').trim().toLowerCase()!=='false'){",
 "    try {",
 "      REVENUE_AUTOPILOT_V56150.configure({",
 "        db,mysqlPool,asyncIngest:ASYNC_INGEST,saveData,audit,sqlDateTime,",
 "        config:{dropzoneEnabled:true,autoDemo:false,autoOutbound:false}",
 "      });",
 "      REVENUE_AUTOPILOT_V56150.start({dropzoneOnly:true});",
 "      console.log('[SBC_V66110] verified-writer dropzone-only watcher started; no DDL, demo or outbound');",
 "    }catch(e){console.warn('[SBC_V66110] watcher held:',String(e?.code||e?.message||e).slice(0,160));}",
 "  }else console.log('[SBC_V66110] dropzone watcher explicitly disabled by SBC_AUTOPILOT_DROPZONE_ENABLED=false');",
 ""
 ].join('\n');
 server=replaceOnce(server,anchor,insert+anchor,'DDL-free startup anchor');
}
if(apply&&!auto.includes(MARK)){
 auto=replaceOnce(auto,
   "autoDemo:ctx?.config?.autoDemo!==false",
   "autoDemo:ctx?.config?.autoDemo===true",
   'Fail closed on demo status');
 auto=replaceOnce(auto,
   "if(ctx?.config?.autoDemo!==false){try{results.push(await buildDemoForCustomer(c));}",
   "if(ctx?.config?.autoDemo===true){try{results.push(await buildDemoForCustomer(c));}",
   'Fail closed on demo action');
 auto=replaceOnce(auto,
   "async function scanDropzone(){\n  if(ctx?.config?.dropzoneEnabled===false)",
   "async function scanDropzone(){\n  if(!ctx||!ctx.asyncIngest)return {ok:false,skipped:true,reason:'not_configured'};\n  if(ctx?.config?.dropzoneEnabled===false)",
   'Require configured merge worker');
 auto=replaceOnce(auto,
   "function start(){if(watcher||!ctx)return status();",
   "function start({dropzoneOnly=false}={}){if(watcher||scanTimer||!ctx||ctx?.config?.dropzoneEnabled===false)return status(); /* "+MARK+" */",
   'Bounded watcher');
 auto=replaceOnce(auto,
   "scanDropzone().catch(()=>{});runOnce().catch(()=>{})",
   "scanDropzone().catch(()=>{});if(!dropzoneOnly)runOnce().catch(()=>{})",
   'Never run sales cycle in dropzone-only mode');
}

if(apply&&!notifier.includes('SBC_V66110_PLATFORM_GATEWAY_OWNER_NOTIFICATIONS')){
 notifier=replaceOnce(notifier,
   "    const cfg = this._smtpConfig(), to = this._contacts().email;\n    if (!cfg.configured",
   [
   "    const cfg = this._smtpConfig(), to = this._contacts().email;",
   "    // SBC_V66110_PLATFORM_GATEWAY_OWNER_NOTIFICATIONS: use GoDaddy's internal email gateway.",
   "    if(String(this.env.SBC_RUNTIME_ROLE||'').trim().toLowerCase()==='writer' && to){",
   "      try{",
   "        const sent=await require('./sbc-hosting-'+'email-gateway.cjs').sendEmail({to,subject,text,html});",
   "        this.lastResult.email={at:this.clock().toISOString(),ok:true,messageId:sent.messageId,transportPort:0,transport:'platform-gateway'};",
   "        return {ok:true,messageId:sent.messageId,acceptedCount:1};",
   "      }catch(e){this.lastResult.email={at:this.clock().toISOString(),ok:false,code:String(e?.code||'EMAIL_GATEWAY_FAILURE')};throw e;}",
   "    }",
   "    if (!cfg.configured"
   ].join('\n'),
   'Owner notification GoDaddy gateway');
 notifier=replaceOnce(notifier,
   "channels: { email: { configured: smtp.configured && Boolean(c.email), transportConfigured: smtp.configured, recipientConfigured: Boolean(c.email) }",
   "channels: { email: { configured: (smtp.configured || String(this.env.SBC_RUNTIME_ROLE||'').toLowerCase()==='writer') && Boolean(c.email), transportConfigured: smtp.configured || String(this.env.SBC_RUNTIME_ROLE||'').toLowerCase()==='writer', recipientConfigured: Boolean(c.email) }",
   'Published platform gateway availability status (not delivery verification)');
}

assert(server.includes(MARK),'DDL-free activation mark missing');
assert(server.includes("kind:'platform-gateway'"),'Published customer email gateway not staged');
assert(notifier.includes('SBC_V66110_PLATFORM_GATEWAY_OWNER_NOTIFICATIONS'),'owner mail gateway not staged');
assert(auto.includes(MARK),'bounded watcher mark missing');
assert(server.includes("autoDemo:false,autoOutbound:false"),'automatic demo/outbound must be off');
assert(server.includes("SBC_SMTP_RELAY_ENABLED||'false'"),'SMTP relay default must be off');
assert(server.includes("SBC_AUTOPILOT_DROPZONE_ENABLED||'true'"),'default-on safe lead intake requires healthy verified writer');
assert(server.includes("!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady"),'must retain recovery/lease gates');
assert(auto.includes("if(!dropzoneOnly)runOnce().catch(()=>{})"),'dropzone-only cannot execute sales');
assert(auto.includes('autoDemo:ctx?.config?.autoDemo===true'),'demo default must be off');
if(apply){fs.writeFileSync(serverPath,server);fs.writeFileSync(autopilotPath,auto);fs.writeFileSync(notifierPath,notifier);}
console.log('[SBC V66.110] '+(apply?'STAGED':'VERIFIED')+': DDL-free intake; demos/outbound off; STARTTLS required');
