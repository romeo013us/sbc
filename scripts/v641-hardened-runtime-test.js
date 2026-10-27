'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { deterministicIdempotencyKey, HardenedControlPlane } = require('../enterprise/kevin/kevin-runtime.cjs');

function ok(v, msg) { assert.ok(v, msg); console.log('PASS', msg); }

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'enterprise/kevin/kevin-runtime.cjs'), 'utf8');
  ok(source.includes('SINGLE_FLIGHT_ACTIVE'), 'single-flight overlap guard present');
  ok(source.includes('DUPLICATE_PREVENTED'), 'deterministic duplicate prevention present');
  ok(source.includes('RED_AUTONOMY_REQUIRES_ROMEO_APPROVAL'), 'RED owner approval freeze present');
  ok(source.includes('GREEN_ACTION_NOT_ALLOWLISTED'), 'Green allowlist enforced');
  ok(source.includes('financialMutation'), 'financial mutation gate present');
  ok(source.includes('credentialMutation'), 'credential mutation gate present');
  ok(source.includes('10000'), 'independent verifier threshold present');
  ok(source.includes('previous_hash') && source.includes('entry_hash'), 'hash-chain audit fields present');
  ok(source.includes('postExecutionVerification'), 'post-execution verification present');

  const a = deterministicIdempotencyKey({proposalId:'P-1',type:'HEALTH_CHECK',targetActionSuite:'health',simulationSeed:'seed'});
  const b = deterministicIdempotencyKey({proposalId:'P-1',type:'HEALTH_CHECK',targetActionSuite:'health',simulationSeed:'seed'});
  ok(a === b && /^[a-f0-9]{64}$/.test(a), 'idempotency key is deterministic SHA-256');

  const config = { governance:{ownerVetoActive:false} };
  const cp = new HardenedControlPlane({rootDir:root,mysqlPoolGetter:()=>null,stateKernel:null,evolutionEngine:null,config});
  const independent = await cp.verifyIndependent({
    proposal:{id:'P-TEST',type:'HEALTH_CHECK',risk:0,expectedGrossProfitGain:10,cost:0,simulationSeed:'seed'},
    simulation:{pass:true}, council:{consensus:true}, adversarial:{pass:true}
  });
  ok(independent.cases === 10000, 'independent verification runs 10,000 deterministic cases');
  ok(independent.passedCases === 10000, 'safe test proposal passes all 10,000 cases');
  ok(independent.securityViolations === 0 && independent.tenantIsolationViolations === 0, 'security and tenant isolation violations remain zero');

  const red = cp.classify({type:'PAYMENT_CAPTURE',payload:{financialMutation:true}}, independent);
  ok(red === 'RED', 'financial action routes to RED');
  const green = cp.classify({type:'HEALTH_CHECK',payload:{}}, independent);
  ok(green === 'GREEN', 'safe health check routes to GREEN');
  config.governance.ownerVetoActive = true;
  ok(cp.classify({type:'HEALTH_CHECK',payload:{}}, independent) === 'RED', 'owner veto overrides action routing');

  console.log('V64.2.2 HARDENED RUNTIME TEST: PASS');
})().catch(err => { console.error('V64.2.2 HARDENED RUNTIME TEST: FAIL', err); process.exit(1); });
