import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SBCStateKernel } from './sbc-state-kernel-v652.js';
import { KimGovernedSandbox } from './kim-governed-sandbox-v652.js';

const snapshots = new Map();
const seen = new Set();
let durable = false;
const cache = {
  getLocalSnapshot: id => snapshots.get(id),
  updateLocalSnapshot: (id, value) => {
    assert.equal(durable, true, 'projection must wait for durable commit');
    snapshots.set(id, value);
  }
};
const ledger = {
  async insertOnce(event) {
    if (seen.has(event.eventHash)) return { inserted: false };
    seen.add(event.eventHash);
    durable = true;
    return { inserted: true };
  }
};
const kernel = new SBCStateKernel({ ledger, readModelCache: cache, clock: () => 123 });
const packet = { tenantId: 'tenant-A', eventType: 'TRANSACTION_CONFIRMED', idempotencyKey: 'evt-1', payload: { customerId: 'cust-1', amount: 25 } };
assert.equal((await kernel.dispatchAuthoritativeCommand(packet)).committed, true);
assert.equal(snapshots.get('cust-1').transactionEventAmount, 25);
assert.equal((await kernel.dispatchAuthoritativeCommand(packet)).duplicateDetected, true);
assert.equal(seen.size, 1);
await assert.rejects(() => kernel.dispatchAuthoritativeCommand({ ...packet, tenantId: '' }), /tenantId/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sbc-v652-test-'));
const root = path.join(temp, 'repo');
const holding = path.join(temp, 'holding');
await fs.mkdir(root, { recursive: true });
const active = path.join(root, 'safe.js');
await fs.writeFile(active, 'export const active = true;');
const original = await fs.readFile(active, 'utf8');
const sandbox = new KimGovernedSandbox({ repositoryRoot: root, holdingDirectory: holding, clock: () => 456 });
const nestedHolding = new KimGovernedSandbox({ repositoryRoot: root, holdingDirectory: path.join(root, 'inside-holding'), clock: () => 457 });
await assert.rejects(() => nestedHolding.stagePatchProposal({ targetRelativePath: 'safe.js', proposedSource: 'const nested = true;' }), /outside the active repository/i);
const proposal = await sandbox.stagePatchProposal({ targetRelativePath: 'safe.js', proposedSource: 'const proposed = true;', baselineSource: original });
assert.equal(proposal.staged, true);
assert.equal(proposal.status, 'PENDING_OWNER_REVIEW');
assert.equal(await fs.readFile(active, 'utf8'), original);
await assert.rejects(() => sandbox.stagePatchProposal({ targetRelativePath: '../safe.js', proposedSource: 'const x=1;' }), /outside|escapes/i);
await assert.rejects(() => sandbox.stagePatchProposal({ targetRelativePath: 'safe.js', proposedSource: 'export const =' }), SyntaxError);
await assert.rejects(() => sandbox.stagePatchProposal({ targetRelativePath: 'bootstrap.js', proposedSource: 'export const x=1;' }), /outside/i);
await fs.rm(temp, { recursive: true, force: true });
console.log('PASS: durable-first projection, duplicate suppression, input validation, path containment, syntax rejection, and active-file immutability');
