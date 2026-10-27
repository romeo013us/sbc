'use strict';
// SBC release diagnostic: read-only, no database or runtime mutation.
// Run: node scripts/diagnose-release-sync.cjs
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>{try{return fs.readFileSync(path.join(root,p),'utf8')}catch{return null}};
const pkg=JSON.parse(read('package.json')||'{}');
const bootstrap=read('bootstrap.js')||'';
const prebuilt=read('scripts/prebuilt-runtime.cjs')||'';
const sha=p=>{try{return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')}catch{return null}};
const sourceArchive=(bootstrap.match(/const RELEASE_ZIP = path.join\(__dirname, '([^']+)'\)/)||[])[1]||null;
const expectedVersion=(bootstrap.match(/const EXPECTED_VERSION = '([^']+)'/)||[])[1]||null;
const patchId=(bootstrap.match(/const HOTFIX_PATCH_ID = '([^']+)'/)||[])[1]||null;
const archive=sourceArchive?{file:sourceArchive,sha256:sha(sourceArchive)}:null;
const result={diagnostic:'SBC_RELEASE_SYNC_READ_ONLY',packageVersion:pkg.version||null,bootstrapExpectedVersion:expectedVersion,bootstrapPatchId:patchId,sourceArchive:archive,prebuiltHelperPresent:!!prebuilt,prebuiltHelperSha256:sha('scripts/prebuilt-runtime.cjs'),bootstrapSha256:sha('bootstrap.js'),runtimeFingerprintSha256:sha('scripts/runtime-build-fingerprint.cjs'),gitCommit:process.env.GITHUB_SHA||process.env.COMMIT_SHA||process.env.SOURCE_VERSION||null,warning:'This report identifies repository inputs only. It does not prove which assets the browser received or which GoDaddy deployment is live.'};
console.log(JSON.stringify(result,null,2));
if(!archive?.sha256||!prebuilt||!expectedVersion)process.exitCode=1;
