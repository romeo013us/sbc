#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const release=require('../config/release-identity');
assert.equal(pkg.version, require('../package.json').version);
assert.equal(release.RELEASE_VERSION,pkg.version);
assert.match(app,/server returned HTML instead of JSON/);
assert.match(app,/not proof that your session expired/);
assert.doesNotMatch(app,/const authHtml=\/sign in again\|session is missing\|session\.\*expired\|id=/);
assert.match(app,/if\(r\.status===401\).*sbcShowLogin/);
console.log('SBC V65.1.26 auth HTML fallback regression test: PASS');
