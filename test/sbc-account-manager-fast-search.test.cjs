'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

function harness(accounts,language='en'){
 const ui=read('public/sbc-account-manager-v1.js');
 const start=ui.indexOf('function renderAccountGrid(');
 const end=ui.indexOf('async function load(',start);
 assert(start>=0&&end>start,'account search must have a directly testable renderer');
 const nodes={sbcAccountSearch:{value:''},sbcAccountCount:{textContent:''},accountGrid:{innerHTML:''}};
 const state={accounts,lang:language};
 const scope={state,$:id=>nodes[id],String,Math,escapeHtml:value=>String(value??'')
   .replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))};
 vm.runInNewContext(ui.slice(start,end),scope,{filename:'sbc-manager-search-extracted.js'});
 return {render:scope.renderAccountGrid,nodes,state};
}

test('large assigned portfolios stay fast with a bounded set of visible account cards',()=>{
 const accounts=Array.from({length:180},(_,i)=>({
  id:'c'+i,businessName:'Business '+i,status:'Lead',phone:'305-555-'+String(i).padStart(4,'0')
 }));
 const h=harness(accounts);h.render();
 const cardCount=(h.nodes.accountGrid.innerHTML.match(/class="account-card"/g)||[]).length;
 assert(cardCount>0 && cardCount<=80,'keep a small, usable page rather than rendering 180 cards');
 assert.match(h.nodes.sbcAccountCount.textContent,/180/);
 assert.match(h.nodes.sbcAccountCount.textContent,/Search|search/);
});

test('typed business name, CRM ID or phone finds the authorized account beyond the first page',()=>{
 const accounts=Array.from({length:120},(_,i)=>({
  id:'crm-'+i,businessName:'Account '+i,phone:'305-555-'+String(i).padStart(4,'0')
 }));
 accounts[118]={id:'crm-118',businessName:'Miranda Maintenance & Repair',phone:'305-922-0061'};
 const h=harness(accounts);
 for(const value of ['miranda','CRM-118','922-0061']){
  h.nodes.sbcAccountSearch.value=value;h.render();
  assert.match(h.nodes.accountGrid.innerHTML,/Miranda Maintenance/);
  assert.doesNotMatch(h.nodes.accountGrid.innerHTML,/Account 1<\/h3>/);
  assert.match(h.nodes.sbcAccountCount.textContent,/1/);
 }
});

test('search shows useful empty states without confusing no-match with no assigned accounts',()=>{
 const h=harness([{id:'c1',businessName:'A Barber Shop'}],'es');
 h.nodes.sbcAccountSearch.value='wrong';h.render();
 assert.match(h.nodes.accountGrid.innerHTML,/No se encontraron|Sin resultados/);
 assert.match(h.nodes.sbcAccountCount.textContent,/0/);
 const no=harness([]);no.render();
 assert.match(no.nodes.accountGrid.innerHTML,/No accounts have been assigned/);
});

test('search rendering escapes CRM strings and uses current authenticated accounts only',()=>{
 const h=harness([{id:'c1',businessName:'<script>evil()</script>',phone:'<img src=x>'}]);
 h.render();
 assert.doesNotMatch(h.nodes.accountGrid.innerHTML,/<script>/);
 assert.doesNotMatch(h.nodes.accountGrid.innerHTML,/<img/);
 assert.match(h.nodes.accountGrid.innerHTML,/&lt;script&gt;/);
 const js=read('public/sbc-account-manager-v1.js');
 assert.equal(js,read('browser_public/sbc-account-manager-v1.js'));
 assert(!/localStorage|sessionStorage/.test(js),'never persist CRM account details in browser storage');
 assert.match(js,/state\.accounts=\[\];state\.selected=null/,'clear formerly displayed accounts on authentication/data failure');
});

test('find-account field is keyboard accessible and bilingual',()=>{
 const html=read('public/sbc-account-manager-v1.html');
 assert.equal(html,read('browser_public/sbc-account-manager-v1.html'));
 assert.match(html,/id="sbcAccountSearch"/);
 assert.match(html,/type="search"/);
 assert.match(html,/id="sbcAccountCount"/);
 assert.match(html,/aria-controls="accountGrid"/);
 assert.match(html,/data-t="accountSearch"/);
 const js=read('public/sbc-account-manager-v1.js');
 assert.match(js,/accountSearch:'Buscar cuenta/i);
 assert.match(js,/\$\('sbcAccountSearch'\)\.addEventListener\('input',renderAccountGrid\)/);
 const css=read('public/sbc-account-manager-v1.css');
 assert.match(css,/#sbcAccountSearch:focus-visible/);
 assert.equal(css,read('browser_public/sbc-account-manager-v1.css'));
});
