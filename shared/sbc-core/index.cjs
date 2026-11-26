'use strict';
// SBC Core contract v1: evidence only. Provider verification and tenant mapping remain caller responsibilities.
const {createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(x).digest('hex');
const WORKSPACE_SHA256='3c0d9fbb0681d69459fed34db57bddebcf6ac76d9a381dd70cfa4559fd653e1c';
const keys=['provider','environment','accountId','eventId','tenantRef','kind','amountMinor','currency','occurredAt','payloadSha256'];
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(x);
function verifyWorkspaceContract(bytes){return Buffer.isBuffer(bytes)&&hash(bytes)===WORKSPACE_SHA256;}
function normalizePaymentEvidence(input){
 const fail=()=>{throw Error('INVALID_PAYMENT_EVIDENCE');};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))fail();
 const {provider,environment,accountId,eventId,tenantRef,kind,amountMinor,currency,occurredAt,payloadSha256}=input;
 if(!['stripe','square'].includes(provider)||!['production','sandbox'].includes(environment)||![accountId,eventId,tenantRef].every(id)||!['capture','refund','dispute'].includes(kind)||!Number.isSafeInteger(amountMinor)||amountMinor<=0||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||typeof occurredAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(occurredAt)||!Number.isFinite(Date.parse(occurredAt))||new Date(occurredAt).toISOString()!==occurredAt||typeof payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(payloadSha256))fail();
 const eventKey=hash(JSON.stringify(['sbc-payment-event-v1',provider,environment,accountId,eventId]));
 const evidence={schemaVersion:1,provider,environment,accountId,eventId,tenantRef,kind,amountMinor,currency,occurredAt,payloadSha256,eventKey,effect:'none'};
 return Object.freeze({...evidence,evidenceHash:hash(JSON.stringify(evidence))});
}
module.exports=Object.freeze({WORKSPACE_SHA256,verifyWorkspaceContract,normalizePaymentEvidence});
