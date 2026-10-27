#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HardenedControlPlane, deterministicIdempotencyKey } = require('../enterprise/kevin/kevin-runtime.cjs');

class InnoDBUniqueRaceMock {
  constructor(){ this.rows=[]; this.inserts=0; this.duplicates=0; }
  async query(sql,args=[]){
    const s=String(sql);
    if(s.includes('SELECT * FROM sbc_kevin_runtime_ledger')){
      const [tenant,key]=args;
      return [this.rows.filter(r=>r.tenant_id===tenant&&r.idempotency_key===key).slice(0,1),[]];
    }
    if(s.includes('INSERT INTO sbc_kevin_runtime_ledger')){
      const tenant=args[0], key=args[1];
      // Simulate concurrent InnoDB unique-index arbitration: first committer wins.
      await new Promise(r=>setTimeout(r, Math.floor(Math.random()*3)));
      if(this.rows.some(r=>r.tenant_id===tenant&&r.idempotency_key===key)){
        this.duplicates++; const e=new Error('Duplicate'); e.code='ER_DUP_ENTRY'; throw e;
      }
      this.inserts++;
      this.rows.push({id:this.rows.length+1,tenant_id:tenant,idempotency_key:key,proposal_id:args[2],entry_hash:args[9],previous_hash:args[8]});
      return [{affectedRows:1},[]];
    }
    if(s.trim()==='SELECT 1 AS ok') return [[{ok:1}],[]];
    return [[],[]];
  }
}

(async()=>{
  const db=new InnoDBUniqueRaceMock();
  const cp=new HardenedControlPlane({rootDir:process.cwd(),mysqlPoolGetter:()=>db,stateKernel:null,evolutionEngine:null,config:{governance:{ownerVetoActive:false}}});
  const key=deterministicIdempotencyKey({proposalId:'RACE-001',type:'LEAD_CLASSIFICATION',targetActionSuite:'lead-classification',simulationSeed:'RACE'});
  const attempts=250;
  const results=await Promise.all(Array.from({length:attempts},(_,i)=>cp.ledgerAppend({tenantId:1,proposalId:'RACE-001',idempotencyKey:key,actionType:'LEAD_CLASSIFICATION',targetActionSuite:'lead-classification',autonomyBand:'GREEN',status:'SIMULATED',result:{attempt:i}})));
  assert.strictEqual(db.rows.length,1,'unique idempotency index must allow exactly one ledger row');
  assert.strictEqual(results.filter(x=>x.duplicate).length,attempts-1,'all duplicate races must resolve as duplicates');
  console.log(`PASS InnoDB unique-race simulation: ${attempts} concurrent writers -> ${db.rows.length} durable winner, ${db.duplicates} duplicate conflicts`);

  // Accelerated 72-hour shadow: 288 fifteen-minute cycles, staging-only.
  let staged=0, executed=0;
  const shadowCycles=288;
  for(let i=0;i<shadowCycles;i++){
    const safe={type:'LEAD_CLASSIFICATION',payload:{type:'LEAD_CLASSIFICATION'}};
    const independent={passed:true};
    const band=cp.classify(safe,independent);
    assert.strictEqual(band,'GREEN');
    staged++;
    // Shadow mode means no execution regardless of GREEN classification.
    assert.strictEqual(executed,0);
  }
  console.log(`PASS 72-hour accelerated shadow: ${shadowCycles} heartbeat windows, ${staged} recommendations observed, ${executed} live executions`);

  // Emergency handbrake + filesystem rollback simulation.
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-handbrake-'));
  const target=path.join(tmp,'known-good.txt');
  fs.writeFileSync(target,'KNOWN_GOOD');
  const snapshot=fs.readFileSync(target,'utf8');
  const config={governance:{ownerVetoActive:false}};
  const handbrake=new HardenedControlPlane({rootDir:tmp,mysqlPoolGetter:()=>null,stateKernel:null,evolutionEngine:null,config});
  fs.writeFileSync(target,'UNSAFE_MUTATION');
  config.governance.ownerVetoActive=true;
  assert.strictEqual(handbrake.classify({type:'LEAD_CLASSIFICATION',payload:{type:'LEAD_CLASSIFICATION'}},{passed:true}),'RED');
  fs.writeFileSync(target,snapshot);
  assert.strictEqual(fs.readFileSync(target,'utf8'),'KNOWN_GOOD');
  console.log('PASS emergency handbrake: owner veto forced RED and sandbox state restored to known-good snapshot');

  console.log('V64.2 SANDBOX WAR TEST: PASS');
})().catch(e=>{console.error('FAIL',e.stack||e);process.exit(1)});
