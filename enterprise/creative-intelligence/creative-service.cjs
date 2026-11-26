'use strict';
// Local worker composition, not an HTTP endpoint. Authentication, rights review,
// job leases and durable shared-volume provisioning are upstream responsibilities.
const {createLocalMediaRenderer}=require('./local-media.cjs');
const {createMediaLibrary}=require('./media-library.cjs');
const only=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
function createCreativeService({root,ffmpeg,ffprobe}){
 const renderer=createLocalMediaRenderer({ffmpeg,ffprobe}),library=createMediaLibrary({root});
 async function create(scope,request){
  if(!only(scope,['tenantId','projectId'])||!Number.isSafeInteger(scope.tenantId)||scope.tenantId<1||typeof scope.projectId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(scope.projectId))throw Error('INVALID_CREATIVE_SCOPE');
  const target={tenantId:scope.tenantId,projectId:scope.projectId};
  if(!request||typeof request.alt!=='string'||!request.alt.trim()||request.alt.length>180||/[<>\u0000-\u001f\u007f]/.test(request.alt))throw Error('INVALID_CREATIVE_REQUEST');
  const alt=request.alt.trim();let output;
  if(request.kind==='template-image'&&only(request,['kind','design','alt']))output=await renderer.renderImage(request.design);
  else if(request.kind==='template-video'&&only(request,['kind','slides','audio','alt']))output=await renderer.renderVideo({slides:request.slides,audio:request.audio});
  else throw Error('INVALID_CREATIVE_REQUEST');
  const asset=await library.put(target,{bytes:output.bytes,mime:output.mime,sha256:output.sha256,alt});
  const result={asset,width:output.width,height:output.height};
  if(output.mime==='video/mp4')Object.assign(result,{duration:output.duration,hasAudio:output.hasAudio,captions:output.captions,captionKind:output.captionKind});
  return result;
 }
 return Object.freeze({create,get:library.get,list:library.list});
}
module.exports={createCreativeService};
