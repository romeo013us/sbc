'use strict';
/* Regression: theme selection and official logo on researcher and sales desks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const theme=require('../public/sbc-workforce-theme-v6698.js');
assert.equal(theme.cleanTheme('light'),'light');
assert.equal(theme.cleanTheme('dark'),'dark');
assert.equal(theme.cleanTheme('system'),'dark','dark must be default');
assert.equal(theme.userKey('caller','workerA'), 'sbc-workforce-theme-v1:caller:workerA');
assert.notEqual(theme.userKey('caller','workerA'),theme.userKey('lead_researcher','workerA'));
const storage={data:new Map(),getItem(k){return this.data.get(k)||null},setItem(k,v){this.data.set(k,v)}};
storage.setItem(theme.userKey('caller','staff1'),'light');
assert.equal(theme.getSaved(storage,'caller','staff1'),'light');
assert.equal(theme.getSaved(storage,'caller','staff2'),'dark');
assert.equal(theme.getSaved(null,'caller','staff2'),'dark');
const css=read('public/sbc-workforce-theme-v6698.css'),js=read('public/sbc-workforce-theme-v6698.js');
assert.equal(css,read('browser_public/sbc-workforce-theme-v6698.css'));
assert.equal(js,read('browser_public/sbc-workforce-theme-v6698.js'));
assert(css.includes('html[data-sbc-theme="light"]'));
assert(css.includes('color-scheme:light'));
assert(css.includes('background:#fff!important')&&css.includes('color:#18314a!important'));
for(const p of ['public/lead-research.html','public/sales-caller.html','browser_public/sales-caller.html']){
 const html=read(p);
 assert(html.includes('data-sbc-theme-toggle'),p+' theme toggle');
 assert(html.includes('aria-pressed="false"'),p+' accessible toggle');
 assert(html.includes('sbc-workforce-theme-v6698.css?v=1'),p+' CSS reference');
 assert(html.includes('sbc-workforce-theme-v6698.js?v=1'),p+' JS reference');
 assert(html.includes('/assets/sbc-logo.jpg'),p+' official logo');
}
assert.equal(read('public/sales-caller.html'),read('browser_public/sales-caller.html'));
assert.equal(read('public/sales-caller.js'),read('browser_public/sales-caller.js'));
assert.equal(read('public/sales-caller.css'),read('browser_public/sales-caller.css'));
assert(read('public/lead-research.js').includes('SBCWorkforceTheme.attach'));
assert(read('public/sales-caller.js').includes('SBCWorkforceTheme.attach'));
console.log('PASS: SBC workforce dark default, per-employee light toggle, accessibility, logo and frontend mirror');
