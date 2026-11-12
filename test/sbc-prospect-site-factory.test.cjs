'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Factory=require('../enterprise/sbc-prospect-site-factory.cjs');
const sample={id:'demo_Xyz1',slug:'synthetic-garage-a8f756dde',status:'Draft',offerTier:'essentials',industry:'Automotive Detailing',customer:{businessName:'Synthetic Garage',city:'Miami',phone:'',email:''}};
test('starter is an actual responsive, navigable complete one-page site',()=>{
 const html=Factory.renderPage({...sample,offerTier:'starter'},'home');
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/<nav id="siteNavigation"/);
 for(const section of ['services','about','contact','faq'])assert.match(html,new RegExp('id="'+section+'"'));
 assert.match(html,/href="#services"/);
 assert.match(html,/href="#contact"/);
 assert.match(html,/name="description"/);
 assert.match(html,/name="viewport"/);
 assert.match(html,/sbc-prospect-site.css/);
 assert.match(html,/sbc-prospect-site.js/);
 assert.match(html,/Synthetic Garage/);
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.throws(()=>Factory.renderPage({...sample,offerTier:'starter'},'services'),{status:404});
});
test('essentials contains four functional pages, consistent navigation and no external API dependencies',()=>{
 assert.deepEqual(Factory.availablePages(sample),['home','services','about','contact']);
 for(const page of Factory.availablePages(sample)){
   const html=Factory.renderPage(sample,page);
   assert.match(html,/siteNavigation/);
   assert.match(html,/\?page=services/);
   assert.match(html,/\?page=about/);
   assert.match(html,/\?page=contact/);
   assert.match(html,/Website concept preview/);
   assert.doesNotMatch(html,/<script[^>]+src="https?:/i);
   assert.doesNotMatch(html,/fake testimonials|five-star verified|award-winning/i);
 }
 const contact=Factory.renderPage(sample,'contact');
 assert.match(contact,/name="message"/);
 assert.match(contact,/data-demo-form/);
 assert.match(contact,/does not submit, save, or transmit/i);
 assert.match(contact,/Business number — add before launch/);
 assert.throws(()=>Factory.renderPage(sample,'pricing'),{status:404});
});
test('draft uses authenticated preview links, approved uses public link, and exported pages use static filenames',()=>{
 assert.match(Factory.renderPage(sample,'services'),/href="\/api\/website-demos\/demo_Xyz1\/preview\?page=contact"/);
 assert.match(Factory.renderPage({...sample,status:'Approved'},'services'),/href="\/demo\/synthetic-garage-a8f756dde\?page=contact"/);
 const staticHtml=Factory.renderPage({...sample,status:'Approved'},'services',{staticMode:true});
 assert.match(staticHtml,/href="contact.html"/);
 assert.match(staticHtml,/href="index.html"/);
 assert.match(staticHtml,/href="site.css"/);
 assert.match(staticHtml,/src="site.js"/);
});
test('industry presets are distinct, descriptions escape user content, and visitor forms remain no-send',()=>{
 const beauty=Factory.renderPage({...sample,industry:'Hair Salon'},'home');
 const auto=Factory.renderPage(sample,'home');
 assert.notEqual(beauty,auto);
 assert.match(beauty,/BEAUTY &amp; CARE/);
 const hostile=Factory.renderPage({...sample,customer:{businessName:'<svg onload=alert(1)>',city:'<img src=x>'}},'home');
 assert.doesNotMatch(hostile,/<svg onload/);
 assert.doesNotMatch(hostile,/<img src=x>/);
 assert.match(hostile,/&lt;svg onload/);
 const js=fs.readFileSync(path.join(__dirname,'../public/sbc-prospect-site.js'),'utf8');
 assert.match(js,/preventDefault\(\)/);
 assert.doesNotMatch(js,/\bfetch\s*\(|sendBeacon|XMLHttpRequest/);
 assert.equal(js,fs.readFileSync(path.join(__dirname,'../browser_public/sbc-prospect-site.js'),'utf8'));
 assert.equal(fs.readFileSync(path.join(__dirname,'../public/sbc-prospect-site.css'),'utf8'),fs.readFileSync(path.join(__dirname,'../browser_public/sbc-prospect-site.css'),'utf8'));
});
