'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../browser_public');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('global rescue excludes Website Production modal without deleting commerce safeguards',()=>{
 const css=read('sbc-global-contrast-rescue-20261106.css');
 assert.doesNotMatch(css,/:is\(#content,#modal\)/,'unscoped modal rescue overrides Studio light surfaces');
 assert.match(css,/#modal:not\(:has\(\.v6526-studio\)\)/);
 assert.match(css,/quote-preview/);
});
test('Website Production retains its scoped light surface rules',()=>{
 const css=read('sbc-website-production-contrast-v1.css');
 assert.match(css,/#modal \.v6526-studio \.sbc-factory-light-panel/);
 assert.match(css,/color:#14283f!important/);
});
test('both mirrored global stylesheets remain identical',()=>{
 assert.equal(read('sbc-global-contrast-rescue-20261106.css'),fs.readFileSync(path.resolve(root,'../public/sbc-global-contrast-rescue-20261106.css'),'utf8'));
});
