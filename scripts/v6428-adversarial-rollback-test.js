'use strict';
const crypto=require('crypto');
function digest(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function clone(x){return JSON.parse(JSON.stringify(x));}
function stageMutation(state,mutation){return {before:clone(state),proposal:clone(mutation),beforeHash:digest(state),status:'STAGED'};}
function executeInSandbox(stage){
  const working=clone(stage.before);
  if(stage.proposal.type==='SET_FIELD') working[stage.proposal.key]=stage.proposal.value;
  if(stage.proposal.type==='DELETE_FIELD') delete working[stage.proposal.key];
  const afterHash=digest(working);
  const verification=stage.proposal.verification==='FAIL' ? {ok:false,reason:'SIMULATED_VERIFICATION_FAILURE'} : {ok:true};
  if(!verification.ok) return {ok:false,rolledBack:true,state:stage.before,beforeHash:stage.beforeHash,afterHash,verification};
  return {ok:true,rolledBack:false,state:working,beforeHash:stage.beforeHash,afterHash,verification};
}
const base={version:'64.2.28',crmCore:0,financialBalance:0,leadMesh:243,automation:'SUSPENDED'};
const checks=[];const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
const stale={loadedEpoch:0,currentEpoch:2};check('stale-epoch-refused',stale.loadedEpoch!==stale.currentEpoch);
const destructive=stageMutation(base,{type:'DELETE_FIELD',key:'leadMesh',verification:'FAIL'});
const rolled=executeInSandbox(destructive);
check('staged-mutation',destructive.status==='STAGED');
check('verification-failure-triggers-rollback',rolled.rolledBack===true&&!rolled.ok);
check('rollback-restores-state',digest(rolled.state)===destructive.beforeHash);
check('rollback-restores-lead-count',rolled.state.leadMesh===243);
check('financial-state-unchanged',rolled.state.financialBalance===0);
const green=stageMutation(base,{type:'SET_FIELD',key:'diagnosticFlag',value:'ok',verification:'PASS'});
const committed=executeInSandbox(green);
check('verified-safe-mutation-commits-in-sandbox',committed.ok&&committed.state.diagnosticFlag==='ok');
check('sandbox-does-not-touch-production-financials',committed.state.financialBalance===0);
const result={ok:checks.every(x=>x.ok),checks,baseHash:digest(base),rollback:{beforeHash:rolled.beforeHash,afterHash:rolled.afterHash,finalHash:digest(rolled.state)},safeCommit:{beforeHash:committed.beforeHash,afterHash:committed.afterHash}};
console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
