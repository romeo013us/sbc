#!/usr/bin/env node
'use strict';const {assertSecretPolicy}=require('../enterprise/godkim-secret-audit');const r=assertSecretPolicy({root:require('path').resolve(__dirname,'..')});console.log(JSON.stringify({suite:'secret-audit',status:r.ok?'PASS':'FAIL',count:r.count},null,2));
