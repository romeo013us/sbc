'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const build = require('../config/deployed-build.cjs');
const { MARK, patchServer } = require('../scripts/stage-deployed-build-proof.cjs');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.contentType = value; return this; },
    send(body) { this.body = body; return this; }
  };
}

test('health checks expose only the build verified by the flat launcher', () => {
  const plain = response();
  build.healthHeaders({}, plain, () => {});
  assert.deepEqual(plain.headers, { 'Cache-Control': 'no-store' });
  assert.throws(() => build.recordVerifiedBuild('latest'));
  const commit = 'a'.repeat(40);
  build.recordVerifiedBuild(commit);
  const packaged = response();
  build.healthHeaders({}, packaged, () => {});
  assert.equal(packaged.headers['X-SBC-Source-Commit'], commit);
  assert.throws(() => build.recordVerifiedBuild('b'.repeat(40)));
});

test('missing scripts return a real 404 and normal deep links still reach the app', () => {
  const res = response();
  build.missingBrowserAsset({ method: 'GET', path: '/sbc-lorna-checklist.js' }, res, assert.fail);
  assert.equal(res.statusCode, 404);
  assert.equal(res.contentType, 'text/plain');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  let passed = false;
  build.missingBrowserAsset({ method: 'GET', path: '/officebox/activate' }, response(), () => { passed = true; });
  assert.equal(passed, true);
});

test('packaging installs the health and asset handlers in the intended positions', () => {
  const file = path.resolve(__dirname, '../server.js');
  const source = fs.readFileSync(file, 'utf8');
  const staged = patchServer(source);
  new vm.Script(staged);
  assert(staged.indexOf(MARK) < staged.indexOf("app.get('/healthz'"));
  assert(staged.indexOf('app.use(SBC_DEPLOYED_BUILD.missingBrowserAsset);') < staged.indexOf("app.get('*'"));
  assert.equal(patchServer(staged), staged);
  if (process.argv.includes('--staged')) assert.equal(source, staged);
});
