'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizeWebsite,parseReport,register}=require('../enterprise/sbc-prospect-intelligence.cjs');
const {prioritize,buildOutreach,buildStrategy,expansionIdeas}=require('../public/sbc-prospect-intelligence.js');
const fixture={
 lighthouseResult:{
  categories:{performance:{score:.72},accessibility:{score:.90},seo:{score:.83},'best-practices':{score:.94}},
  audits:{'document-title':{score:1,title:'Document has a title'},'meta-description':{score:0,title:'Document does not have a meta description'},
    'viewport':{score:1,title:'Has a viewport meta tag'},'color-contrast':{score:.3,title:'Background and foreground colors do not have a sufficient contrast ratio'}}
 }
};
test('website normalization rejects private and credentialed targets and removes paths and tracking',()=>{
 assert.equal(normalizeWebsite('https://example.com/path?key=private#secret'),'https://example.com/');
 for(const site of ['http://example.com','https://127.0.0.1','https://localhost/','https://example.com:444/','https://u:p@example.com/','https://internal.local/','file:///etc/passwd','https://10.0.0.1','https://foo.com@127.0.0.1/'])
  assert.throws(()=>normalizeWebsite(site),{message:'PUBLIC_HTTPS_SITE_REQUIRED'},site);
});
test('Lighthouse report reflects measured scores and transparent missing checks',()=>{
 const a=parseReport(fixture,'https://example.com/',Date.parse('2026-11-16T12:00Z'));
 assert.equal(a.status,'measured');assert.deepEqual(a.scores,{performance:72,accessibility:90,seo:83,bestPractices:94});
 assert(a.findings.some(x=>x.id==='meta-description'&&x.result==='opportunity'));
 assert(a.findings.every(x=>['pass','opportunity','unverified'].includes(x.result)));
 assert.equal(a.website,'https://example.com/');
 assert.equal(a.source,'Google PageSpeed Insights (Lighthouse lab)');
});
test('lead scoring is fit-priority not a probability and avoids personal demographics',()=>{
 const a=prioritize({businessName:'Test Business',website:'https://example.com',industry:'barber shop',status:'Lead',verificationStatus:'Verified'},parseReport(fixture,'https://example.com/',Date.now()));
 assert.equal(a.kind,'research_priority_not_conversion_probability');
 assert(a.evidence.some(x=>x.includes('SEO')));
 assert(a.score>=0&&a.score<=100);
 assert.doesNotMatch(JSON.stringify(a),/race|gender|religion/i);
 const absent=prioritize({businessName:'Undocumented business'},{status:'unavailable'});
 assert.notEqual(absent.label,'Verified high opportunity');
 assert(absent.missingEvidence.length>0);
});
test('outreach and customer strategy never fabricate audits, competitors or auto-send',()=>{
 const noAudit=buildOutreach({businessName:'Fixture Shop',industry:'retail'},null,[]);
 assert.doesNotMatch(noAudit,/we found|your site is slow|poor seo|behind competitors/i);
 assert.match(noAudit,/review|could|if you/i);
 const a=parseReport(fixture,'https://example.com/',Date.now());
 const message=buildOutreach({businessName:'Fixture Shop',industry:'retail'},a,[]);
 assert.match(message,/meta description/i);assert.doesNotMatch(message,/100%|guarantee|first place/i);
 const report=buildStrategy({businessName:'Fixture Shop',industry:'retail'},a,[],[]);
 assert.match(report,/Source: Google PageSpeed Insights/);
 assert.match(report,/Not verified/);
 const ideas=expansionIdeas({businessName:'Fixture Shop',customer:true},a);
 assert(ideas.every(x=>/confirm|review|offer|verify|discuss|ask/i.test(x.toLowerCase())));
});
function harness({fetcher,clock=()=>Date.parse('2026-11-16T12:00Z')}={}){
 const handlers={};const app={get:(path,...fn)=>handlers[path]=fn};
 register(app,{auth:(req,res,next)=>req.user?next():res.status(401).json({ok:false}),
  ownerOnly:(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({ok:false}),
  requireTenant:req=>{if(!req.user.tenantId)throw Error('TENANT_CONTEXT_REQUIRED');return req.user.tenantId},
  fetcher,clock});
 async function req({query={website:'https://example.com'},user={role:'owner',id:'owner',tenantId:7}}={}){
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(o){this.body=o;return this}};
  const request={query,user};
  for(let i=0;i<handlers['/api/owner/prospect-intelligence/audit'].length;i++){
   let next=false;await handlers['/api/owner/prospect-intelligence/audit'][i](request,res,()=>{next=true});
   if(!next&&i<handlers['/api/owner/prospect-intelligence/audit'].length-1)break;
  }
  return res;
 }return {req};
}
test('owner gated public audit only calls fixed Google endpoint with no customer data',async()=>{
 const calls=[],h=harness({fetcher:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>fixture}}});
 assert.equal((await h.req({user:null})).statusCode,401);
 assert.equal((await h.req({user:{role:'researcher',id:'lorna',tenantId:7}})).statusCode,403);
 assert.equal((await h.req({user:{role:'owner',id:'owner',tenantId:0}})).statusCode,403);
 assert.equal((await h.req({query:{website:'http://localhost:3000'}})).statusCode,422);
 const passed=await h.req();assert.equal(passed.body.status,'measured');
 assert.equal(passed.headers['Cache-Control'],'no-store');
 assert.equal(calls.length,1);
 assert(calls[0].url.startsWith('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?'));
 assert(calls[0].url.includes('url=https%3A%2F%2Fexample.com%2F'));
 assert(!calls[0].url.includes('owner'));
 assert.equal(calls[0].opts.redirect,'error');
});
test('external outage is explicitly unavailable, never filled with fabricated zero scores',async()=>{
 const h=harness({fetcher:async()=>({ok:false,status:429})});const out=await h.req();
 assert.equal(out.body.status,'unavailable');assert.equal(out.body.scores,null);
 assert.equal(out.body.reason,'UPSTREAM_RATE_LIMITED');
});
test('privacy and integration: market intelligence is the only new owner route entrypoint',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../enterprise/sbc-market-intelligence.cjs'),'utf8');
 assert.match(route,/ProspectIntelligence\.register\(app/);
 const ui=fs.readFileSync(path.join(__dirname,'../public/sbc-market-intelligence.js'),'utf8');
 assert.match(ui,/sbc-prospect-intelligence\.js/);
 for(const file of ['sbc-prospect-intelligence.js','sbc-prospect-intelligence.css']){
  assert.equal(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),fs.readFileSync(path.join(__dirname,'../browser_public',file),'utf8'));
 }
});
