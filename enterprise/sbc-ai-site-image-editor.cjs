'use strict';
/**
 * Owner-controlled static-image replacements for customer ZIP sites.
 * No SVG, HTML, active content, remote fetches or image re-encoding.
 * All replacements retain the original asset name and extension.
 */
const path=require('node:path');
const MAX_IMAGE_BYTES=4*1024*1024;
const MAX_IMAGE_PIXELS=24*1024*1024;
const MAX_DIMENSION=8192;
const RASTER_EXT={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
function dimensions(width,height){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
    width>MAX_DIMENSION||height>MAX_DIMENSION||width*height>MAX_IMAGE_PIXELS)
  throw Error('IMAGE_DIMENSIONS_UNSAFE');
 return {width,height};
}
function pngDimensions(buf){
 if(buf.length<45||!buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||
   buf.readUInt32BE(8)!==13||buf.toString('ascii',12,16)!=='IHDR'||
   buf.toString('ascii',buf.length-8,buf.length-4)!=='IEND')
  throw Error('IMAGE_FORMAT_INVALID');
 return dimensions(buf.readUInt32BE(16),buf.readUInt32BE(20));
}
function jpegDimensions(buf){
 if(buf.length<20||buf.readUInt16BE(0)!==0xffd8||buf.readUInt16BE(buf.length-2)!==0xffd9)
  throw Error('IMAGE_FORMAT_INVALID');
 let i=2;
 while(i+3<buf.length){
  if(buf[i]!==0xff)throw Error('IMAGE_FORMAT_INVALID');
  while(buf[i]===0xff)i++;
  if(i>=buf.length)break;
  const marker=buf[i++];
  if(marker===0xd9||marker===0xda)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(i+2>buf.length)break;
  const length=buf.readUInt16BE(i);
  if(length<2||i+length>buf.length)throw Error('IMAGE_FORMAT_INVALID');
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<7)throw Error('IMAGE_FORMAT_INVALID');
   return dimensions(buf.readUInt16BE(i+5),buf.readUInt16BE(i+3));
  }
  i+=length;
 }
 throw Error('IMAGE_FORMAT_INVALID');
}
function webpDimensions(buf){
 if(buf.length<30||buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WEBP'||
   buf.readUInt32LE(4)!==buf.length-8)throw Error('IMAGE_FORMAT_INVALID');
 const fourcc=buf.toString('ascii',12,16);
 const chunkSize=buf.readUInt32LE(16);
 if(20+chunkSize>buf.length)throw Error('IMAGE_FORMAT_INVALID');
 if(fourcc==='VP8X'){
  if(chunkSize<10||(buf[20]&0x02))throw Error('IMAGE_FORMAT_INVALID'); // no animated WebP
  return dimensions(1+buf.readUIntLE(24,3),1+buf.readUIntLE(27,3));
 }
 if(fourcc==='VP8L'){
  if(chunkSize<5||buf[20]!==0x2f)throw Error('IMAGE_FORMAT_INVALID');
  return dimensions(1+buf[21]+((buf[22]&0x3f)<<8),
   1+(buf[22]>>6)+(buf[23]<<2)+((buf[24]&0x0f)<<10));
 }
 if(fourcc==='VP8 '){
  if(chunkSize<10||buf.toString('hex',23,26)!=='9d012a')throw Error('IMAGE_FORMAT_INVALID');
  return dimensions(buf.readUInt16LE(26)&0x3fff,buf.readUInt16LE(28)&0x3fff);
 }
 throw Error('IMAGE_FORMAT_INVALID');
}
function verifyImageAsset(name,buf){
 const asset=String(name||''),ext=path.posix.extname(asset).toLowerCase(),mime=RASTER_EXT[ext];
 if(!mime||asset.length>260||asset.startsWith('/')||asset.includes('\\')||
   asset.split('/').some(p=>!p||p==='.'||p==='..')||asset.split('/').length>12)
  throw Error('IMAGE_ASSET_INVALID');
 if(!Buffer.isBuffer(buf)||buf.length<20||buf.length>MAX_IMAGE_BYTES)
  throw Error('IMAGE_SIZE_INVALID');
 const result=mime==='image/png'?pngDimensions(buf):
   mime==='image/jpeg'?jpegDimensions(buf):webpDimensions(buf);
 return {path:asset,mime,bytes:buf.length,...result};
}
function listReplaceableImages(files){
 const result=[];
 for(const file of (Array.isArray(files)?files:[]).slice().sort((a,b)=>String(a?.name).localeCompare(String(b?.name)))){
  if(!RASTER_EXT[path.posix.extname(String(file?.name||'')).toLowerCase()])continue;
  try{result.push(verifyImageAsset(file.name,file.content))}catch{/* broken/nonraster files cannot be replaced from quick editor */}
  if(result.length>=80)break;
 }
 return result;
}
module.exports={MAX_IMAGE_BYTES,verifyImageAsset,listReplaceableImages};
