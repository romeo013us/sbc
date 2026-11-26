'use strict';
// Deterministic on-screen scene text, not automatic speech transcription.
const stamp=s=>'00:'+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.000';
function sceneCaptions(slides){
 if(!Array.isArray(slides)||slides.length<1||slides.length>4)throw Error('INVALID_SCENE_CAPTIONS');
 let offset=0,out='WEBVTT\n\n';
 for(const s of slides){if(!s||!Number.isInteger(s.seconds)||s.seconds<2||s.seconds>8||typeof s.headline!=='string'||s.headline.length>160||!s.headline.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(s.headline)||offset+s.seconds>24)throw Error('INVALID_SCENE_CAPTIONS');const text=s.headline.trim().replace(/\s+/gu,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');out+=stamp(offset)+' --> '+stamp(offset+s.seconds)+'\n'+text+'\n\n';offset+=s.seconds;}
 return out;
}
module.exports={sceneCaptions};
