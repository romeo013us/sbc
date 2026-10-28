'use strict';
/**
 * Read-only SBC 9.5 release preflight.
 * It inspects the checked-out source, prebuilt release identity and submitted
 * three-track claims. No customer DB, provider API, secrets, or network access.
 * It NEVER approves GoDaddy deployment or claims independent business proof.
 */
const path=require('node:path');
const {readManifest}=require('../scripts/prebuilt-runtime.cjs');
const {INPUTS}=require('../scripts/runtime-build-fingerprint.cjs');
const {evaluate}=require('../scripts/sbc-v6655-strict-95-evidence.cjs');
const requiredSources=Object.freeze(['hotfix-assets','enterprise','ecosystem','ui-overlays','scripts']);
function normalizeError(error){
 const s=String(error?.message||'');
 if(/stale relative to checked-out source/i.test(s))return 'SOURCE_RELEASE_FINGERPRINT_MISMATCH';
 if(/ZIP SHA-256/i.test(s))return 'ARCHIVE_INTEGRITY_MISMATCH';
 if(/archive or receipt is missing/i.test(s))return 'ARCHIVE_OR_RECEIPT_INCOMPLETE';
 if(/wrong-version|malformed/i.test(s))return 'RECEIPT_SCHEMA_INVALID';
 return 'SOURCE_RELEASE_UNVERIFIED';
}
function assess({root=path.resolve(__dirname,'..'),evidence={},readRelease=readManifest,inputList=INPUTS}={}){
 const sourceMissing=requiredSources.filter(x=>!inputList.includes(x));
 const release={status:'NO_GO',reason:null,sourceCommit:null,archiveSha256:null};
 if(sourceMissing.length)release.reason='SOURCE_INPUTS_NOT_FINGERPRINTED';
 else{
  try{
   const item=readRelease(root);
   if(!item)release.reason='NO_PREBUILT_RELEASE';
   else if(!/^[a-f0-9]{40}$/i.test(String(item.manifest?.sourceCommit||'')))
    release.reason='UNBOUND_RELEASE_COMMIT';
   else if(item.manifest?.generatedBy!=='isolated-github-ci')
    release.reason='UNVERIFIED_BUILD_PROVENANCE';
   else {
    release.status='SOURCE_MATCHED_AND_ARCHIVE_VERIFIED';
    release.sourceCommit=item.manifest.sourceCommit;
    release.archiveSha256=item.manifest.archiveSha256;
   }
  }catch(error){release.reason=normalizeError(error)}
 }
 // The authoritative, existing Build / SaaS / Company rubric verifies
 // 19 independently substantiated criteria, with threshold 95 per subsystem.
 const ratings=evaluate(evidence);
 const tracks=Object.fromEntries(
  ['build','saas','company'].map(k=>[k,{
   status:ratings.sections[k].status,
   evidenceCoverage:ratings.sections[k].coverage,
   submittedScore:ratings.sections[k].submittedScore,
   blockers:ratings.sections[k].blockers
  }])
 );
 const sourceReady=release.status==='SOURCE_MATCHED_AND_ARCHIVE_VERIFIED';
 const claimsReady=ratings.status==='ELIGIBLE_FOR_INDEPENDENT_REVIEW';
 return {
  schema:'sbc.production-readiness.three-track.v1',
  status:sourceReady&&claimsReady?'AWAITING_INDEPENDENT_LIVE_APPROVAL':'NO_GO',
  deploymentAuthorized:false, // NEVER infer GoDaddy production readiness from CI
  liveDeploymentVerified:false,
  release,
  sourceCoverage:{required:requiredSources,missing:sourceMissing},
  thresholdPerTrack:95,
  tracks,
  blockers:[
   ...(!sourceReady?['release.'+release.reason]:[]),
   ...ratings.blockers
  ],
  nextAction:!sourceReady?'Rebuild exact-source prebuilt release and verify owner-approved rollback':
   !claimsReady?'Collect independently verifiable Build, SaaS and Company evidence':
   'Independent owner and provider verification of live backup, deployment, permissions, billing, fulfillment and revenue',
  note:'Source CI and submitted evidence cannot establish production GoDaddy health, real Square settlement, customer activation, backup restoration or business revenue. No source or database is modified.'
 };
}
if(require.main===module){
 const args=process.argv.slice(2);
 const i=args.indexOf('--evidence');
 let evidence={};
 if(i>=0){
  if(!args[i+1])throw Error('Missing --evidence file');
  evidence=JSON.parse(require('node:fs').readFileSync(path.resolve(args[i+1]),'utf8'));
 }
 const report=assess({evidence});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(args.includes('--require-deploy-approval'))process.exitCode=2; // No CI can authorize Published
}
module.exports={assess,normalizeError,requiredSources};
