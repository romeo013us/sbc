'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const STAGE=require('./v66163-stage-owner-trusted-leads.cjs');
const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
test('trusted lead owner routes and Lorna submit hook inject once without changing unrelated source',()=>{
 const result=STAGE.patchServer(server);
 assert(result.includes(STAGE.MARK));
 assert(result.includes("require('./routes/sbc-owner-trusted-leads-v1.cjs').register(app,"));
 assert(result.includes("const SBC_TRUSTED_LEADS=require('./enterprise/sbc-trusted-research-v1.cjs')"));
 assert(result.includes("SBC_TRUSTED_LEADS.isLorna(req.user)"));
 assert(result.includes("SBC_TRUSTED_LEADS.isTrusted(c)"));
 assert.equal(STAGE.patchServer(result),result);
 assert.equal((result.match(/\/\/SBC_V66163_OWNER_TRUSTED_RESEARCH/g)||[]).length,1);
 assert(result.includes("function SBC_V6649_REQUIRE_WRITER()"));
});
test('source changes are staged-only; public files cannot mark records trusted',()=>{
 assert.throws(()=>STAGE.patchServer('app.post(\'/api/workforce/leads\' '),/TRUSTED_RESEARCH_UNSUPPORTED_SERVER/);
 const cfg=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
 assert.match(cfg,/v66163-stage-owner-trusted-leads\.cjs --apply/);
 assert.match(cfg,/v66163-stage-owner-trusted-leads\.cjs --verify-staged/);
});
