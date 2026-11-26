'use strict';
// Trusted local worker only. Never execute in a CRM request handler. Caller owns
// tenant authentication, media rights, capacity leases and durable asset storage.
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const {renderVector}=require('./vector-design.cjs');
const exec=promisify(execFile),MAX_BYTES=32*1024*1024;
const plain=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
function validateWave(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<46||bytes.length>8*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,16)!=='WAVEfmt '||bytes.readUInt32LE(16)!==16||bytes.readUInt16LE(20)!==1||bytes.toString('ascii',36,40)!=='data'||bytes.readUInt32LE(4)!==bytes.length-8||bytes.readUInt32LE(40)!==bytes.length-44)throw Error('INVALID_LOCAL_AUDIO');
 const channels=bytes.readUInt16LE(22),rate=bytes.readUInt32LE(24),align=bytes.readUInt16LE(32);
 if(![1,2].includes(channels)||rate<8000||rate>48000||bytes.readUInt16LE(34)!==16||align!==channels*2||bytes.readUInt32LE(28)!==rate*align||(bytes.length-44)%align||(bytes.length-44)/(rate*align)>24)throw Error('INVALID_LOCAL_AUDIO');
 return Buffer.from(bytes);
}
const stamp=s=>'00:'+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.000';
function createLocalMediaRenderer({ffmpeg,ffprobe}){
 if(![ffmpeg,ffprobe].every(v=>typeof v==='string'&&path.isAbsolute(v)&&!v.includes('\0')))throw Error('INVALID_LOCAL_BINARY');
 let busy=false;
 async function run(binary,args,dir){
  try{return await exec(binary,args,{cwd:dir,timeout:120000,maxBuffer:512*1024,windowsHide:true,shell:false});}
  catch(e){throw Error(e.code==='ENOENT'?'LOCAL_RENDER_UNAVAILABLE':'LOCAL_RENDER_FAILED');}
 }
 async function work(fn){
  if(busy)throw Error('LOCAL_WORKER_BUSY');busy=true;let dir;
  try{dir=await fs.mkdtemp(path.join(os.tmpdir(),'sbc-media-'));return await fn(dir);}
  finally{try{if(dir)await fs.rm(dir,{recursive:true,force:true});}finally{busy=false;}}
 }
 const ff=(args,dir)=>run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n',...args],dir);
 async function raster(design,dir,index){
  const input='slide-'+index+'.svg',output='slide-'+index+'.png';
  await fs.writeFile(path.join(dir,input),design.svg,{flag:'wx',mode:0o600});
  await ff(['-protocol_whitelist','file,pipe','-threads','2','-i',input,'-frames:v','1','-threads','2','-f','image2',output],dir);
  return output;
 }
 async function readAsset(dir,name){
  const filename=path.join(dir,name),stat=await fs.stat(filename);
  if(!stat.isFile()||stat.size<16||stat.size>MAX_BYTES)throw Error('LOCAL_RENDER_INVALID_OUTPUT');
  const bytes=await fs.readFile(filename);
  return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
 }
 async function renderImage(input){
  const design=renderVector(input);
  return work(async dir=>{
   const name=await raster(design,dir,0),asset=await readAsset(dir,name);
   if(!asset.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||asset.bytes.readUInt32BE(16)!==design.width||asset.bytes.readUInt32BE(20)!==design.height)throw Error('LOCAL_RENDER_INVALID_OUTPUT');
   return {...asset,mime:'image/png',width:design.width,height:design.height};
  });
 }
 async function renderVideo(input){
  if(!plain(input,['slides','audio'])||!Array.isArray(input.slides)||input.slides.length<1||input.slides.length>4)throw Error('INVALID_LOCAL_VIDEO');
  const slides=input.slides.map(s=>{
   if(!plain(s,['design','seconds'])||!Number.isInteger(s.seconds)||s.seconds<2||s.seconds>8)throw Error('INVALID_LOCAL_VIDEO');
   return {design:renderVector(s.design),headline:s.design.headline.trim().replace(/\s+/gu,' '),seconds:s.seconds};
  });
  const duration=slides.reduce((n,s)=>n+s.seconds,0),{width,height}=slides[0].design;
  if(duration>24||slides.some(s=>s.design.width!==width||s.design.height!==height))throw Error('INVALID_LOCAL_VIDEO');
  const audio=input.audio===undefined?null:validateWave(input.audio);
  let offset=0,captions='WEBVTT\n\n';
  for(const s of slides){captions+=stamp(offset)+' --> '+stamp(offset+s.seconds)+'\n'+s.headline.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'\n\n';offset+=s.seconds;}
  return work(async dir=>{
   const args=['-filter_complex_threads','1'],filters=[];
   for(let i=0;i<slides.length;i++){
    const name=await raster(slides[i].design,dir,i),seconds=slides[i].seconds;
    args.push('-protocol_whitelist','file,pipe','-threads','2','-loop','1','-framerate','24','-t',String(seconds),'-i',name);
    filters.push('['+i+':v]format=yuv420p,setsar=1,trim=duration='+seconds+',setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.25,fade=t=out:st='+(seconds-.25)+':d=0.25[v'+i+']');
   }
   const labels=slides.map((_,i)=>'[v'+i+']').join('');
   filters.push(labels+'concat=n='+slides.length+':v=1:a=0[outv]');
   if(audio){await fs.writeFile(path.join(dir,'audio.wav'),audio,{flag:'wx',mode:0o600});args.push('-protocol_whitelist','file,pipe','-f','wav','-i','audio.wav');filters.push('['+slides.length+':a]apad,atrim=duration='+duration+',asetpts=PTS-STARTPTS[outa]');}
   args.push('-filter_complex',filters.join(';'),'-map','[outv]');
   if(audio)args.push('-map','[outa]','-c:a','aac','-b:a','128k');else args.push('-an');
   args.push('-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-t',String(duration),'-fs',String(MAX_BYTES),'-f','mp4','output.mp4');
   await ff(args,dir);
   const {stdout}=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','stream=codec_type,codec_name,width,height:format=duration','-of','json','output.mp4'],dir);
   let probe;try{probe=JSON.parse(stdout);}catch{throw Error('LOCAL_RENDER_INVALID_OUTPUT');}
   const video=probe.streams?.find(s=>s.codec_type==='video'),hasAudio=probe.streams?.some(s=>s.codec_type==='audio')===true,actual=Number(probe.format?.duration);
   if(!video||video.codec_name!=='h264'||video.width!==width||video.height!==height||!Number.isFinite(actual)||Math.abs(actual-duration)>.12||hasAudio!==Boolean(audio))throw Error('LOCAL_RENDER_INVALID_OUTPUT');
   return {...await readAsset(dir,'output.mp4'),mime:'video/mp4',width,height,duration,hasAudio,captions,captionKind:'scene-text-not-transcription'};
  });
 }
 return Object.freeze({renderImage,renderVideo});
}
module.exports={createLocalMediaRenderer};
