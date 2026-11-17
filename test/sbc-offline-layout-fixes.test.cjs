'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(area,file)=>fs.readFileSync(path.join(root,area,file),'utf8');
test('owner login heading has an explicit dark color on its actual white card',()=>{
 const css=read('public','sbc-command-center-focus-v1.css');
 assert.match(css,/body #login \.login-card h1\s*\{[^}]*color:#14283e\s*!important/i);
 assert.match(css,/body #login \.login-card h1\s*\{[^}]*-webkit-text-fill-color:#14283e\s*!important/i);
 assert.equal(css,read('browser_public','sbc-command-center-focus-v1.css'));
});
test('mobile account portfolio must contain its navigation horizontally, not widen the entire document',()=>{
 const css=read('public','sbc-account-manager-v1.css');
 assert.match(css,/@media\(max-width:850px\)[\s\S]*\.workspace\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:850px\)[\s\S]*\.sidebar\s*\{[^}]*min-width:0/);
 assert.match(css,/@media\(max-width:850px\)[\s\S]*\.sidebar nav\s*\{[^}]*overflow-x:auto/);
 assert.equal(css,read('browser_public','sbc-account-manager-v1.css'));
});
