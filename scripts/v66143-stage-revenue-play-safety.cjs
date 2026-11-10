'use strict';
/* Stage-only Revenue PLAY correction; pinned server.js remains unchanged.
 * No outbound traffic, DB writes, provider calls, DDL, or activation occurs here.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66143_REVENUE_PLAY_OUTREACH_GUARD';
function once(s,needle,replacement,label){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error('V66143_ANCHOR_'+label+':'+count);
 return s.replace(needle,replacement);
}
function patchServer(input){
 let s=String(input||'');
 if(s.includes(MARK))return s;
 s=once(s,
  "function revenueVerificationOptedOut(c){",
  "function revenueVerificationOptedOut(c){ if(require('./enterprise/v66143-revenue-play-outreach-policy.cjs').suppressed(c))return true;",
  'verification-suppression');
 s=once(s,
  "function routeRevenueLead(c){\n  if(!c) return {route:'NO_VALID_CONTACT_METHOD',reason:'NO_RECORD'};",
  "function routeRevenueLead(c){\n  if(!c) return {route:'NO_VALID_CONTACT_METHOD',reason:'NO_RECORD'};\n  /* "+MARK+" */\n  const outreachGuard=require('./enterprise/v66143-revenue-play-outreach-policy.cjs');\n  if(outreachGuard.suppressed(c))return {route:'SUPPRESSED',reason:'DURABLE_DO_NOT_CONTACT_OR_OPT_OUT'};",
  'route-DNC');
 s=once(s,
  "  if(email && revenueEmailShape(email)) return {route:'ROUTED_EMAIL',reason:'VALID_EMAIL'};",
  "  if(email && revenueEmailShape(email)){\n    const emailReview=outreachGuard.emailReview(c,process.env);\n    if(!phone||!revenuePhoneShape(phone))return {route:'HELD_EMAIL_OWNER_REVIEW',reason:emailReview.reason};\n    // A phone number is actionable only as a manually reviewed call or consented SMS; no legacy marketing SMTP.\n  }",
  'email-default');
 s=once(s,
  "  if(phone && REVENUE_SUPERVISOR.smsEligible(c)) return {route:'ROUTED_SMS',reason:'RECORDED_SMS_CONSENT'};",
  "  if(phone && revenuePhoneShape(phone) && REVENUE_SUPERVISOR.smsEligible(c)) return {route:'ROUTED_SMS',reason:'RECORDED_SMS_CONSENT'};",
  'sms-shape');
 s=once(s,
  "  if(phone) return {route:'ROUTED_HUMAN_CALL',reason:'PHONE_ONLY_NO_SMS_CONSENT'};",
  "  if(phone && revenuePhoneShape(phone)) return {route:'ROUTED_HUMAN_CALL',reason:'NO_AUTOMATED_MARKETING_PERMISSION_REVIEW_CALL'};",
  'human-call-shape');
 s=once(s,
  "async function processRevenueFollowups({tenantId}={}){\n  const sbcRevenueTenant=requireTenantValue(tenantId);",
  "async function processRevenueFollowups({tenantId}={}){\n  const sbcRevenueTenant=requireTenantValue(tenantId);\n  // V66.143: legacy unattended marketing followups cannot use transactional SMTP.\n  // The separately governed consented-email rail requires individual owner task approval.\n  return {processed:0,sent:0,blocked:0,skipped:0,reason:'LEGACY_MARKETING_FOLLOWUPS_HELD_FOR_REVIEW'};",
  'legacy-followup-block');
 s=once(s,
  "    const emailReady=routes.filter(x=>x.route==='ROUTED_EMAIL').length;",
  "    const emailReady=routes.filter(x=>x.route==='ROUTED_EMAIL').length;\n    const emailReviewHeld=routes.filter(x=>x.route==='HELD_EMAIL_OWNER_REVIEW').length;",
  'status-email-held');
 s=once(s,
  "eligible:eligible.length,emailReady,smsReady,humanCallReady,autonomousActionable,actionable,verifiedWarmHotWithContact,unroutable",
  "eligible:eligible.length,emailReady,emailReviewHeld,smsReady,humanCallReady,autonomousActionable,actionable,verifiedWarmHotWithContact,unroutable",
  'status-breakdown');
 s=once(s,
  "note:'Revenue PLAY never infers verification from Warm/Hot. Every verified Warm/Hot lead with a valid email or phone must route to exactly one action path: email, consented SMS, or human Revenue Call. Human-call fallback does not place an automatic voice call; it creates an idempotent task for the sales caller. unroutable should remain 0.'",
  "note:'Revenue PLAY uses automated contact-record checks, not human identity verification. Legacy promotional SMTP and its followup loop are held. Only consented SMS or human-reviewed phone tasks can enter batch PLAY; email-only contacts are held for individual owner review in the separate consented marketing channel. SMS is not sent without recorded consent.'",
  'status-note');
 return s;
}
if(require.main===module){
 const fp=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(fp,'utf8');
 const after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66143_ISOLATED_STAGE!=='YES')throw Error('V66143_ISOLATED_STAGE_ONLY');
  fs.writeFileSync(fp,after);console.log('SBC V66.143 staged Revenue PLAY suppression/marketing safety');
 }else console.log('SBC V66.143 anchor preflight OK; source not changed');
}
module.exports={MARK,patchServer};
