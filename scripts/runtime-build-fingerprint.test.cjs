'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildFingerprint,markerMatches}=require('./runtime-build-fingerprint.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-runtime-cache-'));
function put(rel,contents){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,contents);}
try{
 put('bootstrap.js','/* v1 */');
 put('hotfix-assets/apply-test.js','module.exports={apply(){}};');
 put('scripts/mock.js','module.exports=true;');
 put('sbc-persistent/data/customer-state.json','{"customers":248}');
 const sources=['bootstrap.js','hotfix-assets','scripts'];
 const first=buildFingerprint(root,sources);
 assert.match(first,/^[a-f0-9]{64}$/);
 assert.equal(first,buildFingerprint(root,[...sources].reverse()),'source traversal is deterministic');
 const expected={sourceHash:'baseline',version:'66.0.0',patchId:'v6637',buildFingerprint:first};
 assert.equal(markerMatches({...expected,readyAt:'yesterday'},expected),true);
 assert.equal(markerMatches({sourceHash:'baseline',version:'66.0.0',patchId:'v6637'},expected),false,'old cached marker cannot bypass source checks');
 put('hotfix-assets/apply-test.js','module.exports={apply(){return 2}};');
 const changed=buildFingerprint(root,sources);
 assert.notEqual(first,changed,'source patch must invalidate cached runtime');
 assert.equal(markerMatches({...expected}, {...expected,buildFingerprint:changed}),false);
 assert.equal(markerMatches({...expected}, {...expected,sourceHash:'new baseline'}),false);
 assert.equal(markerMatches({...expected}, {...expected,patchId:'new patch'}),false);
 assert.equal(markerMatches({...expected}, {...expected,version:'67.0.0'}),false);
 put('sbc-persistent/data/customer-state.json','{"customers":310}');
 assert.equal(changed,buildFingerprint(root,sources),'persistent database files must not trigger a rebuild');
 assert.equal(fs.readFileSync(path.join(root,'sbc-persistent/data/customer-state.json'),'utf8'),'{"customers":310}');
 put('scripts/second.js','module.exports=false;');
 assert.notEqual(changed,buildFingerprint(root,sources),'new source assets must invalidate');
 fs.unlinkSync(path.join(root,'scripts/second.js'));
 fs.symlinkSync(path.join(root,'bootstrap.js'),path.join(root,'scripts/link.js'));
 assert.throws(()=>buildFingerprint(root,sources),/symbolic source input/,'source symlinks must not be dereferenced');
 const bootstrap=fs.readFileSync(path.join(__dirname,'../bootstrap.js'),'utf8');
 assert.match(bootstrap,/markerMatches\(m, runtimeIdentity\)/,'runtime must enforce fingerprint on cache reuse');
 assert.match(bootstrap,/buildFingerprint: buildFingerprintHash/,'startup must calculate new fingerprint');
 assert.match(bootstrap,/loadManifestValidator\(\)\.audit\(runtimeDir, EXPECTED_VERSION\)/,'cached runtime must pass manifest check');
 assert.match(bootstrap,/persistState\(__dirname, runtimeDir, \{ reused: true \}\)/,'before deletion existing persistent data must be adopted');
 console.log('[SBC RUNTIME CACHE TEST] PASS: source edits invalidate stale cache, generated manifest rechecked, state outside fingerprint, legacy markers rejected.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
