'use strict';
// SBC website package price and verified Square URL contract, effective for NEW offers only.
// Historical quotes, paid orders, subscriptions, and accepted product entitlements are snapshots.
const VERSION='SBC_WEB_PACKAGES_2026_11_15';
const offers={
 visibility:{id:'quickstart',sku:'SBC-VISIBILITY-99',name:'Business Visibility',priceCents:9900,paymentUrl:'https://square.link/u/h7pS4Z9i',kind:'one_time',scope:'Visibility package; no website'},
 starter:{id:'starter',sku:'SBC-STARTER-199',name:'SBC Business Starter — Website Setup',priceCents:19900,paymentUrl:'https://square.link/u/xD1tRvlT',kind:'one_time',scope:'Mobile-friendly one-page site; initial year domain and website service as agreed; optional care separate'},
 basic:{id:'basic',sku:'SBC-BASIC-499',name:'SBC Business Basic — 4-Page Website',priceCents:49900,paymentUrl:'https://square.link/u/2mkZwvXa',kind:'one_time',scope:'Home, Services, About, Contact; responsive design and basic on-page SEO'},
 essentials:{id:'essentials',sku:'SBC-ESSENTIALS-799',name:'SBC Business Essentials',priceCents:79900,paymentUrl:'https://square.link/u/atJchS8R',kind:'one_time',scope:'Four-page website; business email setup; 500 printed business cards; SEO foundation'},
 complete:{id:'professional',sku:'SBC-COMPLETE-999',name:'SBC Complete Business Launch',priceCents:99900,paymentUrl:'https://square.link/u/YdzUoWl3',kind:'one_time',scope:'Multi-page website; business email setup; 500 printed cards; GBP setup assistance; SEO foundation; initial Office Box onboarding'}
};
const PUBLIC_OFFERS=Object.freeze(Object.entries(offers).map(([key,offer])=>Object.freeze({key,...offer})));
const BY_KEY=Object.freeze(Object.fromEntries(PUBLIC_OFFERS.map(x=>[x.key,x])));
const BY_ID=Object.freeze(Object.fromEntries(PUBLIC_OFFERS.map(x=>[x.id,x])));
const CARE=Object.freeze({
 websiteCare:Object.freeze({id:'websiteCare',priceCents:7900,period:'month',includedMinorUpdateMinutes:30,newCheckoutUrl:null,existingSubscription:true}),
 googleCare:Object.freeze({id:'googleCare',priceCents:7900,period:'month',existingSubscription:true}),
 combinedCare:Object.freeze({id:'combinedCare',priceCents:13900,period:'month',existingSubscription:true})
});
const KNOWN_RETIRED_LINKS=Object.freeze(['https://square.link/u/lKxGXNQs','https://square.link/u/uf53mzCR','https://square.link/u/c8wuNr1c']);
function offer(id){return BY_KEY[id]||BY_ID[id]||null}
function checkoutForNewOffer(id,{priceCents,quantity=1}={}){
 const found=offer(id);
 if(!found)return {allowed:false,code:'PACKAGE_NOT_APPROVED'};
 if(found.key==='visibility')return {allowed:false,code:'VISIBILITY_LINK_UNVERIFIED_NEW_RELEASE'};
 if(priceCents!==undefined&&priceCents!==found.priceCents)return {allowed:false,code:'PACKAGE_PRICE_MISMATCH'};
 if(quantity!==1)return {allowed:false,code:'PACKAGE_QUANTITY_REQUIRES_REVIEW'};
 if(!/^https:\/\/square\.link\/u\/[A-Za-z0-9]{8}$/.test(found.paymentUrl))return {allowed:false,code:'INVALID_SQUARE_LINK'};
 return {allowed:true,id:found.id,sku:found.sku,priceCents:found.priceCents,paymentUrl:found.paymentUrl,version:VERSION};
}
function snapshotExistingOrder(order){
 // No catalog lookup and no price rewrite. Never use this method to process a new payment.
 if(!order||typeof order!=='object'||Array.isArray(order))throw Error('ORDER_REQUIRED');
 return structuredClone(order);
}
function sameCheckout(item,{strict=true}={}){
 if(!item||typeof item!=='object')return false;
 const found=offer(item.id||item.key);
 if(!found||found.key==='visibility')return false;
 return Number(item.price)*100===found.priceCents&&item.paymentUrl===found.paymentUrl &&
 (!strict||item.name===found.name);
}
function inspectPublicListing(html){
 const text=String(html||'');
 return {
  hasNewPrices:['$199','$499','$799','$999'].every(x=>text.includes(x)),
  hasLinks:['xD1tRvlT','2mkZwvXa','atJchS8R','YdzUoWl3'].every(x=>text.includes(x)),
  hasStaleCheckout:KNOWN_RETIRED_LINKS.some(x=>text.includes(x)),
  hasOldAdvertisedPackages:/\$349\b|\$699\b/.test(text)
 };
}
module.exports=Object.freeze({VERSION,PUBLIC_OFFERS,BY_KEY,BY_ID,CARE,KNOWN_RETIRED_LINKS,offer,checkoutForNewOffer,snapshotExistingOrder,sameCheckout,inspectPublicListing});
