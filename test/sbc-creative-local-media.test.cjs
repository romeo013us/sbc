'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createLocalMediaRenderer}=require('../enterprise/creative-intelligence/local-media.cjs');
const base={format:'square',brand:'Successful By Choice',headline:'Build your digital presence',detail:'Professional website solutions',cta:'Get started',palette:'midnight'};
const worker=createLocalMediaRenderer({ffmpeg:'/usr/bin/ffmpeg',ffprobe:'/usr/bin/ffprobe'});
function wave(){const samples=8000, b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/8000)*3000),44+i*2);return b;}
test('rasterizes a real PNG, validates dimensions, hashes actual bytes',async()=>{
 const a=await worker.renderImage(base);
 assert.equal(a.mime,'image/png');assert.equal(a.width,1080);assert.equal(a.height,1080);
 assert.equal(a.bytes.readUInt32BE(16),1080);assert.equal(a.bytes.readUInt32BE(20),1080);
 assert.equal(a.sha256,createHash('sha256').update(a.bytes).digest('hex'));
});
test('renders a real captioned two-scene promotional MP4 with approved local WAV audio',async()=>{
 const a=await worker.renderVideo({slides:[{design:base,seconds:2},{design:{...base,headline:'Diseño para tu negocio'},seconds:2}],audio:wave()});
 assert.equal(a.mime,'video/mp4');assert.equal(a.width,1080);assert.equal(a.height,1080);
 assert.equal(a.duration,4);assert.equal(a.hasAudio,true);assert.equal(a.bytes.toString('ascii',4,8),'ftyp');
 assert.match(a.captions,/WEBVTT/);assert.match(a.captions,/00:00:02\.000 --> 00:00:04\.000/);assert.match(a.captions,/Diseño para tu negocio/);
 assert.equal(a.sha256,createHash('sha256').update(a.bytes).digest('hex'));
});
test('invalid video inputs fail before spawning render work',async()=>{
 for(const input of [{slides:[]},{slides:[{design:base,seconds:30}]},{slides:[{design:base,seconds:2},{design:{...base,format:'portrait'},seconds:2}]},{slides:[{design:base,seconds:2}],audio:'https://example.com/audio.wav'},{slides:[{design:base,seconds:2}],audio:Buffer.from('bad')},{slides:[{design:base,seconds:2}],engine:'paid'}])await assert.rejects(worker.renderVideo(input),/INVALID_LOCAL_/);
});
test('configured worker fails explicitly if ffmpeg is not installed',async()=>{
 const unavailable=createLocalMediaRenderer({ffmpeg:'/missing/ffmpeg',ffprobe:'/missing/ffprobe'});
 await assert.rejects(unavailable.renderImage(base),/LOCAL_RENDER_UNAVAILABLE/);
});
