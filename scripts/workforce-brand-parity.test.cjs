'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const owner=read('public/index.html');
const research=read('public/lead-research.html');
const sales=read('public/sales-caller.html');
const salesMirror=read('browser_public/sales-caller.html');
const researchCss=read('public/lead-research.css');
const salesCss=read('public/sales-caller.css');
const salesMirrorCss=read('browser_public/sales-caller.css');
const expected=(owner.match(/<img\s+class="brand-logo"\s+src="([^"]+)"\s+alt=/)||[])[1];
assert.equal(expected,'/assets/sbc-logo.jpg','owner logo is the branding source of truth');
for(const [label,html] of [['Lorna research workstation',research],['Spanish sales caller workstation',sales],['Spanish sales caller browser mirror',salesMirror]]){
 assert.match(html,/<img class="brand-logo" src="\/assets\/sbc-logo\.jpg" alt="Successful By Choice official logo"/,label+' must display actual official logo');
 assert.doesNotMatch(html,/<span class="mark">SBC<\/span>|<div class="brand">SBC\s/i,label+' must not replace official logo with text-only mark');
 assert.match(html,/<link rel="icon" href="\/assets\/sbc-logo\.jpg"/,label+' favicon should match');
}
assert(fs.statSync(path.join(root,'public/assets/sbc-logo.jpg')).size>1000,'official owner asset must exist');
assert(fs.statSync(path.join(root,'browser_public/assets/sbc-logo.jpg')).size>1000,'browser mirror asset must exist');
assert.deepEqual(fs.readFileSync(path.join(root,'public/assets/sbc-logo.jpg')),fs.readFileSync(path.join(root,'browser_public/assets/sbc-logo.jpg')),'owner and browser logo asset bytes must match');
assert.equal(sales,salesMirror,'sales caller HTML mirrors must match');
assert.equal(salesCss,salesMirrorCss,'sales caller CSS mirrors must match');
for(const [label,css] of [['research',researchCss],['sales',salesCss]]){
 assert.match(css,/\.brand-logo\{[^}]*width:48px;[^}]*height:48px;[^}]*object-fit:contain;/,label+' official logo sizing');
}
console.log('PASS — Official SBC logo byte parity and branded staff workstation headers');
