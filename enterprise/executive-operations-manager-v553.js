'use strict';

/**
 * SBC V55.3 — Executive Operations Manager
 * Kim's boss layer: observe -> decide -> act -> verify -> report.
 * It only performs reversible/approved operational actions automatically.
 * Owner-only controls (pricing, refunds, credentials, disputes, destructive
 * infrastructure) are surfaced as decisions and are never executed here.
 */

function clean(v,max=1000){return String(v??'').replace(/\u0000/g,'').trim().slice(0,max)}
function ts(){return new Date().toISOString()}

function createExecutiveManager({db,saveData,audit,runRevenuePlay,revenueStatus,revenueSupervisor,megaData,websiteDemos=[],logger=console}={}){
  if(!db)throw new Error('Executive manager requires db.');
  const state=db.executiveManager=db.executiveManager||{version:'55.3.0',lastCycleAt:'',lastResult:null,decisions:[],actions:[],faults:[]};
  for(const k of ['decisions','actions','faults'])state[k]=Array.isArray(state[k])?state[k]:[];

  function record(bucket,type,message,meta={}){
    const row={type,message:clean(message,1200),meta,createdAt:ts()};
    state[bucket].unshift(row);state[bucket]=state[bucket].slice(0,200);return row;
  }
  function decision(type,message,meta={}){return record('decisions',type,message,meta)}
  function action(type,message,meta={}){return record('actions',type,message,meta)}
  function fault(type,message,meta={}){return record('faults',type,message,meta)}

  function productionOn(){return !Boolean(db.fantastic4?.autonomous?.paused)}
  function eligibleLeads(){
    const now=Date.now();
    return (db.customers||[]).filter(c=>{
      const verification=String(c.verificationStatus||'').trim().toLowerCase().replace(/[-_]+/g,' ');
      const temp=String(c.leadTemperature||'').trim().toLowerCase();
      const last=Number(new Date(c.sbcRevenueOutreachAt||0).getTime());
      const cooldown=last>0 && now-last<Number(process.env.SBC_REVENUE_OUTREACH_COOLDOWN_MS||7*86400000);
      return !['customer','lost'].includes(String(c.status||'').toLowerCase())&&!cooldown&&['verified','sales ready'].includes(verification)&&['warm','hot'].includes(temp)&&(c.email||c.phone);
    });
  }
  function snapshot(){
    const customers=db.customers||[],orders=db.orders||[],tasks=db.tasks||[],m=typeof megaData==='function'?megaData():{nextActions:[],fulfillmentJobs:[],approvals:[],automationFailures:[]};
    const paid=orders.filter(o=>String(o.paymentStatus||'').toLowerCase()==='paid'||String(o.status||'').toLowerCase()==='paid');
    const activeConversations=customers.filter(c=>['Contacted','Qualified','Proposal','Checkout'].includes(String(c.status||''))).length;
    const openOwner=Array.isArray(m.approvals)?m.approvals.filter(x=>String(x.status||'').startsWith('Pending Owner')).length:0;
    const fulfillment=Array.isArray(m.fulfillmentJobs)?m.fulfillmentJobs.filter(x=>['ready','processing','failed'].includes(x.status)).length:0;
    const recovery=Array.isArray(m.automationFailures)?m.automationFailures.filter(x=>String(x.status||'').toLowerCase()==='open').length:0;
    return {productionOn:productionOn(),eligibleLeads:eligibleLeads().length,activeConversations,checkouts:orders.filter(o=>['Pending','Quote','Checkout'].includes(String(o.status||''))&&String(o.paymentStatus||'').toLowerCase()!=='paid').length,paid:paid.length,fulfillment,recovery,ownerDecisions:openOwner,openTasks:tasks.filter(t=>String(t.status||'').toLowerCase()==='open').length};
  }

  async function cycle(reason='scheduled'){
    const started=Date.now(), snap=snapshot(), result={ok:true,version:'55.3.0',reason,startedAt:ts(),snapshot:snap,actions:[],decisions:[]};
    try{
      // Boss rule: if production is on and verified warm/hot leads exist, work a small
      // bounded batch. Never exceed the configured cap and never bypass Revenue PLAY's own gates.
      const autoPlay=String(process.env.SBC_EXECUTIVE_AUTOPLAY||'true').toLowerCase()!=='false';
      const batch=Math.max(1,Math.min(10,Number(process.env.SBC_EXECUTIVE_PLAY_BATCH||5)));
      if(productionOn()&&autoPlay&&snap.eligibleLeads>0&&typeof runRevenuePlay==='function'){
        const last=Number(state.lastAutoPlayAtMs||0);
        const interval=Math.max(5*60*1000,Number(process.env.SBC_EXECUTIVE_PLAY_INTERVAL_MS||15*60*1000));
        if(Date.now()-last>=interval){
          state.lastAutoPlayAtMs=Date.now();
          const out=await runRevenuePlay({limit:batch,reason:`executive-manager:${reason}`});
          result.actions.push({type:'revenue_play',...out});
          if(out.locked)fault('revenue_play_lock','Revenue PLAY was busy; no duplicate execution was attempted.',{reason:out.reason});
          else action('revenue_play','Executive manager ran a bounded Revenue PLAY batch.',{processed:out.processed,sent:out.sent,queuedCalls:out.queuedCalls,failed:out.failed});
        }
      }else if(!productionOn()&&snap.eligibleLeads>0){decision('production_off','Verified revenue leads are waiting, but Production is off. No outreach was sent.',{eligibleLeads:snap.eligibleLeads});}

      const supervisor=typeof revenueSupervisor?.summary==='function'?revenueSupervisor.summary():null;
      if(supervisor?.recentFailures?.length) result.supervisorFailures=supervisor.recentFailures.slice(0,5);
      // Never auto-execute owner-controlled money/security decisions.
      if(snap.ownerDecisions>0){const d=decision('owner_review',`${snap.ownerDecisions} owner decision(s) require Romeo.`,{count:snap.ownerDecisions});result.decisions.push(d)}
      if(snap.recovery>0){const d=decision('recovery_review',`${snap.recovery} open automation recovery item(s) require operational review.`,{count:snap.recovery});result.decisions.push(d)}

      state.lastCycleAt=ts();state.lastResult={...result,durationMs:Date.now()-started};await saveData?.();return state.lastResult;
    }catch(e){fault('executive_cycle',e.message,{reason});state.lastCycleAt=ts();state.lastResult={ok:false,version:'55.3.0',reason,error:clean(e.message),durationMs:Date.now()-started};try{await saveData?.()}catch{};logger?.warn?.('[V55.3 EXECUTIVE]',e.message);return state.lastResult;}
  }

  function summary(){
    return {version:'55.3.0',lastCycleAt:state.lastCycleAt,lastResult:state.lastResult,snapshot:snapshot(),recentActions:state.actions.slice(0,15),ownerDecisions:state.decisions.slice(0,15),recentFaults:state.faults.slice(0,15)};
  }
  return {cycle,snapshot,summary,decision,action,fault};
}
module.exports={createExecutiveManager};
