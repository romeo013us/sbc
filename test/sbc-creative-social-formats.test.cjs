'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {createLocalMediaRenderer}=require('../enterprise/creative-intelligence/local-media.cjs');
const {stageSocialJpeg}=require('../enterprise/creative-intelligence/social-jpeg.cjs');
const {buildSocialRelease}=require('../enterprise/creative-intelligence/social-release.cjs');
const {verifySocialDeploy}=require('../scripts/verify-social-deploy.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
test('approved source yields exact-size private JPEG variants and each can be independently verified',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-formats-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const ffmpeg='/usr/bin/ffmpeg',ffprobe='/usr/bin/ffprobe',render=createLocalMediaRenderer({ffmpeg,ffprobe});
 const logo=await render.renderImage({format:'square',palette:'ink',brand:'Test fixture',headline:'Fixture logo',detail:'Synthetic test only',cta:'Test'}),logoPath=path.join(root,'logo.png');await fs.writeFile(logoPath,logo.bytes);
 const digests=new Set();
 for(const [format,width,height] of [['square',1080,1080],['landscape',1200,628],['portrait',1080,1920]]){
  const media=await render.renderImage({format,palette:'midnight',brand:'Fixture',headline:'Build your business',detail:'Review only test image',cta:'Review'});
  const asset={id:hash(media.bytes),sha256:hash(media.bytes),tenantId:7,projectId:'sbc-marketing',mime:'image/png',alt:'Fixture graphic'};
  const reviews={get:()=>({state:'approved',version:1,assetId:asset.id}),exportApproved:async()=>({asset,bytes:media.bytes})};
  const options={reviews,tenantId:7,ffmpeg,ffprobe,logoPath,logoSha256:hash(logo.bytes),outputRoot:root,format,jobId:'job-1'};
  const staged=await stageSocialJpeg(options);assert.deepEqual([staged.width,staged.height],[width,height]);assert.equal(staged.publicationReady,false);digests.add(staged.sha256);
  const release=await buildSocialRelease({...options,priorSourceIds:[],entries:[{jobId:'job-1',approvedSha256:staged.sha256,reviewVersion:1}]});
  const entry=release.manifest.entries[0],bytes=await fs.readFile(path.join(root,staged.file));assert.equal(hash(bytes),entry.sha256);
  const receipt=await verifySocialDeploy(release.manifest,{transport:async()=>new Response(bytes,{headers:{'content-type':'image/jpeg'}})});assert.equal(receipt.mediaVerified,true);assert.equal(receipt.publicationReady,false);
  await assert.rejects(stageSocialJpeg({...options,format:'unexpected'}),/INVALID_SOCIAL_FORMAT/);
 }
 assert.equal(digests.size,3);
});
