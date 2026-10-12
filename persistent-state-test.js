'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
// Windows CI/dev shells may not have privilege to create symbolic links.
// Use directory junctions for this test on Windows; they preserve the same
// directory redirection semantics without requiring Developer Mode/admin rights.
if (process.platform === 'win32') {
  const originalSymlinkSync = fs.symlinkSync.bind(fs);
  fs.symlinkSync = (target, pathName, type) => originalSymlinkSync(target, pathName, 'junction');
}
const { persistState } = require('./persistent-state.js');
const quiet = { log() {}, warn() {} };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-persist-'));
const w = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const r = p => fs.readFileSync(p, 'utf8');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
delete process.env.SBC_PERSIST_DIR; delete process.env.SBC_ALLOW_EPHEMERAL_DATA;

ok('reused runtime: live state is adopted, folder becomes a link, writes land in persistent store', () => {
  const base = tmp(), rt = path.join(base, '.sbc-runtime-v1-aaa');
  w(path.join(rt, 'data/sbc-data.json'), 'LIVE-1'); w(path.join(rt, 'data/recovery-snapshots/s1.json'), 'SNAP');
  persistState(base, rt, { reused: true, log: quiet });
  assert(fs.lstatSync(path.join(rt, 'data')).isSymbolicLink());
  assert.strictEqual(r(path.join(base, 'sbc-persistent/data/sbc-data.json')), 'LIVE-1');
  assert.strictEqual(r(path.join(base, 'sbc-persistent/data/recovery-snapshots/s1.json')), 'SNAP');
  fs.writeFileSync(path.join(rt, 'data/new-state.json'), 'X');   // server writes through the old path
  assert.strictEqual(r(path.join(base, 'sbc-persistent/data/new-state.json')), 'X');
});
ok('NEW release: live data from the previous runtime survives, new defaults added, live files NOT overwritten, manifest refreshed', () => {
  const base = tmp(), old = path.join(base, '.sbc-runtime-v1-aaa'), neu = path.join(base, '.sbc-runtime-v2-bbb');
  w(path.join(old, 'data/sbc-data.json'), 'LIVE-OLD'); w(path.join(old, 'data/sbc-integrity-manifest.json'), 'MANIFEST-OLD'); w(path.join(old, 'backups/b1.sql'), 'BACKUP');
  w(path.join(old, '.sbc-bootstrap-ready.json'), '{}');
  w(path.join(neu, 'data/sbc-data.json'), 'DEFAULT-NEW'); w(path.join(neu, 'data/brand-new-default.json'), 'NEWFILE'); w(path.join(neu, 'data/sbc-integrity-manifest.json'), 'MANIFEST-NEW');
  persistState(base, neu, { reused: false, log: quiet });
  const P = path.join(base, 'sbc-persistent');
  assert.strictEqual(r(P + '/data/sbc-data.json'), 'LIVE-OLD');
  assert.strictEqual(r(P + '/data/brand-new-default.json'), 'NEWFILE');
  assert.strictEqual(r(P + '/data/sbc-integrity-manifest.json'), 'MANIFEST-NEW');
  assert.strictEqual(r(P + '/backups/b1.sql'), 'BACKUP');
});
ok('later release keeps accumulating the same live state (no reset on a third deploy)', () => {
  const base = tmp(), a = path.join(base, '.sbc-runtime-v1-a'), b = path.join(base, '.sbc-runtime-v2-b'), c = path.join(base, '.sbc-runtime-v3-c');
  w(path.join(a, 'data/s.json'), 'A'); persistState(base, a, { reused: true, log: quiet });
  fs.writeFileSync(path.join(a, 'data/s.json'), 'A2');
  w(path.join(b, 'data/s.json'), 'DEFAULT'); persistState(base, b, { reused: false, log: quiet });
  w(path.join(c, 'data/s.json'), 'DEFAULT'); persistState(base, c, { reused: false, log: quiet });
  assert.strictEqual(r(path.join(c, 'data/s.json')), 'A2');
});
ok('idempotent: calling twice changes nothing and does not break the link', () => {
  const base = tmp(), rt = path.join(base, '.sbc-runtime-v1-a'); w(path.join(rt, 'data/s.json'), 'S');
  persistState(base, rt, { reused: true, log: quiet }); persistState(base, rt, { reused: true, log: quiet });
  assert(fs.lstatSync(path.join(rt, 'data')).isSymbolicLink()); assert.strictEqual(r(path.join(rt, 'data/s.json')), 'S');
});
ok('fails CLOSED when persistence is impossible, unless explicitly overridden', () => {
  const base = tmp(), rt = path.join(base, '.sbc-runtime-v1-a'); w(path.join(rt, 'data/s.json'), 'S');
  const blocker = path.join(base, 'a-file'); fs.writeFileSync(blocker, 'x'); process.env.SBC_PERSIST_DIR = path.join(blocker, 'sub');
  assert.throws(() => persistState(base, rt, { log: quiet }), /Refusing to start with throw-away data/);
  process.env.SBC_ALLOW_EPHEMERAL_DATA = '1';
  assert.strictEqual(persistState(base, rt, { log: quiet }).ephemeral, true);
  assert.strictEqual(r(path.join(rt, 'data/s.json')), 'S');           // original data untouched
  delete process.env.SBC_PERSIST_DIR; delete process.env.SBC_ALLOW_EPHEMERAL_DATA;
});
ok('deleting an old runtime folder can never delete persistent state', () => {
  const base = tmp(), a = path.join(base, '.sbc-runtime-v1-a'); w(path.join(a, 'data/s.json'), 'KEEP');
  persistState(base, a, { reused: true, log: quiet });
  fs.rmSync(a, { recursive: true, force: true });
  assert.strictEqual(r(path.join(base, 'sbc-persistent/data/s.json')), 'KEEP');
});
ok('rebuilding the SAME runtime folder (e.g. a hotfix id change) cannot lose live state', () => {
  const base = tmp(), rt = path.join(base, '.sbc-runtime-v1-a'); w(path.join(rt, 'data/s.json'), 'LIVE');
  persistState(base, rt, { reused: true, log: quiet });          // what bootstrap does BEFORE it deletes the folder
  fs.rmSync(rt, { recursive: true, force: true }); w(path.join(rt, 'data/s.json'), 'DEFAULT'); // fresh extraction
  persistState(base, rt, { reused: false, log: quiet });
  assert.strictEqual(r(path.join(rt, 'data/s.json')), 'LIVE');
});
console.log(`persistent-state: ${n}/7 PASS`);
