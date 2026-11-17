'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('public/sbc-command-center-focus-v1.css');
function rule(selector){
 const i=css.indexOf(selector+'{');
 assert(i>=0,'Missing scoped readable selector: '+selector);
 return css.slice(i,css.indexOf('}',i)+1);
}
function luminance(hex){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}

test('all owner pages keep a legible light/dark More Actions disclosure instead of inherited unreadable colors',()=>{
 const light=rule('body[data-theme="light"] .sbc-page-more-actions>summary');
 const dark=rule('body[data-theme="dark"] .sbc-page-more-actions>summary');
 assert.match(light,/background:#eff6ff/i);assert.match(light,/color:#16334f/i);
 assert.match(dark,/background:#18334a/i);assert.match(dark,/color:#f2f7fd/i);
 assert(ratio('#eff6ff','#16334f')>=7);
 assert(ratio('#18334a','#f2f7fd')>=7);
 assert.match(light,/min-height:44px/);
 assert.match(dark,/min-height:44px/);
 assert.match(css,/\.sbc-page-more-actions>summary:focus-visible/);
});

test('expanded action menus have explicit paired foreground and background colors in both themes',()=>{
 const light=rule('body[data-theme="light"] .sbc-page-extra-buttons');
 const dark=rule('body[data-theme="dark"] .sbc-page-extra-buttons');
 assert.match(light,/background:#f6faff/i);
 assert.match(light,/color:#16334f/i);
 assert.match(dark,/background:#142b40/i);
 assert.match(dark,/color:#f2f7fd/i);
 assert(ratio('#f6faff','#16334f')>=7);
 assert(ratio('#142b40','#f2f7fd')>=7);
});

test('dropdown menu options never use pale text on pale backgrounds or dark text on dark options',()=>{
 const light=rule('body[data-theme="light"] :is(#content,#modalBody) select option');
 const dark=rule('body[data-theme="dark"] :is(#content,#modalBody) select option');
 assert.match(light,/background:#ffffff/i);assert.match(light,/color:#14283e/i);
 assert.match(dark,/background:#0c1c2e/i);assert.match(dark,/color:#f2f7fd/i);
 assert(ratio('#ffffff','#14283e')>=7);
 assert(ratio('#0c1c2e','#f2f7fd')>=7);
});

test('website production review text stays easy to read on mobile without changing global branding',()=>{
 const small=rule('body #modal #sbcAiDesk small');
 assert.match(small,/font-size:14px/);
 const meta=rule('body #modal #sbcAiDesk .sbc-ai-meta,body #modal #sbcAiDesk .sbc-ai-draft');
 assert.match(meta,/font-size:14px/);
 const mirror=read('browser_public/sbc-command-center-focus-v1.css');
 assert.equal(css,mirror,'browser and GoDaddy CSS mirrors must match byte-for-byte');
 const index=read('public/index.html');
 assert.match(index,/sbc-command-center-focus-v1\.css/);
 assert(!css.includes('@import'),'do not add remote CSS or paid CDN dependency');
});
