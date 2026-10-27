'use strict';
const assert=require('node:assert/strict');
const patch=require('./apply-v6558-economic-control-ddl-gate');
const variants=[
'class EconomicControl { async ensureTables() { await db.query("CREATE TABLE x"); } }',
'const economicControl = { ensureTables: async () => { await db.query("CREATE TABLE x"); } };',
'const economicControl = { ensureTables: async function () { await db.query("CREATE TABLE x"); } };',
'const economicControl = {}; economicControl.ensureTables = async () => { await db.query("CREATE TABLE x"); };'
];
for(const input of variants){const result=patch.gateEnsureTables(input);assert.match(result.source,/global\.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED\(\)/);assert.match(result.source,/SBC_V6558_ECONOMIC_CONTROL_DDL_GATE/);assert.equal(patch.gateEnsureTables(result.source).alreadyApplied,true)}
assert.throws(()=>patch.gateEnsureTables('module.exports = {};'),/expected exactly one Economic Control ensureTables function/);
console.log('[SBC V65.1.58] recurring Economic Control schema gate regression tests PASS');
