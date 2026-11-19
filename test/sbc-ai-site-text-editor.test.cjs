'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {listEditableNodes,replaceEditableNode}=require('../enterprise/sbc-ai-site-text-editor.cjs');
const page=Buffer.from('<!doctype html><html><head><title>Do not change title</title><style>.x{content:"old"}</style></head><body>'+
 '<header><h1>Welcome <em>to Phil&#39;s</em></h1><p>Reliable &amp; clear</p></header>'+
 '<img src="car.svg" alt="An old image">'+
 '<script>const html="<h2>Should not be editable</h2>";</script>'+
 '<form><label for="phone">Your phone</label><input name="phone"></form></body></html>');
test('no-code editor lists visible text tokens with stable IDs but excludes scripts, styles, title and attributes',()=>{
 const rows=listEditableNodes('index.html',page);
 assert(rows.some(x=>x.tag==='h1'&&x.text==='Welcome'));
 assert(rows.some(x=>x.tag==='em'&&x.text==="to Phil's"));
 assert(rows.some(x=>x.tag==='p'&&x.text==='Reliable & clear'));
 assert(rows.some(x=>x.tag==='label'&&x.text==='Your phone'));
 assert(rows.every(x=>!/Do not change|Should not|old image|content/.test(x.text)));
 assert.deepEqual(rows,listEditableNodes('index.html',page));
});
test('changing one selected text node escapes HTML injection and keeps code, attributes, images and original unchanged',()=>{
 const row=listEditableNodes('index.html',page).find(x=>x.text==='Reliable & clear');
 const next=replaceEditableNode('index.html',page,row.id,'Premium & <trusted> "repair"');
 assert.match(next.toString(),/<p>Premium &amp; &lt;trusted&gt; &quot;repair&quot;<\/p>/);
 assert.match(next.toString(),/<script>const html="<h2>Should not be editable<\/h2>";<\/script>/);
 assert.match(next.toString(),/alt="An old image"/);
 assert.match(next.toString(),/name="phone"/);
 assert.match(page.toString(),/<p>Reliable &amp; clear<\/p>/);
 assert.throws(()=>replaceEditableNode('index.html',page,row.id,'Reliable & clear'),/TEXT_EDIT_NO_CHANGE/);
 assert.throws(()=>replaceEditableNode('index.html',next,row.id,'changed again'),/TEXT_EDIT_STALE_SELECTION/);
});
test('editor refuses unsupported pages, forged IDs and dangerous replacement control data',()=>{
 assert.throws(()=>listEditableNodes('../index.html',page),/TEXT_EDIT_PAGE_UNSUPPORTED/);
 assert.throws(()=>listEditableNodes('assets/app.js',page),/TEXT_EDIT_PAGE_UNSUPPORTED/);
 assert.throws(()=>replaceEditableNode('index.html',page,'a'.repeat(32),'hi'),/TEXT_EDIT_STALE_SELECTION/);
 const row=listEditableNodes('index.html',page)[0];
 assert.throws(()=>replaceEditableNode('index.html',page,row.id,'New\nHeader'),/TEXT_EDIT_INVALID_INPUT/);
 assert.throws(()=>replaceEditableNode('index.html',page,row.id,'x'.repeat(241)),/TEXT_EDIT_INVALID_INPUT/);
});
