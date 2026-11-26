'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCreativeService}=require('../enterprise/creative-intelligence/creative-service.cjs');
const scope={tenantId:9,projectId:'website-1'};
const design={format:'landscape',brand:'SBC',headline:'Create with purpose',detail:'Professional websites',cta:'Contact us',palette:'midnight'};
async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-service-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,config:{root,ffmpeg:'/usr/bin/ffmpeg',ffprobe:'/usr/bin/ffprobe'}};}
test('renders and saves real PNG and MP4 as private draft assets in a single project',async t=>{
 const {config}=await setup(t),svc=createCreativeService(config);
 const image=await svc.create(scope,{kind:'template-image',design,alt:'Website graphic'});
 const video=await svc.create(scope,{kind:'template-video',slides:[{design,seconds:2}],alt:'Promotional video'});
 assert.equal(image.asset.mime,'image/png');assert.equal(video.asset.mime,'video/mp4');assert.equal(video.duration,2);
 assert.equal(image.asset.reviewState,'draft');assert.equal(video.asset.reviewState,'draft');assert.match(video.captions,/WEBVTT/);
 const resumed=createCreativeService(config);
 assert.equal((await resumed.list(scope)).length,2);
 assert.equal((await resumed.get(scope,video.asset.id)).bytes.toString('ascii',4,8),'ftyp');
 assert.equal(await resumed.get({...scope,projectId:'website-2'},image.asset.id),null);
});
test('rejects unknown engines, cross-scope fields and invalid requests before rendering',async t=>{
 const {config}=await setup(t),svc=createCreativeService({...config,ffmpeg:'/missing/ffmpeg'});
 for(const r of [{kind:'ai-video',alt:'Demo'},{kind:'template-image',design,alt:' '},{kind:'template-image',design,alt:'Demo',tenantId:99},{kind:'template-video',slides:[],alt:'Demo',publish:true}])await assert.rejects(svc.create(scope,r),/INVALID_CREATIVE_/);
 await assert.rejects(svc.create({...scope,projectId:'../../x'},{kind:'template-image',design,alt:'Demo'}),/INVALID_CREATIVE_SCOPE/);
 assert.deepEqual(await svc.list(scope),[]);
});
test('render failure leaves no fake asset or success record',async t=>{
 const {config}=await setup(t),svc=createCreativeService({...config,ffmpeg:'/missing/ffmpeg'});
 await assert.rejects(svc.create(scope,{kind:'template-image',design,alt:'Demo'}),/LOCAL_RENDER_UNAVAILABLE/);
 assert.deepEqual(await svc.list(scope),[]);
});
