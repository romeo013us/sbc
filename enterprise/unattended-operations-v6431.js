'use strict';
const crypto=require('crypto');
const VERSION='64.3.1';
const DEFAULTS=Object.freeze({
  horizonDays:21,
  dailyLeadWorkCap:50,
  dailyOutreachCap:100,
  dailyFollowupCap:100,
  maxAutonomousRevenueActions:0,
  ownerBriefHour:18,
  minimumLeadInventory:1
});
const PROTECTED=new Set(['refund','move_money','restore_crm','delete_customer','delete_production','change_credentials','change_security','publish_unapproved']);
function iso(){return new Date().toISOString()}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')}
function inventory(db){
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const quotes=Array.isArray(db?.quotes)?db.quotes:[];
  const renewals=Array.isArray(db?.renewals)?db.renewals:[];
  const active=customers.filter(c=>String(c?.status||'').toLowerCase()!=='deleted');
  const paid=orders.filter(o=>['paid','completed','payment_received'].includes(String(o?.paymentStatus||o?.status||'').toLowerCase()));
  const hot=active.filter(c=>String(c?.leadTemperature||c?.temperature||c?.quality||'').toLowerCase()==='hot').length;
  const warm=active.filter(c=>String(c?.leadTemperature||c?.temperature||c?.quality||'').toLowerCase()==='warm').length;
  return {crmLeads:active.length,hot,warm,quotes:quotes.length,orders:orders.length,paidOrders:paid.length,renewals:renewals.length}
}
function gate({db,recoveryRequired=false,providerHealth={}}={}){
  const inv=inventory(db||{});
  const checks={
    authoritativeCRM:inv.crmLeads>=DEFAULTS.minimumLeadInventory,
    recoveryClear:!recoveryRequired,
    financialAutonomyBlocked:true,
    ownerVeto:true,
    providerHealthKnown:Object.values(providerHealth||{}).length>0 && Object.values(providerHealth||{}).every(v=>v==='OK'),
    idempotencyRequired:true,
    outreachCaps:true
  };
  const blockers=[];
  if(!checks.authoritativeCRM)blockers.push('NO_AUTHORITATIVE_CRM_LEADS');
  if(!checks.recoveryClear)blockers.push('MYSQL_RECOVERY_REQUIRED');
  if(!checks.providerHealthKnown)blockers.push('PROVIDER_HEALTH_NOT_VERIFIED');
  return {ready:blockers.length===0,mode:blockers.length?'NOT_READY':'UNATTENDED_READY',version:VERSION,horizonDays:DEFAULTS.horizonDays,inventory:inv,checks,blockers,generatedAt:iso()};
}
function brief({db,recoveryRequired=false,providerHealth={},autonomy={}}={}){
  const g=gate({db,recoveryRequired,providerHealth});
  const inv=g.inventory;
  return {version:VERSION,generatedAt:iso(),status:g.ready?'GREEN':'ATTENTION',headline:g.ready?'SBC IS READY FOR CONTROLLED UNATTENDED OPERATIONS':'SBC IS NOT YET CERTIFIED FOR UNATTENDED REVENUE',revenue:{paidOrders:inv.paidOrders,quotes:inv.quotes,renewals:inv.renewals},leadInventory:{total:inv.crmLeads,hot:inv.hot,warm:inv.warm},autonomy:{mode:autonomy.mode||'UNKNOWN',paused:Boolean(autonomy.paused),openExceptions:Number(autonomy.openExceptions||0)},blockers:g.blockers,ownerAction:g.ready?'No owner action required for routine work; protected actions remain owner-controlled.':'Resolve the listed blockers before leaving SBC unattended.'};
}
function simulate21Day({startingLeads=0,dailyNewLeads=0,dailyOutreach=0,conversionRate=0.02,avgOrderValue=349}={}){
  let leads=Math.max(0,Number(startingLeads)||0),revenue=0,contacts=0,won=0;
  for(let day=1;day<=21;day++){
    leads+=Math.max(0,Number(dailyNewLeads)||0);
    const work=Math.min(leads,DEFAULTS.dailyOutreachCap,Math.max(0,Number(dailyOutreach)||0));
    contacts+=work;
    const wins=Math.floor(work*Math.max(0,Math.min(1,Number(conversionRate)||0)));
    won+=wins; revenue+=wins*Math.max(0,Number(avgOrderValue)||0); leads=Math.max(0,leads-wins);
  }
  return {days:21,startingLeads,dailyNewLeads,dailyOutreach,conversionRate,avgOrderValue,contacts,won,revenue,model:'simulation_only_not_forecast'};
}
function idempotencyKey(action,payload){return hash({action,payload})}
function policy(action){return PROTECTED.has(action)?{allowed:false,decision:'OWNER_REQUIRED'}:{allowed:true,decision:'AUTONOMOUS_ALLOWED'};}
module.exports={VERSION,DEFAULTS,PROTECTED,inventory,gate,brief,simulate21Day,idempotencyKey,policy};
