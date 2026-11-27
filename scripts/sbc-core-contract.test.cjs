'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {normalizePaymentEvidence,verifyWorkspaceContract}=require('../shared/sbc-core/index.cjs');
const root=path.join(__dirname,'..');
const base={provider:'square',environment:'production',accountId:'merchant-1',eventId:'evt-1',tenantRef:'sbc:1',kind:'capture',amountMinor:19900,currency:'USD',occurredAt:'2026-11-26T12:00:00.000Z',payloadSha256:'a'.repeat(64)};
test('shared design contract matches the pinned workspace CSS and rejects drift',()=>{
 const css=fs.readFileSync(path.join(root,'design-system/workspace-v1.css'));
 assert.equal(verifyWorkspaceContract(css),true);assert.equal(verifyWorkspaceContract(Buffer.concat([css,Buffer.from('x')])),false);assert.equal(verifyWorkspaceContract('not bytes'),false);
});
test('normalized evidence is stable and never authorizes money or entitlement changes',()=>{
 const x=normalizePaymentEvidence(base),y=normalizePaymentEvidence({...base});
 assert.deepEqual(x,y);assert.equal(x.schemaVersion,1);assert.equal(x.effect,'none');assert.equal(x.amountMinor,19900);assert.match(x.eventKey,/^[a-f0-9]{64}$/);assert.match(x.evidenceHash,/^[a-f0-9]{64}$/);assert(Object.isFrozen(x));
 assert.equal(normalizePaymentEvidence({...base,tenantRef:'sbc:2'}).eventKey,x.eventKey);assert.notEqual(normalizePaymentEvidence({...base,tenantRef:'sbc:2'}).evidenceHash,x.evidenceHash);
});
test('provider, environment and merchant are separate replay namespaces',()=>{
 const k=normalizePaymentEvidence(base).eventKey;
 for(const patch of [{provider:'stripe'},{environment:'sandbox'},{accountId:'merchant-2'},{eventId:'evt-2'}])assert.notEqual(normalizePaymentEvidence({...base,...patch}).eventKey,k);
 assert.equal(normalizePaymentEvidence({...base,amountMinor:20000}).eventKey,k);assert.notEqual(normalizePaymentEvidence({...base,amountMinor:20000}).evidenceHash,normalizePaymentEvidence(base).evidenceHash);
});
test('invalid or unrecognized evidence fails closed',()=>{
 for(const patch of [{provider:'paypal'},{environment:'test'},{accountId:''},{eventId:'a b'},{tenantRef:''},{kind:'checkout'},{amountMinor:0},{amountMinor:1.5},{amountMinor:Number.MAX_SAFE_INTEGER+1},{currency:'usd'},{occurredAt:'2026-02-30T12:00:00.000Z'},{payloadSha256:'bad'},{verified:true}])assert.throws(()=>normalizePaymentEvidence({...base,...patch}),/INVALID_PAYMENT_EVIDENCE/);
});
