'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MARK = 'SBC_RELATIONAL_SNAPSHOT_TENANT_OWNERSHIP';

function patchServer(source) {
  if (source.includes(MARK)) return source;
  const replace = (before, after) => {
    assert.equal(source.split(before).length - 1, 1, 'Unique snapshot tenant stage anchor required: ' + before.split('\n')[0]);
    source = source.replace(before, () => after);
  };
  const persistenceImport = "const {assessPersistenceSafety, PERSISTENCE_EPOCH_KEY} = require('./enterprise/integration/sbc-persistence-safety.cjs');";
  replace(persistenceImport, persistenceImport + `\nconst SNAPSHOT_TENANTS = require('./enterprise/integration/sbc-snapshot-tenants.cjs'); // ${MARK}`);
  replace("const {runWithTenantContext} = require('./enterprise/tenant-context.cjs');",
    "const {runWithTenantContext,currentTenantContext} = require('./enterprise/tenant-context.cjs');");
  replace('megaOpsFromWorkspace.fulfillmentJobs=durableJobs.map(r=>({id:r.id,orderId:r.order_id,',
    'megaOpsFromWorkspace.fulfillmentJobs=durableJobs.map(r=>({id:r.id,tenantId:Number(r.tenant_id),orderId:r.order_id,');

  const startCount = source.indexOf('    const sourceCore={', source.indexOf('async function writeRelational('));
  const endCount = source.indexOf('    const authoritativeCore={', startCount);
  assert(startCount >= 0 && endCount > startCount);
  replace(source.slice(startCount, endCount),
    '    const snapshotRows=SNAPSHOT_TENANTS.prepare(db,TENANT_DEFAULT_ID);\n    const sourceCore=snapshotRows.sourceCounts;\n');

  const startWrite = source.indexOf('    // V64.2.16: row-level upserts.');
  const endWrite = source.indexOf('    const extra={leadAssistQueue:', startWrite);
  assert(startWrite >= 0 && endWrite > startWrite);
  const oldWrites = source.slice(startWrite, endWrite);
  for (const table of ['customers', 'orders', 'quotes', 'renewals', 'activities', 'fulfillment_jobs', 'workforce_users']) {
    assert(oldWrites.includes(`INSERT INTO sbc_${table}`), `Snapshot write anchor missing: ${table}`);
  }
  replace(oldWrites, '    await SNAPSHOT_TENANTS.persist(conn,snapshotRows,{sqlDate,sqlDateTime,now});\n\n');

  replace("function addActivity(type,message,meta={}){const entry={id:id('act'),type,message,meta,createdAt:now()};",
    "function addActivity(type,message,meta={},tenantId=currentTenantContext()?.tenantId){const entry={id:id('act'),type,message,meta,createdAt:now(),tenantId};");
  replace('sourcePage:c0.sourcePage,duplicate:true,contactChanged:false});',
    'sourcePage:c0.sourcePage,duplicate:true,contactChanged:false},tenantId);');
  replace('sourcePage:c0.sourcePage,qualified:false});', 'sourcePage:c0.sourcePage,qualified:false},tenantId);');
  return source;
}

if (require.main === module) {
  const file = path.resolve(__dirname, '../server.js');
  const source = fs.readFileSync(file, 'utf8');
  const compiled = patchServer(source);
  if (process.argv.includes('--apply')) {
    assert.equal(process.env.SBC_ISOLATED_SNAPSHOT_TENANT_STAGE, 'YES', 'Disposable stage required');
    if (compiled !== source) fs.writeFileSync(file, compiled);
  }
  console.log('SBC snapshot tenant write boundary verified');
}

module.exports = { MARK, patchServer };
