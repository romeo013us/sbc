'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {sceneCaptions}=require('../enterprise/creative-intelligence/scene-captions.cjs');
test('scene captions use exact scene boundaries and escape cue markup',()=>{assert.equal(sceneCaptions([{headline:'  A & B <sale>  ',seconds:4},{headline:'Next\nscene',seconds:2}]),'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nA &amp; B &lt;sale&gt;\n\n00:00:04.000 --> 00:00:06.000\nNext scene\n\n');});
test('invalid scene lengths, missing text and excessive durations fail closed',()=>{for(const slides of [[],[{headline:'x',seconds:1}],[{headline:'',seconds:4}],Array.from({length:4},()=>({headline:'x',seconds:8})),[{headline:'x\u0000',seconds:4}]])assert.throws(()=>sceneCaptions(slides),/INVALID_SCENE_CAPTIONS/);});
