'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const POLICY=require('../enterprise/v66143-revenue-play-outreach-policy.cjs');
const STAGE=require('./v66143-stage-revenue-play-safety.cjs');
const source=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const staged=STAGE.patchServer(source);
assert(staged.includes(STAGE.MARK));
assert.equal(STAGE.patchServer(staged),staged,'stage must be idempotent');
new vm.Script(staged,{filename:'server.js'});
if(process.argv.includes('--staged'))assert.equal(staged,source,'compiled staging should include DNC/marketing guard');

const basic={id:'c1',businessName:'Verified Small Business',status:'Lead',
 email:'owner@samplebusiness.com',phone:'3055550101',leadTemperature:'Warm',verificationStatus:'Sales Ready'};
assert.equal(POLICY.suppressed({...basic,doNotContact:true}),true);
assert.equal(POLICY.suppressed({...basic,doNotCall:true}),true);
assert.equal(POLICY.suppressed({...basic,salesSuppressed:true}),true);
assert.equal(POLICY.suppressed({...basic,status:'Do Not Call'}),true);
assert.equal(POLICY.suppressed({...basic,notes:'Customer says do not contact'}),true);
assert.equal(POLICY.suppressed({...basic,leadIntelligence:{sbcOutreach:{marketingEmailOptOut:true}}}),true);
assert.equal(POLICY.suppressed(basic),false);
assert.equal(POLICY.emailReview(basic).ready,false,'public business email is not recorded opt-in');
const consented={...basic,leadIntelligence:{sbcOutreach:{
 marketingEmailConsent:true,marketingEmailConsentAt:new Date().toISOString(),
 marketingEmailConsentSource:'documented_opt_in: customer requested marketing by email'
}}};
assert.equal(POLICY.emailReview(consented).ready,false,'consent cannot substitute for provider setup');

const routeStart=staged.indexOf('function routeRevenueLead(c){');
const routeEnd=staged.indexOf('\nfunction revenueLeadEligible(c){',routeStart);
assert(routeStart>=0&&routeEnd>routeStart,'exact route slice found');
const context={
 require(p){assert(p.endsWith('v66143-revenue-play-outreach-policy.cjs'));return POLICY;},
 process:{env:{}},
 isSbcSyntheticTestRecord:()=>false,revenueOutreachExhausted:()=>false,
 revenueOutreachCooldownActive:()=>false,
 revenueVerificationState:c=>String(c.verificationStatus||'').trim().toLowerCase(),
 revenueTemperature:c=>String(c.leadTemperature||'').trim().toLowerCase(),
 revenueEmailShape:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)),
 revenuePhoneShape:v=>/^\d{10}$/.test(String(v).replace(/\D/g,'')),
 REVENUE_SUPERVISOR:{smsEligible:c=>c.smsConsent===true}
};
vm.runInNewContext(staged.slice(routeStart,routeEnd),context);
const route=c=>context.routeRevenueLead(c).route;
assert.equal(route({...basic,doNotContact:true}),'SUPPRESSED');
assert.equal(route({...basic,doNotCall:true}),'SUPPRESSED');
assert.equal(route({...basic,salesSuppressed:true}),'SUPPRESSED');
assert.equal(route({...basic,status:'Do Not Call'}),'SUPPRESSED');
assert.equal(route({...basic,leadIntelligence:{sbcOutreach:{marketingEmailOptOut:true}}}),'SUPPRESSED');
assert.equal(route({...basic,phone:''}),'HELD_EMAIL_OWNER_REVIEW');
assert.equal(route(basic),'ROUTED_HUMAN_CALL','no implicit marketing email or SMS');
assert.equal(route({...basic,smsConsent:true}),'ROUTED_SMS','consented SMS still routes');
assert.equal(route({...basic,email:'',phone:'123'}),'NO_VALID_CONTACT_METHOD');
const followStart=staged.indexOf('async function processRevenueFollowups({tenantId}={}){');
const followEnd=staged.indexOf('async function runRevenueFirstPlay(',followStart);
assert(followStart>=0&&followEnd>followStart);
const fContext={requireTenantValue:t=>t};
vm.runInNewContext(staged.slice(followStart,followEnd),fContext);
fContext.processRevenueFollowups({tenantId:1}).then(r=>{
 assert.equal(r.sent,0);
 assert.equal(r.reason,'LEGACY_MARKETING_FOLLOWUPS_HELD_FOR_REVIEW');
 console.log('PASS V66.143: DNC, consent, route, SMTP hold, staged integrity');
}).catch(e=>{console.error(e);process.exitCode=1});
