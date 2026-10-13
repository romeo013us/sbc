'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6534_PRICE_CONSISTENCY';
const VERSION='65.1.34';
function replaceExact(s,oldText,newText,label,expected=1){
  const count=s.split(oldText).length-1;
  if(count!==expected) throw new Error(MARKER+': '+label+' expected '+expected+' occurrence(s), found '+count);
  return s.split(oldText).join(newText);
}
function edit(root,rel,fn){
  const p=path.join(root,rel);
  if(!fs.existsSync(p)) throw new Error(MARKER+': required file missing: '+rel);
  let s=fs.readFileSync(p,'utf8');
  if(s.includes(MARKER)) return s;
  s=fn(s);
  fs.writeFileSync(p,s);
  return s;
}
function apply(root){
  edit(root,'index.php',s=>{
    s=replaceExact(s,'See the $99 / $199 / $349 / $599 Packages','See the $99 / $199 / $349 / $699 Packages','storefront package navigation');
    s=replaceExact(s,'<div class="price">$599 <small>setup</small></div>','<div class="price">$699 <small>setup</small></div>','storefront package price');
    s=replaceExact(s,'<a class="btn btn-orange price-btn" href="https://square.link/u/hNjjflul" target="_blank" rel="noopener">Launch for $599</a>','<a class="btn btn-orange price-btn" href="tel:305-496-1065" rel="nofollow">Call SBC to order for $699</a>','unverified legacy checkout link');
    return s;
  });
  edit(root,'server.js',s=>{
    s=replaceExact(s,'packages:{entry:99,starter:199,essentials:349,professional:599}','packages:{entry:99,starter:199,essentials:349,professional:599,completeLaunch:699}','revenue-proof package status');
    s=replaceExact(s,'paymentUrl:PAYMENT_LINKS.essentials',"paymentUrl:''",'stale static checkout attached to Complete package',2);
    return s;
  });
  edit(root,'enterprise/sbc-revenue-closer-v5611.js',s=>replaceExact(s,"FULL_LAUNCH: { sku: 'SBC-599-COMPLETE', price: 599, name: 'SBC Complete Business Package' }","FULL_LAUNCH: { sku: 'SBC-699-COMPLETE', price: 699, name: 'SBC Complete Business Launch' }",'revenue closer offer'));
  edit(root,'enterprise/sbc-revenue-growth-v56122.js',s=>replaceExact(s,"{sku:'SBC-599-COMPLETE',price:599,fit:['needsWebsite','needsCards','highUrgency']}","{sku:'SBC-699-COMPLETE',price:699,fit:['needsWebsite','needsCards','highUrgency']}",'revenue growth offer'));
  edit(root,'enterprise/sbc-elite-closer-v5612.js',s=>{
    s=replaceExact(s,"SBC_599: {sku:'SBC-599-COMPLETE',price:599,name:'SBC Complete Business Package'}","SBC_699: {sku:'SBC-699-COMPLETE',price:699,name:'SBC Complete Business Launch'}",'elite closer offer');
    return replaceExact(s,'return OFFERS.SBC_599;','return OFFERS.SBC_699;','elite closer reference');
  });
  edit(root,'enterprise/automatic-lead-sale-execution.js',s=>{
    s=replaceExact(s,"l.dealValue>=599?'Professional Business'","l.dealValue>=699?'SBC Complete Business Launch'",'lead-sale package threshold');
    return replaceExact(s,"'Professional Business':599,'Business Growth':899,'SBC Complete Business Package':599","'Professional Business':599,'SBC Complete Business Launch':699,'Business Growth':999",'lead-sale catalog prices');
  });
  edit(root,'enterprise/sbc-commercial-os-v602.js',s=>replaceExact(s,"{id:'professional',name:'Professional Business',monthly:99,setup:599,description:'Full managed business operating package.'","{id:'professional',name:'Professional Business',monthly:99,setup:699,description:'Full managed business operating package.'",'commercial OS setup fee'));
  edit(root,'enterprise/v56220-economic-control.js',s=>replaceExact(s,'const prices={entry:99,starter:199,essentials:349,professional:599};','const prices={entry:99,starter:199,essentials:349,professional:599,completeLaunch:699};','economic control catalog'));
  edit(root,'enterprise/v56140-90day-revenue-command.js',s=>{
    s=replaceExact(s,"find(['sbc-599-complete','complete business'])","find(['sbc-699-complete','sbc complete business launch','complete business'])",'Complete SKU lookup');
    s=replaceExact(s,'Number(plan.assumedAverageSale||599)','Number(plan.assumedAverageSale||699)','revenue planning close-count defaults',2);
    return replaceExact(s,'assumedAverageSale:money(plan.assumedAverageSale||599)','assumedAverageSale:money(plan.assumedAverageSale||699)','revenue planning default');
  });
  for(const rel of ['browser_public/v56140-90day-revenue-command.js','public/v56140-90day-revenue-command.js']){
    edit(root,rel,s=>{
      s=replaceExact(s,'Number(sm.assumedAverageSale||599)','Number(sm.assumedAverageSale||699)','browser planning default');
      return replaceExact(s,'The $599 assumption is a planning benchmark.','The $699 assumption is a planning benchmark.','browser planning copy');
    });
  }
  edit(root,'enterprise/v56170-six-phase-autopilot.js',s=>replaceExact(s,"return {id:'professional',name:'Professional Business',price:599};","return {id:'completeLaunch',name:'SBC Complete Business Launch',price:699};",'autopilot package mapping'));
  edit(root,'enterprise/v56-autonomous-operations.js',s=>replaceExact(s,'Number(c.dealValue||599)','Number(c.dealValue||0)','remove fabricated fallback deal value'));
  edit(root,'enterprise/training-system-v2.js',s=>{
    s=replaceExact(s,'The Three Packages','The Four Packages','current training module title and references',4);
    s=replaceExact(s,'current $99, $199, $349 and $599 package structure','current $99, $199, $349 and $699 package structure','current pricing training copy',3);
    return replaceExact(s,'Package Mastery \\u2014 $99 / $199 / $349 / $599 + Office Box','Package Mastery \\u2014 $99 / $199 / $349 / $699 + Office Box','current package mastery training references',4);
  });
  edit(root,'enterprise/v56210-commercial-readiness.js',s=>{
    if(s.includes(MARKER)) return s;
    if(!s.includes('const PACKAGES=Object.freeze({')) throw new Error(MARKER+': recurring package catalog anchor missing');
    return s.replace('const PACKAGES=Object.freeze({',"// "+MARKER+": this Professional tier is recurring MRR (billing:'monthly'), not the one-time $699 launch package.\nconst PACKAGES=Object.freeze({");
  });
  edit(root,'public/index.html',s=>replaceExact(s,'<title>SBC Business Command Center — V65.1.33</title>','<title>SBC Business Command Center — V65.1.34</title>','browser release title'));
  edit(root,'public/sw.js',s=>{
    s=replaceExact(s,"const CACHE='sbc-static-v65-1-33';","const CACHE='sbc-static-v65-1-34';",'service worker cache namespace');
    if(!s.includes('keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)')) throw new Error(MARKER+': old cache purge guard missing');
    return s;
  });
  const pkgPath=path.join(root,'package.json');
  const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
  if(pkg.name!=='sbc-business-command-center'||pkg.version!=='65.1.33') throw new Error(MARKER+': expected source package 65.1.33; found '+pkg.version);
  pkg.version=VERSION;
  pkg.description='SBC OS V65.1.34 approved $699 Complete Launch pricing and checkout consistency guard';
  pkg.scripts=pkg.scripts||{};
  pkg.scripts['test:v6534-price-consistency']='node hotfix-assets/v6534-price-consistency-test.js';
  if(!String(pkg.scripts['test:all']||'').includes('v6534-price-consistency-test.js')) pkg.scripts['test:all']=(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6534-price-consistency-test.js';
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  const lockPath=path.join(root,'package-lock.json');
  if(!fs.existsSync(lockPath)) throw new Error(MARKER+': package-lock.json missing');
  const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
  if(lock.name!=='sbc-business-command-center'||lock.version!=='65.1.33') throw new Error(MARKER+': expected lockfile 65.1.33; found '+lock.version);
  lock.version=VERSION;
  if(lock.packages&&lock.packages['']){
    lock.packages[''].version=VERSION;
    lock.packages[''].description=pkg.description;
  }
  fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
  const identPath=path.join(root,'config','release-identity.js');
  if(!fs.existsSync(identPath)) throw new Error(MARKER+': release identity module missing');
  let ident=fs.readFileSync(identPath,'utf8');
  ident=replaceExact(ident,"const RELEASE_VERSION = '65.1.33';","const RELEASE_VERSION = '65.1.34';",'runtime release version');
  ident=replaceExact(ident,"const RELEASE_NAME = 'PUBLISHED_AUTH_STABILITY';","const RELEASE_NAME = 'PRICE_CONSISTENCY_AND_CHECKOUT_GUARD';",'runtime release name');
  ident=replaceExact(ident,'major:65,minor:1,patch:32','major:65,minor:1,patch:34','runtime semantic version');
  fs.writeFileSync(identPath,ident);
  const integrityPath=path.join(root,'enterprise','v4341-kim-resilience-control.js');
  if(fs.existsSync(integrityPath)){
    delete require.cache[require.resolve(integrityPath)];
    const integrity=require(integrityPath);
    if(typeof integrity.integrityManifest==='function') integrity.integrityManifest();
    if(typeof integrity.verifyIntegrity==='function'){
      const check=integrity.verifyIntegrity();
      if(!check.ok) throw new Error(MARKER+': runtime integrity manifest mismatch: '+JSON.stringify(check.mismatches||[]));
    }
  }
  return {marker:MARKER,version:VERSION,pricingMappingsFixed:true,legacyCheckoutDisabled:true};
}
module.exports={apply,MARKER,VERSION};
