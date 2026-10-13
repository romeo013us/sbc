'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const patch=require('./apply-v6534-price-consistency');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6534-price-test-'));
function put(rel,s){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
try{
  put('index.php','<a>See the $99 / $199 / $349 / $599 Packages</a><div class="price">$599 <small>setup</small></div><a class="btn btn-orange price-btn" href="https://square.link/u/hNjjflul" target="_blank" rel="noopener">Launch for $599</a>');
  put('server.js',"const CATALOG=[{id:'completeLaunch',price:699,paymentUrl:PAYMENT_LINKS.essentials}];const V25_BUNDLES={completeLaunch:{price:699,paymentUrl:PAYMENT_LINKS.essentials}};packages:{entry:99,starter:199,essentials:349,professional:599}");
  put('enterprise/sbc-revenue-closer-v5611.js',"FULL_LAUNCH: { sku: 'SBC-599-COMPLETE', price: 599, name: 'SBC Complete Business Package' }");
  put('enterprise/sbc-revenue-growth-v56122.js',"{sku:'SBC-599-COMPLETE',price:599,fit:['needsWebsite','needsCards','highUrgency']}");
  put('enterprise/sbc-elite-closer-v5612.js',"SBC_599: {sku:'SBC-599-COMPLETE',price:599,name:'SBC Complete Business Package'};return OFFERS.SBC_599;");
  put('enterprise/automatic-lead-sale-execution.js',"l.dealValue>=599?'Professional Business';'Professional Business':599,'Business Growth':899,'SBC Complete Business Package':599");
  put('enterprise/sbc-commercial-os-v602.js',"{id:'professional',name:'Professional Business',monthly:99,setup:599,description:'Full managed business operating package.'}");
  put('enterprise/v56220-economic-control.js','const prices={entry:99,starter:199,essentials:349,professional:599};');
  put('enterprise/v56140-90day-revenue-command.js',"find(['sbc-599-complete','complete business']);Number(plan.assumedAverageSale||599);Number(plan.assumedAverageSale||599);assumedAverageSale:money(plan.assumedAverageSale||599)");
  put('browser_public/v56140-90day-revenue-command.js','Number(sm.assumedAverageSale||599);The $599 assumption is a planning benchmark.');
  put('public/v56140-90day-revenue-command.js','Number(sm.assumedAverageSale||599);The $599 assumption is a planning benchmark.');
  put('enterprise/v56170-six-phase-autopilot.js',"return {id:'professional',name:'Professional Business',price:599};");
  put('enterprise/v56-autonomous-operations.js','Number(c.dealValue||599)');
  put('enterprise/training-system-v2.js',"title:'The Three Packages';prompt:'The Three Packages';objectiveTitle:'The Three Packages';knowledgeTitle:'The Three Packages';description:'Understand the current $99, $199, $349 and $599 package structure.';objective:'current $99, $199, $349 and $599 package structure';learn:'current $99, $199, $349 and $599 package structure';title:'Package Mastery \\u2014 $99 / $199 / $349 / $599 + Office Box';prompt:'Package Mastery \\u2014 $99 / $199 / $349 / $599 + Office Box';objectiveTitle:'Package Mastery \\u2014 $99 / $199 / $349 / $599 + Office Box';knowledgeTitle:'Package Mastery \\u2014 $99 / $199 / $349 / $599 + Office Box'");
  put('enterprise/v56210-commercial-readiness.js',"const PACKAGES=Object.freeze({professional:{id:'professional',name:'Professional Business',price:599,billing:'monthly'}});");
  put('public/index.html','<title>SBC Business Command Center — V65.1.33</title>');
  put('public/sw.js',"const CACHE='sbc-static-v65-1-33';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.33',description:'old',scripts:{'test:all':'node bootstrap.js --verify'}}));
  put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.33',packages:{'':{version:'65.1.33'}}}));
  put('config/release-identity.js',"const RELEASE_VERSION = '65.1.33';\nconst RELEASE_NAME = 'PUBLISHED_AUTH_STABILITY';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:32});");
  const r=patch.apply(root);assert.equal(r.version,'65.1.34');
  assert.match(get('index.php'),/\$699/);assert.match(get('index.php'),/tel:305-496-1065/);assert.doesNotMatch(get('index.php'),/square\.link\/u\/hNjjflul|Launch for \$599/);
  assert.match(get('server.js'),/professional:599,completeLaunch:699/);assert.equal((get('server.js').match(/paymentUrl:''/g)||[]).length,2);
  for(const f of ['enterprise/sbc-revenue-closer-v5611.js','enterprise/sbc-revenue-growth-v56122.js','enterprise/sbc-elite-closer-v5612.js']) assert.doesNotMatch(get(f),/SBC-599-COMPLETE|price: ?599|SBC_599/);
  assert.match(get('enterprise/automatic-lead-sale-execution.js'),/SBC Complete Business Launch':699/);assert.match(get('enterprise/automatic-lead-sale-execution.js'),/Business Growth':999/);
  assert.match(get('enterprise/sbc-commercial-os-v602.js'),/setup:699/);assert.match(get('enterprise/v56220-economic-control.js'),/professional:599,completeLaunch:699/);
  assert.match(get('enterprise/v56140-90day-revenue-command.js'),/sbc-699-complete/);assert.doesNotMatch(get('enterprise/v56140-90day-revenue-command.js'),/assumedAverageSale\|\|599/);
  assert.match(get('public/index.html'),/V65\.1\.34/);assert.match(get('public/sw.js'),/sbc-static-v65-1-34/);
  assert.equal(JSON.parse(get('package.json')).version,'65.1.34');assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.34');
  assert.ok(get('enterprise/v56210-commercial-readiness.js').includes('not the one-time $699'),'recurring Professional tier is documented separately from the one-time launch package');
  assert.doesNotMatch(get('enterprise/training-system-v2.js'),/The Three Packages|\$599/);assert.match(get('enterprise/training-system-v2.js'),/The Four Packages/);
  console.log('[SBC V65.1.34] package price mappings, stale checkout guard, release identity and cache regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
