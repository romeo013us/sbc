'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66145-stage-owner-acceptance-ui.cjs');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),
 mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(src,mirror,'owner dashboard parity');
const app=S.patchApp(src);
assert(app.includes(S.MARK));assert.equal(S.patchApp(app),app,'idempotent UI stage');
assert(app.includes('sbcOpenOwnerAcceptanceDesk()'));
assert(app.includes('/api/owner/crm/forensics'));
assert(app.includes('/api/owner/delivery/acceptance/'));
new vm.Script(app,{filename:'app-staged.js'});
if(process.argv.includes('--staged'))assert.equal(src,app,'compiled source must carry acceptance desk');

const first=app.indexOf('/* SBC_V66145_OWNER_ACCEPTANCE_DESK_UI'),end=app.indexOf('function badge(s)',first);
assert(first>0&&end>first,'exact UI block must exist');
const output={isConnected:true,innerHTML:'',textContent:''};
const crm={value:'customer & <script>alert(1)</script>'},order={value:'ord_customer_real_001'};
const urls=[];let modalTitle='',modalHtml='';
const fixture={
 document:{getElementById(id){return ({
  sbcAcceptCrmResult:output,sbcAcceptSearch:crm,
  sbcAcceptOrderResult:output,sbcAcceptOrder:order
 })[id]||null}},
 state:{me:{role:'owner'}},toast(){throw Error('Owner should not be blocked')},
 openModal(title,html){modalTitle=title;modalHtml=html},
 esc:s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),
 api:async(url,opts)=>{
  urls.push({url,opts});
  if(url.includes('/api/owner/crm/forensics'))return {
   totalTenantCustomers:3,suspiciousTextRecords:1,orphanOrderCount:2,
   pagination:{totalMatches:1,hasMore:false},
   rows:[{id:'c1',businessName:'<img src=x onerror=alert(1)>',status:'Archived',
    createdAt:'2026-09-16',source:'Walk-in',linkedOrderCount:1}]};
  if(url.includes('/api/owner/delivery/acceptance/'))return {
   orderLabel:'Website <h1>bad</h1>',checks:[{id:'mysql',detail:'MySQL readback',passed:true},
   {id:'subscription',detail:'Unverified',passed:false}],recordedWorkflowComplete:false};
  throw Error('Unexpected endpoint');
 }
};
vm.runInNewContext(app.slice(first,end),fixture,{filename:'acceptance-ui.js'});
assert.equal(typeof fixture.sbcOpenOwnerAcceptanceDesk,'function');
assert.equal(typeof fixture.sbcAcceptCrmLookup,'function');
assert.equal(typeof fixture.sbcAcceptOrderLookup,'function');
fixture.sbcOpenOwnerAcceptanceDesk();
assert(modalTitle.includes('Acceptance Desk'));
assert(modalHtml.includes('sbcAcceptCrmLookup'));
assert(!modalHtml.includes('<script>'));
(async()=>{
 await fixture.sbcAcceptCrmLookup();
 assert.equal(urls.length,1);
 assert.match(urls[0].url,/^\/api\/owner\/crm\/forensics\?q=/);
 assert(urls[0].url.includes('%3Cscript%3E'),'user query must be encoded');
 assert(output.innerHTML.includes('&lt;img'),'stored CRM identity must be HTML-escaped');
 assert(!output.innerHTML.includes('<img'));
 await fixture.sbcAcceptOrderLookup();
 assert.equal(urls.length,2);assert.match(urls[1].url,/^\/api\/owner\/delivery\/acceptance\//);
 assert(output.innerHTML.includes('&lt;h1&gt;bad'));
 assert(!output.innerHTML.includes('<h1>'));
 assert(urls.every(x=>!x.opts.method||x.opts.method==='GET'),'display only GET requests');
 console.log('PASS V66.145: owner dashboard, readonly APIs, XSS escaping, mirrored compiled UI');
})().catch(e=>{console.error(e);process.exitCode=1});
