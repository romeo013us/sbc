'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {createMediaLibrary}=require('../enterprise/creative-intelligence/media-library.cjs');
const {createLocalMediaRenderer}=require('../enterprise/creative-intelligence/local-media.cjs');
const worker=createLocalMediaRenderer({ffmpeg:'/usr/bin/ffmpeg',ffprobe:'/usr/bin/ffprobe'});
const design={format:'square',brand:'SBC',headline:'Better websites',detail:'Design for local businesses',cta:'Contact us',palette:'midnight'};
const scope={tenantId:7,projectId:'client-a'};
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-library-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,library:createMediaLibrary({root})};}
function input(a){return {bytes:a.bytes,mime:a.mime,sha256:a.sha256,alt:'Illustrative marketing design'};}
test('real rendered image survives library recreation; duplicate concurrent writes converge',async t=>{
 const {root,library}=await fixture(t),a=await worker.renderImage(design);
 const [one,two]=await Promise.all([library.put(scope,input(a)),library.put(scope,input(a))]);
 assert.deepEqual(one,two);assert.equal(one.reviewState,'draft');
 const restored=createMediaLibrary({root}),result=await restored.get(scope,one.id);
 assert.deepEqual(result.bytes,a.bytes);assert.equal(result.asset.sha256,a.sha256);
 assert.deepEqual(await restored.list(scope),[one]);
});
test('same asset ID cannot cross tenant or customer project boundaries',async t=>{
 const {library}=await fixture(t),a=await worker.renderImage(design),asset=await library.put(scope,input(a));
 assert.equal(await library.get({...scope,tenantId:8},asset.id),null);
 assert.equal(await library.get({...scope,projectId:'client-b'},asset.id),null);
 assert.deepEqual(await library.list({...scope,projectId:'client-b'}),[]);
 assert.throws(()=>library.list({...scope,projectId:'../escape'}),/INVALID_MEDIA_SCOPE/);
});
test('forged MIME, forged digest, external paths and unreviewed publication claims fail',async t=>{
 const {library}=await fixture(t),a=await worker.renderImage(design);
 for(const change of [{sha256:'0'.repeat(64)},{mime:'image/svg+xml'},{alt:''},{public:true},{bytes:Buffer.from('bad'),sha256:createHash('sha256').update('bad').digest('hex')}])await assert.rejects(library.put(scope,{...input(a),...change}),/INVALID_MEDIA_/);
 await assert.rejects(library.get(scope,'../../etc/passwd'),/INVALID_MEDIA_ID/);
});
test('tampered media fails closed instead of being returned',async t=>{
 const {root,library}=await fixture(t),a=await worker.renderImage(design),asset=await library.put(scope,input(a));
 const file=path.join(root,'7','client-a',asset.id+'.asset'),bytes=await fs.readFile(file);bytes[bytes.length-1]^=1;await fs.writeFile(file,bytes);
 await assert.rejects(library.get(scope,asset.id),/MEDIA_INTEGRITY_FAILURE/);
});
