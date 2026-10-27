'use strict';
/**
 * Kim Production Open Gate
 * Deterministic, evidence-first gate for declaring SBC ready to accept production traffic.
 * It never prints secret values and never mutates production data or credentials.
 */
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const PRODUCTION_READINESS=require('./production-readiness-gate');

const VERSION='1.0.0';
const REQUIRED_FILES=[
  'server.js','package.json','enterprise/kim-system-steward-v1.js',
  'enterprise/sbc-observability-v1.js','enterprise/production-readiness-gate.js',
  'enterprise/kim-production-open-gate.js','migrations/20260927_001_steward_observability.sql',
  'scripts/kim-steward-test.js','scripts/observability-steward-test.js'
];

function fileCheck(root,rel){
  const p=path.join(root,rel);
  return {name:`file:${rel}`,status:fs.existsSync(p)?'PASS':'BLOCKED',detail:fs.existsSync(p)?'Present':'Missing required production artifact.'};
}
function syntaxCheck(root,rel){
  const p=path.join(root,rel); const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  return {name:`syntax:${rel}`,status:r.status===0?'PASS':'BLOCKED',detail:r.status===0?'JavaScript syntax valid.':String(r.stderr||r.stdout||'Syntax validation failed.').slice(0,500)};
}
function testScript(root,rel){
  const p=path.join(root,rel); const r=spawnSync(process.execPath,[p],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  return {name:`test:${rel}`,status:r.status===0?'PASS':'BLOCKED',detail:String(r.stdout||r.stderr||'Test failed.').slice(-1200)};
}
function run(root=process.cwd(),opts={runTests:true}){
  const checks=[];
  for(const f of REQUIRED_FILES) checks.push(fileCheck(root,f));
  checks.push(syntaxCheck(root,'server.js'));
  checks.push(syntaxCheck(root,'enterprise/kim-system-steward-v1.js'));
  checks.push(syntaxCheck(root,'enterprise/sbc-observability-v1.js'));
  checks.push(syntaxCheck(root,'enterprise/kim-production-open-gate.js'));
  if(opts.runTests){
    checks.push(testScript(root,'scripts/kim-steward-test.js'));
    checks.push(testScript(root,'scripts/observability-steward-test.js'));
  }
  let production;
  try{ production=PRODUCTION_READINESS.run(); }
  catch(e){ production={ok:false,blockers:[{name:'production readiness gate',status:'BLOCKED',detail:e.message}]}; }
  checks.push({name:'production environment gate',status:production.ok?'PASS':'BLOCKED',detail:production.ok?'Required production configuration is present.':`${production.blockers.length} production blocker(s) detected.`,blockers:production.blockers||[]});

  const blockers=checks.filter(x=>x.status==='BLOCKED');
  const recommendations=[];
  for(const b of blockers){
    if(b.name.startsWith('file:')) recommendations.push(`Restore missing artifact: ${b.name.slice(5)}`);
    else if(b.name==='production environment gate') recommendations.push('Configure the blocked production environment items; Kim must not invent credentials or bypass this gate.');
    else if(b.name.startsWith('test:')) recommendations.push(`Fix failing validation: ${b.name.slice(5)}`);
    else if(b.name.startsWith('syntax:')) recommendations.push(`Repair syntax before deployment: ${b.name.slice(7)}`);
  }
  return {ok:blockers.length===0,version:VERSION,generatedAt:new Date().toISOString(),mode:'EVIDENCE_FIRST_PRODUCTION_GATE',checks,blockers,recommendations,production};
}
module.exports={VERSION,run};
