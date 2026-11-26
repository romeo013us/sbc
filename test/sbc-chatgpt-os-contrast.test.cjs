'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const asset=x=>fs.readFileSync(path.join(root,x),'utf8');
const css=asset('public/sbc-chatgpt-os-v1.css');
test('owner ChatGPT desk has isolated, explicit foreground and background overrides for both themes',()=>{
 assert.match(css,/#sbc-chatgpt-os-panel\s*\{[^}]*background:\s*#f7fafc\s*!important[^}]*color:\s*#162b40\s*!important/);
 assert.match(css,/#sbc-chatgpt-os-panel \.sbc-chatgpt-os-content\s*\{[^}]*background:\s*#f7fafc\s*!important[^}]*color:\s*#162b40\s*!important/);
 assert.match(css,/#sbc-chatgpt-os-panel \.sbc-chatgpt-os-content :is\(input,textarea,select\)\s*\{[^}]*background:\s*#fff\s*!important[^}]*color:\s*#102a43\s*!important/);
 assert.match(css,/#sbc-chatgpt-os-panel \.sbc-chatgpt-os-safety\s*\{[^}]*background:\s*#edf7f1\s*!important[^}]*color:\s*#153d2e\s*!important/);
 assert.match(css,/#sbc-chatgpt-os-panel \.sbc-chatgpt-os-head[^{]*\{[^}]*background:\s*#0e2c44\s*!important/);
 assert.match(css,/#sbc-chatgpt-os-panel \.sbc-chatgpt-os-history-row :is\(p,strong\)\s*\{[^}]*color:\s*#21384d\s*!important/);
});
test('high-contrast owner desk CSS is byte-identical in both deployment frontend asset trees',()=>{
 assert.equal(css,asset('browser_public/sbc-chatgpt-os-v1.css'));
});
test('dashboard bootstrap cache-busts the updated contrast stylesheet',()=>{
 assert.match(asset('public/sbc-command-center-focus-v1.js'),/sbc-chatgpt-os-v1\.css\?v=66\.0\.132-resume/);
 assert.match(asset('public/index.html'),/sbc-command-center-focus-v1\.js\?v=20261126-owner-clean/);
 assert.equal(asset('public/sbc-command-center-focus-v1.js'),asset('browser_public/sbc-command-center-focus-v1.js'));
 assert.equal(asset('public/index.html'),asset('browser_public/index.html'));
});
