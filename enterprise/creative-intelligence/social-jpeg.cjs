'use strict';
// Offline staging only. Never call from a web request or publish the result without final review.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createHash,randomUUID}=require('node:crypto'),{promisify}=require('node:util'),{execFile}=require('node:child_process');
const exec=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex'),isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function stageSocialJpeg({reviews,tenantId,jobId,ffmpeg,ffprobe,logoPath,logoSha256,outputRoot,format='square'}){
 const formats={square:[1080,1080,900,300,144,918],landscape:[1200,628,508,250,96,520],portrait:[1080,1920,1680,360,192,1704]};
 if(!Object.hasOwn(formats,format))throw Error('INVALID_SOCIAL_FORMAT');
 const [width,height,bodyHeight,logoWidth,logoHeight,logoY]=formats[format];
 if(!Number.isSafeInteger(tenantId)||tenantId<1||typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(jobId)||!isHash(logoSha256)||![ffmpeg,ffprobe,logoPath,outputRoot].every(v=>typeof v==='string'&&path.isAbsolute(v)))throw Error('INVALID_SOCIAL_CONFIG');
 const scope={tenantId,projectId:'sbc-marketing'},prior=reviews.get(scope,jobId);
 const item=await reviews.exportApproved(scope,jobId),a=item.asset;
 if(prior?.state!=='approved'||prior.assetId!==a.id||!isHash(a.id)||a.tenantId!==tenantId||a.projectId!==scope.projectId||a.mime!=='image/png'||!Buffer.isBuffer(item.bytes)||item.bytes.length>32*1024*1024||hash(item.bytes)!==a.sha256)throw Error('INVALID_MARKETING_ASSET');
 const stat=await fs.stat(logoPath);if(!stat.isFile()||stat.size>4*1024*1024)throw Error('LOGO_INTEGRITY');
 const logo=await fs.readFile(logoPath);if(hash(logo)!==logoSha256||!logo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('LOGO_INTEGRITY');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-social-'));let temp;
 try{
  await fs.writeFile(path.join(dir,'source.png'),item.bytes);await fs.writeFile(path.join(dir,'logo.png'),logo);
  const run=(bin,args)=>exec(bin,args,{cwd:dir,timeout:60000,maxBuffer:128*1024,windowsHide:true,shell:false});
  await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-filter_complex_threads','1','-protocol_whitelist','file,pipe','-threads','2','-i','source.png','-protocol_whitelist','file,pipe','-threads','2','-i','logo.png','-filter_complex',`[0:v]scale=${width}:${bodyHeight}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(${bodyHeight}-ih)/2:color=0x102030[base];[1:v]scale=${logoWidth}:${logoHeight}:force_original_aspect_ratio=decrease[logo];[base][logo]overlay=(W-w)/2:${logoY}+(${logoHeight}-h)/2`,'-frames:v','1','-threads','2','-map_metadata','-1','-q:v','2','-f','image2','out.jpg']);
  const bytes=await fs.readFile(path.join(dir,'out.jpg')),probe=JSON.parse((await run(ffprobe,['-v','error','-show_entries','stream=codec_name,width,height','-of','json','out.jpg'])).stdout).streams;
  if(bytes.length<10000||bytes.length>4*1024*1024||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9||probe.length!==1||probe[0].codec_name!=='mjpeg'||probe[0].width!==width||probe[0].height!==height)throw Error('INVALID_SOCIAL_JPEG');
  const current=await reviews.exportApproved(scope,jobId),review=reviews.get(scope,jobId);if(review?.state!=='approved'||review.version!==prior.version||current.asset.id!==a.id||hash(current.bytes)!==a.sha256)throw Error('REVIEW_REQUIRED');
  const sha256=hash(bytes),file=sha256+'.jpg';await fs.mkdir(outputRoot,{recursive:true,mode:0o700});temp=path.join(outputRoot,'.'+randomUUID()+'.tmp');await fs.writeFile(temp,bytes,{flag:'wx',mode:0o600});
  try{await fs.link(temp,path.join(outputRoot,file));}catch(e){if(e.code!=='EEXIST')throw e;}
  if(hash(await fs.readFile(path.join(outputRoot,file)))!==sha256)throw Error('SOCIAL_STAGE_INTEGRITY');
  return {file,sha256,sourceAssetId:a.id,reviewVersion:prior.version,logoSha256,alt:a.alt,width,height,mime:'image/jpeg',bytes:bytes.length,publicationReady:false};
 }finally{if(temp)await fs.rm(temp,{force:true});await fs.rm(dir,{recursive:true,force:true});}
}
if(require.main===module){(async()=>{const {environmentRuntime}=require('./workspace.cjs'),rt=environmentRuntime();if(!rt)throw Error('CREATIVE_LOCAL_RENDERER_NOT_CONFIGURED');try{console.log(JSON.stringify(await stageSocialJpeg({reviews:rt.reviews,tenantId:rt.tenantId,jobId:process.argv[2],ffmpeg:process.env.SBC_CREATIVE_FFMPEG,ffprobe:process.env.SBC_CREATIVE_FFPROBE,logoPath:process.env.SBC_SOCIAL_LOGO_PATH,logoSha256:process.env.SBC_SOCIAL_LOGO_SHA256,outputRoot:process.env.SBC_SOCIAL_PRIVATE_STAGE})));}finally{rt.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={stageSocialJpeg};
