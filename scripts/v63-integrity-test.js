import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createKevin } from '../enterprise/kevin/kevin-kernel.js';
import { AutonomyLadder } from '../enterprise/kevin/autonomy-ladder.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v63-'));
const config = {
  autonomyLevel: 9,
  execution: { dryRunDefault: true },
  governance: {
    ownerVetoActive: false,
    credentialModification: false,
    unrestrictedProductionMutation: false,
    selfPromotion: false,
    selfEscalation: false
  },
  memory: { path: path.join(dir, 'memory.jsonl') }
};

const { kernel, kevin, kim } = createKevin({ config });
await kevin.observe({
  type: 'BUSINESS_SNAPSHOT', source: 'test', payload: {
    snapshot: {
      leads: 433, warmLeads: 190, hotLeads: 2,
      collectedRevenue: 1000, grossProfit: 600, orders: 4,
      capacity: { sales: 50, fulfillment: 50, engineering: 10 },
      fulfillmentBacklog: 0, automationFailures: 0, overdueActions: 0
    }
  }
});

const cycle = await kernel.executeSovereignHeartbeat({ dryRun: true });
assert(cycle.cycle.state.warmLeads === 190);
assert(cycle.cycle.prediction.confidence > 0);
assert(cycle.routed.length > 0);
assert(cycle.cycle.results.every(x => x.adversarial.pass));
assert(cycle.cycle.results.every(x => ['SIMULATED', 'BLOCKED'].includes(x.execution.status)));
assert(kevin.governance.check({ credentialMutation: true }).allowed === false);
kevin.governance.setOwnerVeto(true);
assert(kevin.governance.check({ type: 'REVENUE_PLAY' }).allowed === false);
assert(new AutonomyLadder({ autonomyLevel: 4 }).evaluate({ type: 'REVENUE_PLAY' }).authorizedByLadder === false);
const answer = await kim.ask('what is the bottleneck right now?');
assert(answer.speaker === 'Kim');
assert(kevin.memory.verifyChain().valid === true);
assert(Array.isArray(cycle.engineeringDiffs));

console.log('SBC V63 GOD TIER INTEGRITY: PASS');
console.log(JSON.stringify({
  world: cycle.cycle.state.health,
  predictionConfidence: cycle.cycle.prediction.confidence,
  decisions: cycle.cycle.results.length,
  autonomy: cycle.routed.map(x => x.authority.bracket),
  governance: 'PASS',
  kimKevin: 'PASS',
  kernel: kernel.status().kernelSignature
}, null, 2));
