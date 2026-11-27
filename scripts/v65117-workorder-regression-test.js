// V66 standalone compatibility: the GoDaddy root intentionally stores server.js inside the
// embedded source ZIP. When run from the root package, route to current V66 tests instead of
// asserting obsolete V65-era runtime assumptions. In the extracted runtime, retain the original test.
const __sbcRuntimeRoot = require('node:path').resolve(__dirname, '..');
if (!require('node:fs').existsSync(require('node:path').join(__sbcRuntimeRoot, 'server.js'))) {
  const { spawnSync: __sbcSpawnSync } = require('node:child_process');
  const __sbcRunner = require('node:path').join(__sbcRuntimeRoot, 'scripts', 'run-legacy-standalone-test.js');
  const __sbcResult = __sbcSpawnSync(process.execPath, [__sbcRunner, 'workorder'], { cwd: __sbcRuntimeRoot, stdio: 'inherit', timeout: 240000 });
  if (__sbcResult.error) throw __sbcResult.error;
  process.exit(__sbcResult.status === 0 ? 0 : (__sbcResult.status || 1));
}
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'workers', 'checkout-event-worker.js'), 'utf8');
const shard = fs.readFileSync(path.join(root, 'workers', 'run-shard.js'), 'utf8');
const godkimSource = fs.readFileSync(path.join(root, 'enterprise', 'kim-god-os.js'), 'utf8');
const kim = require('../enterprise/kim-god-os');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const releaseIdentity = require('../config/release-identity');
assert.equal(packageJson.version, releaseIdentity.RELEASE_VERSION, 'root package and authoritative release identity must match');
assert.match(server, /SBC_V65117_WORK_ORDER_PIPELINE_HARDENED/, 'work-order patch marker present');
const claimStart = server.indexOf('async function claimFulfillmentJob');
const claimEnd = server.indexOf('async function requeueDueFailedFulfillmentJobs');
assert.ok(claimStart >= 0 && claimEnd > claimStart, 'SQL claim function exists');
const claim = server.slice(claimStart, claimEnd);
assert.ok(claim.indexOf("WHERE id=? AND status='ready'") >= 0, 'SQL claim is conditional on ready state');
assert.ok(claim.indexOf("WHERE id=? AND status='ready'") < claim.indexOf("live.status='processing'"), 'MySQL claim occurs before in-memory state mutation');
assert.match(server, /async function requeueDueFailedFulfillmentJobs\(\)/, 'due failed jobs have a retry sweep');
assert.match(server, /SBC_FULFILLMENT_MAX_ATTEMPTS/, 'automatic retries have a hard attempt cap');
assert.match(server, /async function loadNewDurableFulfillmentJobs\(\)/, 'durable worker jobs are loaded');
assert.match(server, /MYSQL_RECOVERY_REQUIRED\)return \{processed:0,recovered:0,requeued:0,paused:'MYSQL_RECOVERY_REQUIRED'\}/, 'recovery lock pauses automatic fulfillment');
assert.match(server, /value:Number\(r\.value\|\|0\)/, 'durable order amount is reloaded');
assert.match(server, /await SNAPSHOT_TENANTS\.persist\(conn,snapshotRows,\{sqlDate,sqlDateTime,now\}\)/, 'authoritative snapshot uses tenant-aware persistence');
assert.match(server, /fulfillment_status VARCHAR\(40\) NOT NULL DEFAULT 'Not Started'/, 'order lifecycle status has a MySQL field');
const snapshotTenants = require('../enterprise/integration/sbc-snapshot-tenants.cjs');
assert.match(server, /job\.status='needs_reconciliation';job\.vendorStatus='submission_outcome_unknown'/, 'ambiguous in-flight work is held for reconciliation');
assert.match(server, /Vendor submission outcome is ambiguous; automatic retry is paused to prevent a duplicate external order\./, 'ambiguous provider outcomes are not blindly retried');
assert.match(server, /shipping_webhook_secret_not_configured/, 'shipping callback fails closed without a secret');
assert.doesNotMatch(server, /return Boolean\(signature\) \|\| Boolean\(req\.headers\['x-webhook-signature'\]\)/, 'signature header presence alone is not validation');
assert.match(server, /invalid_or_unconfigured_webhook_signature/, 'unverified storefront checkout events are rejected');
assert.match(worker, /SBC_V65117_CANONICAL_WORK_ORDER/, 'checkout worker creates the canonical work order');
assert.match(worker, /sbc_fulfillment_jobs/, 'checkout worker inserts durable canonical job');
assert.match(worker, /CHECKOUT_TENANT_NOT_MAPPED_TO_SBC_TENANT/, 'unknown tenant mapping fails closed');
assert.match(shard, /FULFILLMENT_CREATE_NOT_WIRED_TO_CANONICAL_WORK_ORDER/, 'unwired create events are not falsely acknowledged');
assert.match(shard, /FULFILLMENT_UPDATE_NOT_WIRED_TO_VERIFIED_STATUS_HANDLER/, 'unwired update events are not falsely acknowledged');
assert.match(godkimSource, /\['completed','complete','fulfilled','delivered'\]/, 'completion is tied to terminal fulfillment states only');
assert.doesNotMatch(godkimSource, /\['completed','complete','submitted','processing','dispatched'\]/, 'in-progress states are not counted as completed');

function testOrder() {
  return {
    id: 'test-order', customerId: 'c-1', customerName: 'Test', product: 'Test product',
    price: 10, paymentStatus: 'Paid', status: 'Paid',
    notes: JSON.stringify({ items: [{ id: 'item-1', name: 'Test product', qty: 1, unitPrice: 10 }] })
  };
}
async function checkDurableColumns() {
  const stamp='2026-11-26 12:00:00';
  const source={orders:[{id:'order-fixture',tenantId:7,status:'Paid',fulfillmentStatus:'Ready for Fulfillment',price:199}],megaOpsStore:{fulfillmentJobs:[{id:'job-fixture',tenantId:7,orderId:'order-fixture',value:199,status:'ready'}]}};
  const records=new Map();
  const conn={async query(sql,params){
    const table=sql.match(/(?:FROM|INTO|UPDATE) (sbc_[a-z_]+)/)?.[1];
    assert(['sbc_orders','sbc_fulfillment_jobs'].includes(table));
    if(sql.startsWith('SELECT'))return [[...(records.has(table)?[records.get(table)]:[])]];
    if(sql.startsWith('INSERT')){
      const columns=sql.match(/\(([^)]+)\) VALUES/)[1].split(', ');
      records.set(table,Object.fromEntries(columns.map((c,i)=>[c,params[i]])));
    }else{
      assert.match(sql,/ WHERE id=\? AND tenant_id=\?$/);
      const r=records.get(table);assert.deepEqual(params.slice(-2),[r.id,r.tenant_id]);
      const cols=sql.split(' SET ')[1].split(' WHERE ')[0].split(', ').map(x=>x.slice(0,-2));
      for(const [i,c] of cols.entries())r[c]=params[i];
    }
    return [{affectedRows:1}];
  }};
  const dates={sqlDate:v=>v||null,sqlDateTime:v=>v||stamp,now:()=>stamp};
  await snapshotTenants.persist(conn,snapshotTenants.prepare(source,7),dates);
  assert.equal(records.get('sbc_orders').price,199);
  assert.equal(records.get('sbc_orders').status,'Paid');
  assert.equal(records.get('sbc_orders').fulfillment_status,'Ready for Fulfillment');
  assert.equal(records.get('sbc_fulfillment_jobs').value,199);
  source.orders[0].fulfillmentStatus='Submitted to Vendor';source.megaOpsStore.fulfillmentJobs[0].value=299;
  await snapshotTenants.persist(conn,snapshotTenants.prepare(source,7),dates);
  assert.equal(records.get('sbc_orders').status,'Paid');
  assert.equal(records.get('sbc_orders').fulfillment_status,'Submitted to Vendor');
  assert.equal(records.get('sbc_fulfillment_jobs').value,299);
}
async function run() {
  await checkDurableColumns();
  const db = { customers: [{ id: 'c-1', businessName: 'Test business' }] };
  const common = {
    requestUser: { id: 'owner', role: 'owner' },
    vendorCapabilities: () => ({ internal: { configured: true, autoExecution: true } }),
    addActivity() {}, audit() {}, saveData: async () => {}, db,
    catalog: { packages: [], services: [] }, sendCustomerStatus: async () => ({ sent: true })
  };
  for (const status of ['submitted', 'processing', 'dispatched']) {
    const order = testOrder();
    const result = await kim.orchestrate({
      ...common, order,
      createFulfillmentJobsForOrder: async () => [{ id: 'j-1', orderId: order.id, vendor: 'internal', status, vendorStatus: status }],
      processReadyFulfillmentJobs: async () => {}
    });
    assert.notEqual(result.stage, 'COMPLETED', status + ' must not be treated as delivered');
  }
  {
    const order = testOrder();
    const result = await kim.orchestrate({
      ...common, order,
      createFulfillmentJobsForOrder: async () => [{ id: 'j-1', orderId: order.id, vendor: 'internal', status: 'completed', vendorStatus: 'completed' }],
      processReadyFulfillmentJobs: async () => {}
    });
    assert.equal(result.stage, 'COMPLETED', 'terminal fulfillment may complete the order');
  }
  console.log(JSON.stringify({
    ok: true, version: packageJson.version,
    checks: [
      'atomic SQL claim', 'due retry queue and cap', 'recovery lock honored',
      'durable order amount and lifecycle', 'ambiguous vendor outcome safe hold',
      'stale lease reconciliation', 'shipping callback fail-closed',
      'storefront webhook verification', 'checkout to canonical job',
      'no false worker acknowledgements', 'terminal completion truth gate'
    ],
    functionalScenarios: 4
  }, null, 2));
}
run().catch(error => { console.error(error); process.exit(1); });
