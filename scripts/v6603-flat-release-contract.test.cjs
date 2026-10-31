'use strict';
/* Current V66 flat runtime release check. This is a source-control invariant
 * and does not replace a rebuilt GoDaddy deployment receipt or live E2E test. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const config=JSON.parse(read('.airo/config.json'));
const deployed=JSON.parse(read('SBC-FLAT-RELEASE-IDENTITY.json'));
const receipt=fs.existsSync(path.join(root,'SBC-DEPLOY-RECEIPT.json'))?JSON.parse(read('SBC-DEPLOY-RECEIPT.json')):null;
const release=require('../config/release-identity.js');
const launcher=read('sbc-godaddy-flat-entrypoint.cjs');
const legacy=read('bootstrap.js');
assert.equal(pkg.version,'66.0.0');
assert.equal(release.RELEASE_VERSION,pkg.version);
const [major,minor,patch]=pkg.version.split('.').map(Number);
assert.equal(release.RELEASE.major,major);
assert.equal(release.RELEASE.minor,minor);
assert.equal(release.RELEASE.patch,patch);
assert.equal(pkg.main,'sbc-godaddy-flat-entrypoint.cjs');
assert.match(pkg.scripts.start,/node sbc-godaddy-flat-entrypoint\.cjs/);
assert.match(config.serveCommand,/npm start/);
assert.match(legacy,/require\('\.\/sbc-godaddy-flat-entrypoint\.cjs'\)/);
assert.match(launcher,/persistState\(/);
assert.match(launcher,/ephemeral customer state/);
assert.match(launcher,/serverSha256/);
const serverHash=crypto.createHash('sha256').update(read('server.js')).digest('hex');
assert.equal(deployed.serverSha256,serverHash,'server.js must match pinned launch hash');
if(receipt){
  assert.equal(deployed.sourceCommit,receipt.sourceCommit);
  assert.equal(deployed.sourceFingerprint,receipt.sourceFingerprint);
  assert.match(receipt.artifactSha256,/^[a-f0-9]{64}$/);
}else{
  // The compiled master has an inventory but no legacy receipt; CI creates a
  // fresh release-matching receipt when staging, before GoDaddy extracts it.
  assert.match(deployed.stagedInventorySha256||'',/^[a-f0-9]{64}$/);
}
assert.match(deployed.sourceCommit,/^[a-f0-9]{40}$/);
assert.match(deployed.sourceFingerprint,/^[a-f0-9]{64}$/);
const html=read('public/index.html');
assert.equal(html,read('browser_public/index.html'),'published and mirrored HTML must match');
assert.match(html,/sbc-v6636-canonical-styles/);
assert.match(html,/sbc-light-contrast-v6601\.css/);
assert.match(html,/sbc-browser-view-repair-v6601\.js/);
console.log('[SBC V66 FLAT RELEASE] PASS: launcher, pinned server, '+(receipt?'matching receipt':'inventory-anchored staged source')+', V66 semantic version, static browser mirror');
console.log('[SBC V66 FLAT RELEASE] NOTE: this does not verify new frontend asset hashes in a fresh GoDaddy ZIP or live Square transaction.');
