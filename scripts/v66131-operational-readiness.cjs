'use strict';
const REQUIRED=['cc_health','cc_ready','cc_api','cc_checkout_ui','cc_workforce_ui','cc_lorna_ui','cc_diag_direct','cc_diag_alias','office_health','office_api','office_i18n','office_locale_ui','public_sbc','public_reseller','active_reseller','reseller_domains','reseller_cart'];
function evaluate(evidence,{now=new Date(),expected={}}={}){
 // Date.parse(Date) stringifies the Date and loses its milliseconds. Keep the
 // exact clock so a fresh Python ISO receipt from this same second is not
 // incorrectly classified as future evidence.
 const clock=now instanceof Date?now.getTime():typeof now==='string'?Date.parse(now):NaN;
 const observed=typeof evidence?.observedAtUtc==='string'?Date.parse(evidence.observedAtUtc):NaN;
 const blockers=[], byName=new Map(), age=clock-observed;
 if(!Number.isFinite(age)||age<0||age>3600000)blockers.push('EVIDENCE_TIMESTAMP_INVALID_OR_STALE');
 if(evidence?.forbiddenOperationsPerformed!==0||evidence?.providerCharges!==0)blockers.push('READ_ONLY_CONTRACT_UNVERIFIED');
 for(const row of Array.isArray(evidence?.checks)?evidence.checks:[]){
  if(!row||!REQUIRED.includes(row.name))continue;
  if(byName.has(row.name))blockers.push(row.name+':DUPLICATE');
  byName.set(row.name,row);
 }
 for(const name of REQUIRED){const row=byName.get(name), diagnostic=name.startsWith('cc_diag');
  if(!row||row.status!=='VERIFIED'||(diagnostic?![403,404].includes(row.http)||row.reason!=='DIAGNOSTIC_ROUTE_CLOSED':row.http!==200||row.reason!=='PUBLIC_GET_OK'))blockers.push(name+':UNVERIFIED');
 }
 const identities=[['cc',byName.get('cc_health')?.sourceCommit,/^[a-f0-9]{40}$/],['office',byName.get('office_health')?.sourceCommit,/^[a-f0-9]{40}$/],['site',byName.get('public_sbc')?.siteBuild,/^[a-z0-9.-]{1,60}$/]];
 let missing=false,mismatch=false;
 for(const [key,actual,pattern] of identities){const wanted=expected?.[key];if(typeof wanted!=='string'||!pattern.test(wanted)||typeof actual!=='string'||!pattern.test(actual)){missing=true;continue;}if(actual!==wanted)mismatch=true;}
 return {publicSurface:blockers.length?'BLOCKED':'VERIFIED',releaseIdentity:mismatch?'MISMATCH':missing||blockers.length?'UNVERIFIED':'VERIFIED',commercialReadiness:'UNVERIFIED',productionCertified:false,blockers,requiresSeparateEvidence:['authenticated calling and role access','paid checkout and fulfillment','subscription billing and federation','backup restoration and load tests','social publication receipts']};
}
if(require.main===module){const fs=require('node:fs');let evidence;try{evidence=JSON.parse(fs.readFileSync(process.argv[2]||'f4-published-smoke-results.json','utf8'));}catch{evidence=null;}
 const result=evaluate(evidence,{expected:{cc:process.env.SBC_EXPECT_CC,office:process.env.SBC_EXPECT_OFFICE,site:process.env.SBC_EXPECT_SITE}});console.log(JSON.stringify(result,null,2));fs.writeFileSync('f4-operational-readiness.json',JSON.stringify(result,null,2)+'\n');if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n### SBC operational readiness (not production certification)\n\nPublic surface: **'+result.publicSurface+'**. Release identity: **'+result.releaseIdentity+'**. Commercial readiness: **UNVERIFIED**.\n\n'+result.blockers.map(x=>'- '+x).join('\n')+'\n');if(process.argv.includes('--strict-public')&&result.publicSurface!=='VERIFIED')process.exitCode=1;}
module.exports={evaluate};
