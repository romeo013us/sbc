'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyImageAsset,listReplaceableImages,MAX_IMAGE_BYTES}=require('../enterprise/sbc-ai-site-image-editor.cjs');
function png(width=1,height=1){
 const buf=Buffer.alloc(45);
 Buffer.from('89504e470d0a1a0a','hex').copy(buf);
 buf.writeUInt32BE(13,8);buf.write('IHDR',12,'ascii');
 buf.writeUInt32BE(width,16);buf.writeUInt32BE(height,20);
 buf.write('IEND',37,'ascii');
 return buf;
}
function jpeg(width=1400,height=800){
 const sof=Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x0b,0x08,
  height>>8,height&255,width>>8,width&255,0x01,0x01,0x11,0x00,
  0xff,0xda,0x00,0x02,0xff,0xd9]);
 return sof;
}
function webp(width=900,height=500){
 const buf=Buffer.alloc(30);
 buf.write('RIFF',0,'ascii');buf.writeUInt32LE(buf.length-8,4);buf.write('WEBPVP8X',8,'ascii');
 buf.writeUInt32LE(10,16);buf.writeUIntLE(width-1,24,3);buf.writeUIntLE(height-1,27,3);
 return buf;
}
test('raster image verifier accepts bounded PNG, JPEG and WebP assets with matching formats',()=>{
 assert.deepEqual(verifyImageAsset('assets/hero.png',png()).mime,'image/png');
 assert.deepEqual(verifyImageAsset('assets/car.jpg',jpeg()).width,1400);
 assert.deepEqual(verifyImageAsset('assets/shop.webp',webp()).height,500);
 assert.deepEqual(verifyImageAsset('logo.jpeg',jpeg()).mime,'image/jpeg');
});
test('image picker excludes SVG, scripts, malformed images, disallowed paths and oversized graphics',()=>{
 const available=listReplaceableImages([
  {name:'assets/main.png',content:png(500,300)},
  {name:'assets/unsafe.svg',content:Buffer.from('<svg onload="alert(1)"/>')},
  {name:'assets/broken.jpg',content:Buffer.from('plain text')},
  {name:'assets/back.webp',content:webp(320,240)}
 ]);
 assert.deepEqual(available.map(x=>x.path),['assets/back.webp','assets/main.png']);
 assert.throws(()=>verifyImageAsset('../logo.png',png()),/IMAGE_ASSET_INVALID/);
 assert.throws(()=>verifyImageAsset('logo.svg',png()),/IMAGE_ASSET_INVALID/);
 assert.throws(()=>verifyImageAsset('logo.png',webp()),/IMAGE_FORMAT_INVALID/);
 assert.throws(()=>verifyImageAsset('logo.png',png(9000,2)),/IMAGE_DIMENSIONS_UNSAFE/);
 assert.throws(()=>verifyImageAsset('logo.jpg',Buffer.alloc(MAX_IMAGE_BYTES+1)),/IMAGE_SIZE_INVALID/);
});
test('animation and invalid RIFF/WebP or JPEG are rejected',()=>{
 const animated=webp();animated[20]=2;
 assert.throws(()=>verifyImageAsset('animated.webp',animated),/IMAGE_FORMAT_INVALID/);
 const forged=webp();forged.writeUInt32LE(100000,4);
 assert.throws(()=>verifyImageAsset('fake.webp',forged),/IMAGE_FORMAT_INVALID/);
 assert.throws(()=>verifyImageAsset('fake.jpeg',Buffer.from('ffd8ffd9','hex')),/IMAGE_FORMAT_INVALID|IMAGE_SIZE_INVALID/);
});
