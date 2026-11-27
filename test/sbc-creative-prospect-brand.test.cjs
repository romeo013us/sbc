'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeTargetUrl,isPublicIPv4,resolveTarget,auditProspectBrand,inspectDocument}=require('../enterprise/creative-intelligence/prospect-brand-auditor.cjs');
const lead={tenantRef:'sbc:1',leadId:'lead-1',businessName:'Example Auto',websiteUrl:'https://example.com/'};
const now=Date.parse('2026-11-26T17:00:00.000Z'),scope={tenantRef:'sbc:1',now};
const snapshot={url:lead.websiteUrl,checkedAt:'2026-11-26T16:00:00.000Z',status:200,htmlSha256:'a'.repeat(64),signals:{title:true,description:true,viewport:false,h1:true,contactLink:false,form:false,structuredData:true,socialPreview:true,language:true,alternateSpanish:false}};
test('only public HTTPS domain targets, without credentials, ports, queries or IP literals',()=>{
 assert.equal(normalizeTargetUrl('example.com'),'https://example.com/');
 for(const x of ['http://example.com','https://127.0.0.1','https://[::1]','https://2130706433','https://localhost','https://foo.local','https://a.internal','https://user:pass@example.com','https://example.com:8443','https://example.com/?secret=1','https://example.com/#fragment','file:///etc/passwd'])assert.throws(()=>normalizeTargetUrl(x),/INVALID_TARGET/);
});
test('reject private, reserved, loopback, link-local and nonpublic resolved addresses',async()=>{
 for(const ip of ['0.1.2.3','10.1.2.3','100.64.0.1','127.0.0.1','169.254.169.254','172.31.0.1','192.168.0.1','192.0.2.1','192.0.0.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::ffff:127.0.0.1'])assert.equal(isPublicIPv4(ip),false,ip);
 assert.equal(isPublicIPv4('8.8.8.8'),true);
 await assert.rejects(resolveTarget('example.com',async()=>['8.8.8.8','127.0.0.1']),/BLOCKED_DNS/);
 await assert.rejects(resolveTarget('example.com',async()=>[]),/BLOCKED_DNS/);
 assert.deepEqual(await resolveTarget('example.com',async()=>['8.8.8.8']),{url:'https://example.com/',address:'8.8.8.8'});
});
test('missing, failed, stale or mismatched website evidence never becomes a sales claim',()=>{
 for(const evidence of [null,{...snapshot,status:403},{...snapshot,checkedAt:'2026-11-20T00:00:00.000Z'},{...snapshot,url:'https://other.example/'}]){const a=auditProspectBrand(lead,{...scope,snapshot:evidence});assert.equal(a.overallScore,null);assert.equal(a.recommendedPackage,null);assert.deepEqual(a.findings,[]);assert.equal(a.automaticOutreach,false);}
 const a=auditProspectBrand({...lead,websiteUrl:''},scope);assert.equal(a.evidenceStatus,'WEBSITE_NOT_ON_FILE');assert.equal(a.recommendedPackage,null);
});
test('dated observed HTML gaps produce scoped proof points, not claims about sales, language or speed',()=>{
 const a=auditProspectBrand(lead,{...scope,snapshot});assert.equal(a.evidenceStatus,'CAPTURE_REVIEW_REQUIRED');assert.equal(a.overallScore,null);assert.equal(a.coverage,1);assert.equal(a.recommendedPackage.name,'Starter Website');assert.equal(a.recommendedPackage.startingPriceUsd,199);assert(a.findings.some(f=>f.code==='VIEWPORT_ABSENT'));assert(a.findings.some(f=>f.code==='CONTACT_MARKUP_ABSENT'));assert(!a.findings.some(f=>/SPANISH|REVENUE|SLOW/.test(f.code)));assert.equal(a.salesBrief.previewExists,false);assert.equal(a.salesBrief.proofPoints.length,2);assert.equal(a.findings[0].source.url,lead.websiteUrl);assert.equal(a.findings[0].source.htmlSha256,snapshot.htmlSha256);
 assert.throws(()=>auditProspectBrand(lead,{...scope,tenantRef:'sbc:2',snapshot}),/INVALID_LEAD_SCOPE/);
});
test('unknown signals remain unknown; valid page with no relevant gaps is not upsold',()=>{
 const a=auditProspectBrand(lead,{...scope,snapshot:{...snapshot,signals:{title:true}}});assert.equal(a.coverage,.1);assert.equal(a.recommendedPackage,null);assert.equal(a.checks.find(x=>x.key==='viewport').result,'unknown');
 const b=auditProspectBrand(lead,{...scope,snapshot:{...snapshot,signals:Object.fromEntries(Object.keys(snapshot.signals).map(k=>[k,true]))}});assert.equal(b.recommendedPackage,null);assert.equal(b.overallScore,null);
});
