#!/usr/bin/env node
'use strict';
// Report only violation file paths and rule names, never matching source or secrets.
// Keep the exact same fail-closed scan; diagnostics must not suppress findings.
const {auditSecrets}=require('../enterprise/godkim-secret-audit');
const r=auditSecrets({root:require('node:path').resolve(__dirname,'..')});
console.log(JSON.stringify({suite:'secret-audit',status:r.ok?'PASS':'FAIL',count:r.count,violations:r.violations.map(x=>({file:x.file,reason:x.reason}))},null,2));
if(!r.ok){process.exitCode=1}
