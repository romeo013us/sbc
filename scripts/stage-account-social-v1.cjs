'use strict';
/* Opt-in source patch only. Not invoked by package install, app startup, or CI.
 * Run against a REVIEW BRANCH only; never directly against deployed release.
 * The API still stays dark by default and writeReady/publishing remain false.
 */
const fs=require('node:fs');const path=require('node:path');
const ANCHOR='module.exports = function registerCRM(app, { auth, getContext }) {';
const MARKER='SBC_ACCOUNT_SOCIAL_V1_SAFE_MOUNT';
const INSERT=`\n  // ${MARKER}: opt-in, fail-closed extension of existing CRM route registration.\n  if (process.env.SBC_ACCOUNT_SOCIAL_V1 === '1') {\n    require('./sbc-account-social-integration-v1.cjs').registerAccountSocialIntegration(app, {\n      enabled: true, auth, getContext\n      // Explicit published writer lease, vault bridge, and scheduler must be\n      // connected in a reviewed follow-up before any writes or posts occur.\n    });\n  }\n`;
function patch(source){
 if(source.includes(MARKER))return {changed:false,source};
 if(source.split(ANCHOR).length!==2)throw Error('ACCOUNT_SOCIAL_CRM_ANCHOR_MISSING_OR_AMBIGUOUS');
 return {changed:true,source:source.replace(ANCHOR,ANCHOR+INSERT)};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),f=path.join(root,'routes/crm.js');
 if(!fs.existsSync(f))throw Error('ACCOUNT_SOCIAL_CRM_SOURCE_NOT_FOUND');
 const {changed,source}=patch(fs.readFileSync(f,'utf8'));
 if(changed){fs.writeFileSync(f,source);console.log('STAGED: guarded route mount added to source; default disabled; NOT deployed.');}
 else console.log('STAGED: guarded route mount already present; no changes.');
}
module.exports={patch,ANCHOR,MARKER};
