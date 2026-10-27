'use strict';
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const VERSION='1.0.0';
const PROTECTED=new Set(['issue_refund','change_price','rotate_credentials','delete_customer','delete_production','change_security_policy','grant_owner_access','send_high_value_quote','publish_unapproved_production','change_billing_authority','execute_vendor_payout']);
const HIGH_RISK=new Set(['financial','credential','legal','destructive','external_publish','vendor_payout']);

function now(){return new Date().toISOString()}
function id(prefix){return `${prefix}_${crypto.randomBytes(8).toString('hex')}`}
function stateDir(){return process.env.SBC_AUTONOMOUS_STATE_DIR||path.join(require('os').tmpdir(),'sbc-autonomous')}
function statePath(){return path.join(stateDir(),'business-fabric.json')}
function bounded(a,n=500){return Array.isArray(a)?a.slice(-n):[]}
function safeLoad(){try{return JSON.parse(fs.readFileSync(statePath(),'utf8'))}catch{return {events:[],actions:[],exceptions:[],verifications:[],outbox:[]}}}
function persist(s){fs.mkdirSync(stateDir(),{recursive:true});fs.writeFileSync(statePath(),JSON.stringify({...s,events:bounded(s.events),actions:bounded(s.actions),exceptions:bounded(s.exceptions),verifications:bounded(s.verifications),outbox:bounded(s.outbox)},null,2))}

class AutonomousBusinessFabric{
 constructor(config={}){this.config=config;this.state=safeLoad()}
 save(){persist(this.state);return this.state}
 risk(action,risk='normal',irreversible=false){const r=String(risk||'normal').toLowerCase();const protectedAction=PROTECTED.has(String(action));const high=irreversible||protectedAction||HIGH_RISK.has(r);return {level:high?'HIGH':r.toUpperCase(),requiresHuman:high||protectedAction,protected:protectedAction}}
 emit(type,payload={},source='system'){const evt={id:id('evt'),type:String(type).slice(0,120),source:String(source).slice(0,120),payload:JSON.parse(JSON.stringify(payload||{})),createdAt:now(),status:'QUEUED'};this.state.events.push(evt);this.state.outbox.push({id:id('out'),eventId:evt.id,status:'READY',createdAt:evt.createdAt});this.save();return evt}
 decide(input={}){const action=String(input.action||'observe');const gate=this.risk(action,input.risk,input.irreversible);const confidence=Math.max(0,Math.min(1,Number(input.confidence??0)));
  const autoAllowed=!gate.requiresHuman && confidence>=Number(process.env.SBC_AUTONOMY_CONFIDENCE||0.85);
  const decision={id:id('dec'),action,confidence,risk:gate.level,requiresHuman:!autoAllowed,reason:!autoAllowed?(gate.requiresHuman?'RISK_OR_PROTECTED_ACTION':'CONFIDENCE_BELOW_POLICY'):'POLICY_ALLOW',createdAt:now()};
  this.state.actions.push(decision);if(decision.requiresHuman)this.state.exceptions.push({...decision,status:'OPEN'});this.save();return decision;}
 preflight(input={}){const deps=Array.isArray(input.dependencies)?input.dependencies:[];const missing=deps.filter(x=>x&&x.required&&!x.ready).map(x=>x.name||'dependency');const auth=Boolean(input.authorized!==false);const tenant=Boolean(input.tenantId);const ok=auth&&tenant&&!missing.length;return {ok,tenantId:input.tenantId||null,missing,authorized:auth,checks:{tenant,authorization:auth,dependencies:!missing.length,rollback:Boolean(input.rollbackPlan!==false)},createdAt:now()}}
 verify(input={}){const expected=String(input.expected||'');const observed=String(input.observed||'');const ok=input.ok===true||(!expected&&Boolean(observed))||(expected&&observed===expected);const v={id:id('ver'),actionId:input.actionId||null,ok,expected:expected||null,observed:observed||null,providerVerified:Boolean(input.providerVerified),createdAt:now()};this.state.verifications.push(v);if(!ok)this.state.exceptions.push({id:id('exc'),type:'verification_failed',status:'OPEN',verificationId:v.id,createdAt:v.createdAt});this.save();return v}
 handshake(input={}){return {schema:'sbc.autonomy.v1',fabricVersion:VERSION,correlationId:input.correlationId||id('cor'),eventType:input.eventType||'unknown',tenantId:input.tenantId||null,orderId:input.orderId||null,source:input.source||'command-center',expiresAt:new Date(Date.now()+Number(input.ttlMs||300000)).toISOString()}}
 summary(){return {version:VERSION,principle:'AI_FIRST_HUMAN_LAST',events:this.state.events.length,actions:this.state.actions.length,openExceptions:this.state.exceptions.filter(x=>x.status==='OPEN').length,verifications:this.state.verifications.length,readyOutbox:this.state.outbox.filter(x=>x.status==='READY').length,protectedActions:[...PROTECTED]}}
}
module.exports={AutonomousBusinessFabric,PROTECTED,HIGH_RISK,VERSION};
