'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('owner Command Center gives Website Production prominent primary navigation while retaining legacy tools',()=>{
 for(const p of ['public/index.html','browser_public/index.html']){
  const html=read(p);
  assert.match(html,/id="sbc-website-production-nav"/);
  assert.match(html,/sbc-website-spotlight-nav owner-only/);
  assert.match(html,/SBC_WEBSITE_CALL_DESK\.open/);
  assert(html.indexOf('id="sbc-website-production-nav"')<html.indexOf('id="sbcAdvancedNav"'));
  assert.match(html,/sbc-website-revenue-shortcuts-v1\.css/);
 }
 const ui=read('public/sbc-website-call-desk-v1.js');
 assert.equal(ui,read('browser_public/sbc-website-call-desk-v1.js'));
 assert.match(ui,/Website Production/);
});

test('sales caller has obvious, dedicated, accessible website showroom from navigation and mission screen',()=>{
 const html=read('public/sales-caller.html');
 assert.equal(html,read('browser_public/sales-caller.html'));
 assert.match(html,/data-panel="websites"/);
 assert.match(html,/id="websites" data-page hidden/);
 assert.match(html,/id="sbcSalesWebsiteLibrary"/);
 assert.match(html,/id="sbcSalesWebsiteCount"/);
 assert.match(html,/Approved website showroom/i);
 assert.match(html,/data-panel="websites"[^>]*>.*(?:Websites|Showroom)/i);
});

test('sales showroom fetches server-approved links and limits them to already assigned staff leads',()=>{
 const js=read('public/sales-caller.js');
 assert.equal(js,read('browser_public/sales-caller.js'));
 assert.match(js,/websites:'Website Showroom'/);
 assert.match(js,/function renderWebsiteShowroom/);
 assert.match(js,/\/api\/website-production\/call-desk\?limit=200/);
 assert.match(js,/\.websiteUrl/);
 assert.match(js,/\/\^\\\/demo\\\/[a-z0-9-]+\$\//);
 assert.match(js,/new Set\(\(data\?\.leads\|\|\[\]\)/);
 assert.match(js,/rel='noopener noreferrer'|rel="noopener noreferrer"/);
 const start=js.indexOf('function renderWebsiteShowroom');
 const end=js.indexOf('\nfunction renderLeads',start);
 assert(start>0&&end>start);
 const section=js.slice(start,end);
 assert.doesNotMatch(section,/\bPOST\b|\.demoUrl|fetch\('/);
 assert.match(section,/websiteUrl/);
 assert.match(section,/canCall/);
});

test('owner website panel explains real HTML and hosting conversion limits without implying automatic WordPress conversion',()=>{
 const ui=read('public/sbc-website-production-v1.js');
 assert.equal(ui,read('browser_public/sbc-website-production-v1.js'));
 for(const term of ['HTML','CSS','JavaScript','cPanel','Websites + Marketing','WordPress','fulfillment'])assert(ui.includes(term),'Missing provider truth: '+term);
 assert.match(ui,/not an automatic import|requires rebuilding|requires conversion/i);
});

test('spotlight styles are mirrored, responsive, high contrast and do not hide original workspaces',()=>{
 const css=read('public/sbc-website-revenue-shortcuts-v1.css');
 assert.equal(css,read('browser_public/sbc-website-revenue-shortcuts-v1.css'));
 assert.match(css,/#sbc-website-production-nav/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/@media/);
 assert.match(css,/:focus-visible/);
 assert.doesNotMatch(css,/#app\s*\{\s*display:\s*none/);
 const caller=read('public/sales-caller.css');
 assert.equal(caller,read('browser_public/sales-caller.css'));
 assert.match(caller,/#sbcSalesWebsiteLibrary/);
});
