'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {createLocalMediaRenderer}=require('../enterprise/creative-intelligence/local-media.cjs');
const {stageHolidayBatch,packageHolidayBatch}=require('../scripts/stage-holiday-batch.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const slugs=['thanksgiving-2026-engagement','black-friday-2026-invest','black-friday-2026-growth'];
test('real JPEG staging and separate exact-byte approval package, no automatic publishing',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-holiday-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const ffmpeg='/usr/bin/ffmpeg',ffprobe='/usr/bin/ffprobe',render=createLocalMediaRenderer({ffmpeg,ffprobe});
 const logo=await render.renderImage({format:'square',palette:'ink',brand:'Test fixture',headline:'Fixture logo',detail:'Synthetic test only',cta:'Test'}),logoPath=path.join(root,'logo.png');await fs.writeFile(logoPath,logo.bytes);
 const entries=[],assets=new Map();for(let i=0;i<3;i++){const jobId='fixture-'+i,media=await render.renderImage({format:'square',palette:'midnight',brand:'Fixture',headline:'Campaign '+i,detail:'Review only test image',cta:'Review'});entries.push({slug:slugs[i],jobId});assets.set(jobId,{asset:{id:hash(media.bytes),sha256:hash(media.bytes),tenantId:7,projectId:'sbc-marketing',mime:'image/png',alt:'Fixture '+i},bytes:media.bytes});}
 const reviews={get:(_s,j)=>({state:'approved',version:1,assetId:assets.get(j).asset.id}),exportApproved:async(_s,j)=>assets.get(j)};
 const options={reviews,tenantId:7,ffmpeg,ffprobe,logoPath,logoSha256:hash(logo.bytes),outputRoot:path.join(root,'private'),priorSourceIds:[]};
 const staged=await stageHolidayBatch(options,entries);assert.equal(staged.publicationReady,false);assert.equal(staged.entries.length,3);assert.equal(new Set(staged.entries.map(x=>x.sha256)).size,3);assert(staged.entries.every(x=>x.approvedSha256===undefined));
 await assert.rejects(packageHolidayBatch(options,staged.entries),/INVALID_HOLIDAY_BATCH/);
 const approved=staged.entries.map(x=>({slug:x.slug,jobId:x.jobId,approvedSha256:x.sha256,reviewVersion:x.reviewVersion}));
 const result=await packageHolidayBatch(options,approved);assert.equal(result.publicationReady,false);assert.equal(result.manifest.entries.length,3);assert.equal(result.zip.readUInt32LE(0),0x04034b50);
 await assert.rejects(packageHolidayBatch(options,approved.map((x,i)=>i?x:{...x,approvedSha256:'0'.repeat(64)})),/SOCIAL_FINAL_APPROVAL_REQUIRED/);
 await assert.rejects(stageHolidayBatch({...options,priorSourceIds:[assets.get(entries[0].jobId).asset.id]},entries),/SOCIAL_CREATIVE_REUSED/);
});
test('reject unknown slots, duplicate jobs, and missing history before rendering',async()=>{
 const e=slugs.map((slug,i)=>({slug,jobId:'job'+i}));for(const entries of [e.slice(0,2),[{...e[0],slug:'unknown'},...e.slice(1)],[e[0],{...e[1],jobId:e[0].jobId},e[2]]])await assert.rejects(stageHolidayBatch({priorSourceIds:[]},entries),/INVALID_HOLIDAY_BATCH/);
 await assert.rejects(stageHolidayBatch({},e),/INVALID_HOLIDAY_HISTORY/);
});
