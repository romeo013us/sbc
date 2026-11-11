'use strict';
/* V66.151: Gate on two browser bundle mirrors in GitHub publish step.
 * This prevents a green isolated staging ZIP followed by a failing master
 * release due to stale public/v10.js on the checked-out source.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const wf=fs.readFileSync(path.join(root,'.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
for(const text of [
 'cp "$temp/public/v10.js" public/v10.js',
 'cp "$temp/browser_public/v10.js" browser_public/v10.js',
 'cmp public/v10.js browser_public/v10.js',
 'git add server.js enterprise/v56150-revenue-autopilot.js enterprise/sbc-unattended-notifications-v6504.cjs public/app.js browser_public/app.js public/v10.js browser_public/v10.js',
 "const files=['server.js','enterprise/v56150-revenue-autopilot.js','enterprise/sbc-unattended-notifications-v6504.cjs','public/app.js','browser_public/app.js','public/v10.js','browser_public/v10.js'",
]) assert(wf.includes(text),'GoDaddy published branch is missing a verified HR asset: '+text);
const shortcut=require('./v66149-stage-hr-dashboard-shortcut.cjs');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const staged=shortcut.patchApp(app);
assert(staged.includes("window.location.assign('/hr-workstation.html')"),
 'HR button must open the functional staff manager workstation, not legacy read-only view');
const patch=require('./v66150-stage-hr-ui.cjs');
const v10=fs.readFileSync(path.join(root,'public/v10.js'),'utf8');
assert.equal(v10,fs.readFileSync(path.join(root,'browser_public/v10.js'),'utf8'),'source mirror divergence');
const compiled=patch.patchV10(v10);
assert(compiled.includes('value="hr_manager"'),'HR role can be created by owner');
assert(compiled.includes('/hr-workstation.html'),'HR manager opens its own station');
new vm.Script(compiled);
const html=fs.readFileSync(path.join(root,'public/hr-workstation.html'),'utf8');
assert(html.includes('/api/hr/drafts')&&html.includes('Owner Approval Queue'));
const policy=require('../enterprise/v66149-hr-workstation-policy.cjs');
assert(policy.METHODS.has('Remitly Business')&&policy.METHODS.has('Payoneer'));
assert(!policy.METHODS.has('Wise'),'Wise must not be offered');
assert.equal(policy.allowed('POST','/api/v9/payroll/run'),false,'HR manager cannot mark payroll paid');
assert.equal(policy.allowed('POST','/api/hr/drafts/:id/decision'),false,'owner-only authorization');
console.log('PASS V66.151: both HR UI mirrors delivered to GoDaddy, manager login and owner approvals, Wise excluded');
