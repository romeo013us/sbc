'use strict';
// Prospect Website God Tier media: all tests are pure rendering/static behavior.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Factory=require('../enterprise/sbc-prospect-site-factory.cjs');
const sample={id:'demo_synthetic',slug:'synthetic-barbershop-0123456789abcdef',status:'Draft',offerTier:'essentials',industry:'Barber Shop',customer:{businessName:'Synthetic Barbershop',city:'Miami',phone:'',email:''}};
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('full four-page and one-page templates preserve navigation and add labeled industry stock imagery',()=>{
 for(const tier of ['starter','essentials']){
  const demo={...sample,offerTier:tier};
  for(const page of Factory.availablePages(demo)){
   const html=Factory.renderPage(demo,page);
   assert.match(html,/Website concept preview/);
   assert.match(html,/siteNavigation/);
   assert.match(html,/Example stock photo/i);
   assert.match(html,/<img\s[^>]*loading="lazy"/);
   assert.match(html,/noindex,nofollow,noarchive/);
   assert.doesNotMatch(html,/fake reviews|certified barbers|award.winning/i);
  }
 }
});
test('hero stock image, client-ready gallery, demo video and optional narration are real accessible controls',()=>{
 const html=Factory.renderPage(sample,'home');
 assert.match(html,/<img[^>]*class="art-photo"/);
 assert.match(html,/alt="Example stock photo[^"]*"/);
 assert.match(html,/Sample gallery/i);
 assert.match(html,/sbc-site-film/);
 assert.match(html,/demo-media\/sbc-motion\.mp4/);
 assert.doesNotMatch(html,/<video[^>]*autoplay/);
 assert.match(html,/data-site-voice=/);
 assert.match(html,/type="button"[^>]*data-site-voice=/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/Sample video/i);
});
test('website imagery changes by industry but never implies sample photos depict the named shop',()=>{
 const barber=Factory.renderPage(sample,'home');
 const restaurant=Factory.renderPage({...sample,industry:'Restaurant'},'home');
 assert.notEqual(barber.match(/class="art-photo" src="([^"]+)"/)?.[1],restaurant.match(/class="art-photo" src="([^"]+)"/)?.[1]);
 assert.match(barber,/not a photo of Synthetic Barbershop/i);
 assert.match(restaurant,/Example stock photo/);
});
test('published/static website export does not assume the SBC private media path',()=>{
 const html=Factory.renderPage({...sample,status:'Approved'},'home',{staticMode:true});
 assert.match(html,/Sample video/i);
 assert.doesNotMatch(html,/<source[^>]*src="\/demo-media\//);
 assert.match(html,/site\.css/);
 assert.match(html,/site\.js/);
});
test('progressive motion, browser voice and no-submission behavior remain safe and mirrored',()=>{
 const css=read('public/sbc-prospect-site.css');
 const js=read('public/sbc-prospect-site.js');
 assert.equal(css,read('browser_public/sbc-prospect-site.css'));
 assert.equal(js,read('browser_public/sbc-prospect-site.js'));
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/sbc-reveal/);
 assert.match(css,/site-film/);
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/speechSynthesis/);
 assert.match(js,/SpeechSynthesisUtterance/);
 assert.match(js,/prefers-reduced-motion/);
 assert.match(js,/preventDefault\(\)/);
 assert.doesNotMatch(js,/\bfetch\s*\(|sendBeacon|XMLHttpRequest/);
 assert.doesNotMatch(js,/speechSynthesis\.speak\(/); // speech must only begin in click handler; use local variable
});
