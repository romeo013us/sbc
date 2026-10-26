'use strict';
const assert=require('node:assert/strict');
const {evaluate,RUBRIC}=require('./sbc-v6655-strict-95-evidence.cjs');
const sha='b'.repeat(40),now=Date.parse('2026-10-26T18:00:00Z');
const mk=()=>Object.fromEntries(Object.entries(RUBRIC).map(([domain,checks])=>[domain,Object.fromEntries(checks.map(c=>[c.id,{
  verified:true,commit:sha,observedAt:'2026-10-26T17:00:00Z',score:98,
  artifacts:c.kinds.map((kind,i)=>({kind,reference:'https://github.com/example/sbc/actions/runs/'+(100+i),sha256:'a'.repeat(64)}))
}]))]));
const no=evaluate({commit:sha},{now});
assert.equal(no.status,'NO_GO');
for(const domain of ['build','saas','company'])assert.equal(no.sections[domain].submittedScore,null);
const doc={commit:sha,...mk()};
let eligible=evaluate(doc,{now});
assert.equal(eligible.status,'ELIGIBLE_FOR_INDEPENDENT_REVIEW');
assert.equal(eligible.officeBoxAuthorized,false);
for(const domain of ['build','saas','company'])assert.equal(eligible.sections[domain].submittedScore,98);
function mutate(fn,msg){const d=JSON.parse(JSON.stringify(doc));fn(d);assert.equal(evaluate(d,{now}).status,'NO_GO',msg)}
mutate(d=>d.build.authenticated_desktop_mobile_control_audit.score=94.99,'each subsystem must independently score >=95 even if the total average passes');
mutate(d=>d.company.settled_revenue_and_accounting_agreement.artifacts.pop(),'financial evidence must include accounting');
mutate(d=>d.saas.square_checkout_webhook_paid_reconciliation.artifacts[0].sha256='unverified','provider evidence needs a digest');
mutate(d=>d.build.source_bound_reproducible_deploy_rollback.commit='c'.repeat(40),'evidence must bind to release');
mutate(d=>d.company.measured_costs_margins_and_runway.observedAt='2020-01-01T00:00:00Z','stale evidence cannot pass');
mutate(d=>d.saas.mobile_accessibility_and_no_silent_clicks.artifacts=[],'missing desktop/mobile proof fails');
mutate(d=>d.saas.data_durability_and_tenant_restore.score=Number.NaN,'invalid numeric grade cannot pass');
mutate(d=>d.company.verified_qualified_prospect_pipeline.verified=false,'assertions need an explicit signoff');
mutate(d=>d.saas.tenant_scoped_crm_leads_and_permissions.artifacts[0].reference='file:///private/test.log','local paths not accepted as review links');
mutate(d=>d.build.published_stability_and_performance.observedAt='2026-10-27T12:00:00Z','future measurements cannot pass');
mutate(d=>d.build.observability_alerting_and_incident_response.score=95-0.01,'even low-weight components cannot drag');
console.log('[SBC V6655] PASS: all three tracks + every subsystem >=95, source-bound timely evidence and reviewer-not-certified status; missing proof stays NO_GO');
