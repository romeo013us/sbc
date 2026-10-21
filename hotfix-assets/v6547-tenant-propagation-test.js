'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const releasePatch=require('./apply-v6547-tenant-propagation');
const root=path.resolve(__dirname,'..'),patch=fs.readFileSync(path.join(root,'hotfix-assets/apply-v6547-tenant-propagation.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
assert.equal(pkg.version,lock.version);assert.equal(lock.packages[''].version,pkg.version);assert.match(pkg.version,/^65\.1\.\d+$/);
for(const p of [/requireMappedRequestTenant\(req\)/,/tenantId:rec\.tenantId/,/tenantId:requireRequestTenant\(req\)/,/Customer not found in the authenticated tenant/,/public host is not mapped to a tenant/,/SBC_V6547_TENANT_PROPAGATION/])assert.match(patch,p);
assert.doesNotMatch(patch,/tenantId\s*\|\|\s*1/);assert.doesNotMatch(patch,/SBC_RUNTIME_READ_ONLY\s*=\s*false/);assert.doesNotMatch(patch,/MYSQL_RECOVERY_REQUIRED\s*=\s*false/);
const b=fs.readFileSync(path.join(root,'bootstrap.js'),'utf8');assert.match(b,/apply-v6547-tenant-propagation\.js/);assert.match(b,/apply-v6548-lead-import-cache-contract\.js/);assert.ok(b.includes('apply-v6557-owner-force-unlock.js'));assert.ok(b.includes('apply-v6558-economic-control-ddl-gate.js'));assert.ok(b.includes('apply-v6559-launch-phone-theme-layout.js'));assert.ok(b.includes('apply-v6550-remove-floating-ask-kim.js'));assert.ok(b.includes('apply-v6557-owner-force-unlock.js'));assert.ok(b.includes('apply-v6558-economic-control-ddl-gate.js'));assert.ok(b.includes('apply-v6553-command-center-redesign.js'));assert.ok(b.includes('apply-v6555-theme-contrast.js'));assert.ok(b.includes('apply-v6556-twilio-voice-sdk.js'));assert.ok(b.includes('apply-v6560-live-call-notes.js'));assert.ok(b.includes('apply-v6561-brand-system.js'));assert.ok(b.includes('apply-v6562-executive-dashboard.js'));assert.ok(b.includes('apply-v6557-owner-force-unlock.js'));

{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6547-release-pin-'));
 try{
  for(const rel of ['public/app.js','browser_public/app.js','enterprise/release-guard.js'])fs.mkdirSync(path.dirname(path.join(fixture,rel)),{recursive:true});
  fs.writeFileSync(path.join(fixture,'public/app.js'),"const EXPECTED_RELEASE_VERSION = '65.1.18';");
  fs.writeFileSync(path.join(fixture,'browser_public/app.js'),"const EXPECTED_RELEASE_VERSION = '65.1.45';");
  fs.writeFileSync(path.join(fixture,'enterprise/release-guard.js'),"throw new Error('RELEASE_IDENTITY_MISMATCH package version does not match 65.1.18');");
  releasePatch.alignReleaseIdentityPins(fixture);
  assert.match(fs.readFileSync(path.join(fixture,'public/app.js'),'utf8'),/EXPECTED_RELEASE_VERSION = '65\.1\.46'/);
  assert.match(fs.readFileSync(path.join(fixture,'browser_public/app.js'),'utf8'),/EXPECTED_RELEASE_VERSION = '65\.1\.46'/);
  assert.match(fs.readFileSync(path.join(fixture,'enterprise/release-guard.js'),'utf8'),/65\.1\.46/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
}

console.log('[SBC '+pkg.version+'] tenant propagation and executive-dashboard release contract PASS');
