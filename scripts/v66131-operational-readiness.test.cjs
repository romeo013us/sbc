'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('./v66131-operational-readiness.cjs');
const names=['cc_health','cc_ready','cc_api','cc_checkout_ui','cc_workforce_ui','cc_lorna_ui','cc_diag_direct','cc_diag_alias','office_health','office_api','office_i18n','office_locale_ui','public_sbc','public_reseller','active_reseller','reseller_domains','reseller_cart'];
const sha='a'.repeat(40), other='b'.repeat(40);
function fixture(){return {observedAtUtc:'2026-11-24T15:00:00Z',forbiddenOperationsPerformed:0,providerCharges:0,checks:names.map(name=>({name,status:'VERIFIED',http:name.startsWith('cc_diag')?404:200,reason:name.startsWith('cc_diag')?'DIAGNOSTIC_ROUTE_CLOSED':'PUBLIC_GET_OK',...(name==='cc_health'||name==='office_health'?{sourceCommit:sha}:{}),...(name==='public_sbc'?{siteBuild:'release-1',checkoutMode:'signed'}:{})}))};}
const opts={now:'2026-11-24T15:05:00Z',expected:{cc:sha,office:sha,site:'release-1'}};
test('public green does not hide 403 reseller cart',()=>{const e=fixture();Object.assign(e.checks.at(-1),{status:'UNVERIFIED',http:403});const r=evaluate(e,opts);assert.equal(r.publicSurface,'BLOCKED');assert(r.blockers.includes('reseller_cart:UNVERIFIED'));});
test('missing, duplicate, stale and future evidence fail closed',()=>{for(const alter of [e=>e.checks.pop(),e=>e.checks.push(e.checks[0]),e=>e.observedAtUtc='2026-11-23T15:00:00Z',e=>e.observedAtUtc='2026-11-25T15:00:00Z']){const e=fixture();alter(e);assert.equal(evaluate(e,opts).publicSurface,'BLOCKED');}});
test('a public health response with wrong build cannot establish release identity',()=>{const e=fixture();e.checks[0].sourceCommit=other;assert.equal(evaluate(e,opts).releaseIdentity,'MISMATCH');});
test('expected identities must be supplied independently',()=>{assert.equal(evaluate(fixture(),{now:opts.now}).releaseIdentity,'UNVERIFIED');});
test('all public checks and exact identities still cannot certify authenticated commerce',()=>{const r=evaluate(fixture(),opts);assert.equal(r.publicSurface,'VERIFIED');assert.equal(r.releaseIdentity,'VERIFIED');assert.equal(r.commercialReadiness,'UNVERIFIED');assert.equal(r.productionCertified,false);});
test('non-read-only evidence and false green diagnostic are rejected',()=>{const e=fixture();e.providerCharges=1;e.checks.find(x=>x.name==='cc_diag_direct').http=200;assert.equal(evaluate(e,opts).publicSurface,'BLOCKED');});
