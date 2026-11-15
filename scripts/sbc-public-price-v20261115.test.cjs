'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../enterprise/sbc-public-package-pricing-v20261115.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('owner approved one-time offers match externally verified Square checkout pages',()=>{
 assert.deepEqual(P.PUBLIC_OFFERS.map(x=>[x.key,x.priceCents]),[['visibility',9900],['starter',19900],['basic',49900],['essentials',79900],['complete',99900]]);
 for(const id of ['starter','basic','essentials','complete']){
  const x=P.checkoutForNewOffer(id);
  assert(x.allowed&&x.paymentUrl===P.offer(id).paymentUrl);
  assert.equal(P.checkoutForNewOffer(id,{priceCents:x.priceCents-100}).code,'PACKAGE_PRICE_MISMATCH');
 }
 assert.equal(P.checkoutForNewOffer('starter',{quantity:2}).allowed,false);
 assert.equal(P.checkoutForNewOffer('unknown').allowed,false);
});
test('historical orders remain snapshots; existing $79 care remains independently billed',()=>{
 const old={id:'old-349',price:349,items:[{id:'essentials',price:349}],status:'Paid',customerId:'old'};
 assert.deepEqual(P.snapshotExistingOrder(old),old);
 assert.notEqual(P.snapshotExistingOrder(old),old);
 assert.equal(P.CARE.websiteCare.priceCents,7900);
 assert.equal(P.CARE.websiteCare.period,'month');
});
test('Command Center catalog and V25 bundles use new checkout references',()=>{
 const s=read('server.js');
 assert(s.includes("require('./enterprise/sbc-public-package-pricing-v20261115.cjs')"));
 for(const [id,price] of [['basic',499],['essentials',799],['professional',999]]){
  assert(new RegExp("id:'"+id+"'[^\\n]{0,900}price:"+price).test(s),'catalog '+id);
 }
 for(const id of ['starter','basic','essentials','complete'])assert(s.includes("SBC_PRICE.offer('"+id+"')")||s.includes('SBC_PRICE.BY_KEY.'+id),'referenced '+id);
 assert(s.includes("paymentUrl:PAYMENT_LINKS.professional"),'Complete launch must have verified URL');
});
test('website advertises all five distinct packages and matching four verified Square URLs',()=>{
 const html=read('index.php'),check=P.inspectPublicListing(html);
 assert.equal(check.hasNewPrices,true);
 assert.equal(check.hasLinks,true);
 assert.equal(check.hasStaleCheckout,false,'new package grid must not contain retired checkout');
 assert.equal(check.hasOldAdvertisedPackages,false,'old $349/$699 package advertisements must go');
 for(const name of ['Business Visibility','SBC Business Starter','SBC Business Basic','Business Essentials','SBC Complete Business Launch'])assert(html.includes(name),name);
});
test('website production and owner sales script do not quote obsolete $349 four-page website',()=>{
 for(const asset of ['public/sbc-website-production-v1.js','public/sbc-website-sales-script-v1.js']){
  const text=read(asset);assert(!text.includes('Business Basic · $349'));assert(!text.includes('$349 Business Basic'));assert(!text.includes('Business Basic is $349'));assert(text.includes('$499'),asset);
  assert.equal(text,read(asset.replace('public/','browser_public/')),'static mirror '+asset);
 }
});
test('no new Square link may be reused for an incompatible price or name',()=>{
 assert(P.sameCheckout({id:'basic',name:'SBC Business Basic — 4-Page Website',price:499,paymentUrl:'https://square.link/u/2mkZwvXa'}));
 assert(!P.sameCheckout({id:'basic',name:'Business Essentials',price:499,paymentUrl:'https://square.link/u/2mkZwvXa'}));
 assert(!P.sameCheckout({id:'basic',name:'SBC Business Basic — 4-Page Website',price:349,paymentUrl:'https://square.link/u/2mkZwvXa'}));
 assert(!P.sameCheckout({id:'basic',name:'SBC Business Basic — 4-Page Website',price:499,paymentUrl:'https://square.link/u/uf53mzCR'}));
});
