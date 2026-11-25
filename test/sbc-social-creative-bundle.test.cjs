'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const E=require('../enterprise/sbc-social-asset-engine.cjs');
const B=require('../enterprise/sbc-social-creative-bundle.cjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const now=Date.parse('2026-11-25T17:00:00Z');
const slot=E.slots('2026-11-25')[1];
function fixture(){
 // Synthetic PNG header for pure manifest contract tests; the real renderer
 // acceptance suite separately verifies complete PNG encoding.
 const png=Buffer.alloc(64);Buffer.from('89504e470d0a1a0a','hex').copy(png);
 png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(1200,16);png.writeUInt32BE(630,20);
 return {...slot,sha256:crypto.createHash('sha256').update(png).digest('hex'),dhash:'1234567890abcdef',width:1200,height:630,service:'Hosting',caption:'Ask about hosting at sbcmia.com.',png};
}
test('signed offline artwork is tenant-bound and accepted using only Node crypto',()=>{
 const row=fixture(),bundle=B.createBundle([row],{tenantId:1,privateKey,now});
 const verified=B.verifyBundle(bundle,{tenantId:1,publicKey,now});
 assert.equal(verified.rows.length,1);assert.deepEqual(verified.rows[0].png,row.png);
 assert.equal(verified.verifyPng(row.png).dhash,row.dhash);
 assert.throws(()=>B.verifyBundle(bundle,{tenantId:2,publicKey,now}),/CREATIVE_BUNDLE_TENANT/);
});
test('signature, expiry and image hash tampering fail closed',()=>{
 const row=fixture(),bundle=B.createBundle([row],{tenantId:1,privateKey,now});
 assert.throws(()=>B.verifyBundle({...bundle,manifest:bundle.manifest+' '},{tenantId:1,publicKey,now}),/CREATIVE_BUNDLE_SIGNATURE/);
 assert.throws(()=>B.verifyBundle(bundle,{tenantId:1,publicKey,now:now+8*86400000}),/CREATIVE_BUNDLE_EXPIRED/);
 const files={...bundle.files,[row.sha256]:Buffer.alloc(64,3).toString('base64')};
 assert.throws(()=>B.verifyBundle({...bundle,files},{tenantId:1,publicKey,now}),/CREATIVE_BUNDLE_IMAGE/);
 assert.throws(()=>B.verifyBundle(bundle,{tenantId:1,publicKey:crypto.generateKeyPairSync('ed25519').publicKey,now}),/CREATIVE_BUNDLE_SIGNATURE/);
});
