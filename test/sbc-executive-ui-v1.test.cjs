'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const color=h=>h.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
const luminance=hex=>color(hex).reduce((s,x,i)=>s+x*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
test('Executive styles define readable light surfaces with WCAG AA body text and accessible focus',()=>{
 const css=read('public/sbc-executive-ui-v1.css');
 assert.equal(css,read('browser_public/sbc-executive-ui-v1.css'));
 assert.match(css,/SBC_EXECUTIVE_UI_V1/);
 assert(contrast('#ffffff','#17283a')>=7,'light cards need high contrast');
 assert(contrast('#f5f8fb','#43556a')>=4.5,'secondary labels need WCAG AA');
 assert(contrast('#101d30','#f2f7ff')>=7,'dark card contrast');
 assert.match(css,/body\[data-theme="light"\] #modal \.sbc-ops-surface/);
 assert.match(css,/body\[data-theme="dark"\] #modal \.sbc-ops-surface/);
 assert.match(css,/\.sbc-ops-surface \.sbc-ops-detail/);
 assert.match(css,/\.sbc-launch-surface \.detail-box/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\s*\(max-width:\s*760px\)/);
 assert.match(css,/prefers-reduced-motion/);
});
test('both browser entrypoints load styling last, and collapse legacy tools while preserving navigation',()=>{
 for(const name of ['public/index.html','browser_public/index.html']){
  const html=read(name);
  assert.match(html,/href="\/sbc-v66-owner-ui-core\.[a-f0-9]{16}\.css"/);
  const compiled=require('../scripts/v66-owner-ui-css-bundle.cjs').compile(root).content;
  const cssIndex=compiled.indexOf('/* sbc-executive-ui-v1.css */');
  assert(cssIndex>compiled.indexOf('/* sbc-global-contrast-rescue-20261106.css */'),'executive contrast should win cascade');
  assert.match(html,/<details[^>]+id="sbcAdvancedNav"/);
  assert.match(html,/<summary[^>]*>[^<]*Advanced tools/);
  assert.match(html,/class="v56-legacy-tools"/);
  assert.match(html,/data-view="customers"/);
  assert.match(html,/data-view="quotes"/);
  assert.match(html,/id="sbc-owner-import-link"/);
 }
});
test('dashboard shows core revenue actions first and puts QA/advanced actions in an accessible expandable group',()=>{
 const js=read('public/app.js');
 const dash=js.slice(js.indexOf('function dashboard()'),js.indexOf('function customers()'));
 assert.match(dash,/class="hero-actions sbc-exec-actions"/);
 assert.match(dash,/class="sbc-exec-primary"/);
 assert.match(dash,/<details class="sbc-exec-more"/);
 assert.match(dash,/More actions/);
 assert.match(dash,/Create Quote/);
 assert.match(dash,/sbcOpenOwnerCheckoutLab\(\)/);
 assert.match(dash,/sbcOpenOwnerAcceptanceDesk\(\)/);
 assert.match(dash,/sbcOpenHrDepartment\(\)/);
 assert.match(dash,/sbc-dashboard-more/);
 assert.equal((dash.match(/onclick="newCustomer\(\)"/g)||[]).length,1);
 assert.equal((dash.match(/onclick="newQuote\(\)"/g)||[]).length,1);
 assert.equal((dash.match(/onclick="newOrder\(\)"/g)||[]).length,1);
});
test('Launch Check and Website Production panels have explicit contrast surfaces without changing API calls',()=>{
 const launch=read('public/sbc-launch-readiness-v6621.js');
 assert.equal(launch,read('browser_public/sbc-launch-readiness-v6621.js'));
 assert.match(launch,/sbc-launch-surface/);
 assert.match(launch,/sbc-launch-intro/);
 for(const name of ['sbc-website-call-desk-v1.js','sbc-website-sales-board-v1.js']){
  const ui=read('public/'+name);
  assert.equal(ui,read('browser_public/'+name));
  assert.match(ui,/class="sbc-ops-surface/);
 }
 assert.match(read('public/sbc-website-call-desk-v1.js'),/AI voice outbound:.*disabled/);
 assert.match(read('public/sbc-website-sales-board-v1.js'),/capturedWebsiteRevenueCents/);
});

test('whole OS theme guard covers ordinary workspaces, forms, tables, hero, modal and sidebar',()=>{
 const css=read('public/sbc-executive-ui-v1.css');
 const selectors=[
  '#app .content :is(.card:not(.hero),.stat,.list-card,.detail-box,.table-wrap',
  'body[data-theme="dark"] #app .content',
  'body[data-theme="light"] #app .content',
  '#app .sidebar nav',
  '#app .top-actions',
  '#modal .modal-card',
  '#modal #modalBody',
  ':is(input,select,textarea,option)',
  ':is(.table,table) th',
  ':is(.table,table) td',
  '#app .content > .hero',
  'background:#f7fafb',
  'background:#f6fbfa',
  'background:#f6f8fb',
  '.sbc-exec-secondary',
  '.sbc-advanced-nav',
  'prefers-reduced-motion'
 ];
 for(const s of selectors)assert(css.includes(s),'Missing OS-wide visual contract: '+s);
 assert(contrast('#f7fafb','#17283a')>=7,'Previously unreadable pale cards require high contrast');
 assert(contrast('#172c41','#f2f7ff')>=7,'Advanced navigation must have clear keyboard-visible labels');
 assert(!css.includes('display:none!important}.content'),'Must not hide general workspace content to solve clutter');
 assert.match(css,/body\[data-theme="dark"\] #modal \.sbc-ops-surface/);
});
test('global visual repair does not remove critical purchasing, audit, CRM and sales controls',()=>{
 const html=read('public/index.html');
 const js=read('public/app.js');
 for(const action of [
  'sbcOpenOwnerDollarQA()', 'sbcOpenQuickCheckout()', 'sbcOpenOwnerCheckoutLab()',
  'sbcOpenOwnerAcceptanceDesk()', 'sbcOpenHrDepartment()', 'newCustomer()',
  'newQuote()', 'newOrder()'
 ])assert(js.includes(action),'Important existing action removed: '+action);
 for(const surface of ['data-view="crm"','data-view="orders"','data-view="marketing"',
  'data-view="workforce"','data-view="customers"','data-view="quotes"',
  'data-view="notifications"','data-view="settings"'
 ])assert(html.includes(surface),'Expected workspace navigation missing: '+surface);
 assert.match(html,/sbc-website-call-desk-v1\.js/);
 assert.match(html,/sbc-website-sales-board-v1\.js/);
 assert.match(html,/sbc-launch-readiness-topbar/);
});
