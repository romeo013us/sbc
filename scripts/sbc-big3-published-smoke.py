#!/usr/bin/env python3
"""SBC Big 3 public GET-only smoke. The owner is handling the reseller separately.
This check never reads credentials, invokes a payment, creates customers or activates subscriptions.
Green public health is a prerequisite, NOT live four-gate customer certification.
"""
import datetime as dt
import json
import runpy
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
F4=runpy.run_path(str(HERE/'v66131-published-f4-smoke.py'))
NAMES=('cc_health','cc_ready','cc_api','cc_lorna_ui','office_health','office_api','office_i18n','public_sbc')
GATES=('website_inquiry_persisted_to_own_crm_tenant','two_customers_logged_in_with_tenant_isolation',
       'square_verified_unique_paid_order_reconciled','officebox_eligible_paid_tenant_activated')
OUTPUT='sbc-big3-public-smoke-results.json'

def report(fetcher=None):
    fetcher=fetcher or F4['fetch']
    checks=[fetcher(n,F4['ENDPOINTS'][n]) for n in NAMES]
    for check in checks:
        if check.get('name')=='public_sbc' and check.get('http')==403:
            check['reason']='CI_RUNNER_HTTP_403_ACCESS_RESTRICTED_NOT_OUTAGE_PROOF'
    good=all(c.get('status')=='VERIFIED' for c in checks)
    return {
     'schema':'sbc.big3.public-smoke.v1',
     'observedAtUtc':dt.datetime.now(dt.timezone.utc).isoformat(),
     'publicReadOnlyPrerequisitesPassed':good,
     'liveFourGateCertification':False,
     'gates':{n:'NOT_TESTED_AUTHENTICATED_PROVIDER_EVIDENCE_REQUIRED' for n in GATES},
     'resellerScope':'EXCLUDED_BY_OWNER',
     'prohibitedCustomerOrPaymentMutationsPerformed':0,
     'checks':checks
    }

def selftest():
    assert len(set(NAMES))==len(NAMES)
    assert not any('reseller' in x for x in NAMES)
    assert not any('/api/sbc/handoff' in F4['ENDPOINTS'][n] for n in NAMES)
    calls=[]
    def ok(n,url):
        calls.append(n)
        return {'name':n,'status':'VERIFIED','http':200,'reason':'SELF_TEST'}
    x=report(ok)
    assert tuple(calls)==NAMES
    assert x['publicReadOnlyPrerequisitesPassed'] is True
    assert x['liveFourGateCertification'] is False
    assert all(v.startswith('NOT_TESTED_') for v in x['gates'].values())
    def no(n,url):
        return {'name':n,'status':'UNVERIFIED' if n=='office_api' else 'VERIFIED','http':503 if n=='office_api' else 200}
    assert report(no)['publicReadOnlyPrerequisitesPassed'] is False
    def blocked_site(n,url):
        return {'name':n,'status':'UNVERIFIED' if n=='public_sbc' else 'VERIFIED','http':403 if n=='public_sbc' else 200}
    x=report(blocked_site)
    assert x['publicReadOnlyPrerequisitesPassed'] is False
    assert x['checks'][-1]['reason']=='CI_RUNNER_HTTP_403_ACCESS_RESTRICTED_NOT_OUTAGE_PROOF'
    print('Big 3 PUBLIC GET-only self-test PASS; reseller excluded, no false paid certification')

if __name__=='__main__':
    if len(sys.argv)==2 and sys.argv[1]=='--self-test':
        selftest();sys.exit(0)
    outcome=report()
    Path(OUTPUT).write_text(json.dumps(outcome,indent=2)+'\n',encoding='utf-8')
    print('SBC Big 3 PUBLIC health evidence — no authenticated customer/provider proof')
    for c in outcome['checks']:
        print(f"{c['name']}: {c['status']} HTTP {c.get('http') or 'n/a'} ({c.get('reason','')})")
    print('All four paid/customer acceptance gates remain NOT CERTIFIED')
    sys.exit(0 if outcome['publicReadOnlyPrerequisitesPassed'] else 1)
