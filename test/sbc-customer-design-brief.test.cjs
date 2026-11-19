'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const brief=require('../enterprise/sbc-customer-design-brief-contract.cjs');
const valid={businessName:'Jazmin Tires',contactName:'Jazmin',contactEmail:'jazmin@example.com',
 primaryColor:'#213547',secondaryColor:'#eab308',style:'bold',referenceUrls:['https://example.com/inspiration'],
 summary:'A trustworthy, bright customer website',consent:true};
test('website design brief accepts concise verified inputs without promising publication',()=>{
 const result=brief.normalize('WEBSITE',{...valid,services:'Wheels and tire services pending confirmation',pages:['home','services','contact'],features:['contact_form'],domain:'',notes:'Prefer a strong header'});
 assert.equal(result.kind,'WEBSITE');assert.equal(result.primaryColor,'#213547');
 assert.deepEqual(result.pages,['home','services','contact']);
 assert.equal(result.paymentCollected,false);assert.equal(result.publicationApproved,false);
 assert.equal(result.contactEmail,'jazmin@example.com');
});
test('business card design brief captures exact print details, colors and quantities',()=>{
 const x=brief.normalize('BUSINESS_CARDS',{...valid,printedName:'Jazmin Cruz',quantity:'500',sides:'double',finish:'matte',
  printedPhone:'3055550199',printedTitle:'Owner',qrUrl:'https://jazmintires.example',orientation:'horizontal'});
 assert.equal(x.printedName,'Jazmin Cruz');assert.equal(x.quantity,500);assert.equal(x.sides,'double');assert.equal(x.finish,'matte');
 assert.equal(x.printedPhone,'3055550199');assert.equal(x.qrUrl,'https://jazmintires.example/');
});
test('invalid contact, unsupported products, unsafe links or invalid print quantity are rejected',()=>{
 assert.throws(()=>brief.normalize('POSTERS',valid),/INVALID_REQUEST_TYPE/);
 assert.throws(()=>brief.normalize('WEBSITE',{...valid,contactEmail:'',contactPhone:''}),/CONTACT_REQUIRED/);
 assert.throws(()=>brief.normalize('WEBSITE',{...valid,referenceUrls:['javascript:alert(1)']}),/HTTPS_REFERENCE_REQUIRED/);
 assert.throws(()=>brief.normalize('BUSINESS_CARDS',{...valid,printedName:'A',quantity:99999999}),/INVALID_PRINT_QUANTITY/);
 assert.throws(()=>brief.normalize('WEBSITE',{...valid,consent:false}),/CONFIRMATION_REQUIRED/);
});
test('link tokens are unguessable, hash-only, and time limited',()=>{
 const a=brief.generateToken();const b=brief.generateToken();
 assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);
 assert.equal(brief.hashToken(a).length,64);
 assert.notEqual(brief.hashToken(a),a);
 assert.equal(brief.validToken('bad'),false);
 assert.equal(brief.validToken(a),true);
});
test('HTML/JS file shares bounded form contracts with handler',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const page=fs.readFileSync(path.join(root,'public/sbc-customer-design-brief.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'public/sbc-customer-design-brief.js'),'utf8');
 const admin=fs.readFileSync(path.join(root,'public/sbc-customer-design-requests-v1.js'),'utf8');
 const routes=fs.readFileSync(path.join(root,'routes/sbc-customer-design-briefs.cjs'),'utf8');
 assert.match(page,/id="sbcBriefForm"/);assert.match(page,/name="primaryColor"/);
 assert.match(ui,/FormData/);assert.match(ui,/sbc\/design-briefs\/public/);
 assert.match(admin,/SBC_CUSTOMER_DESIGN_REQUESTS/);
 assert.match(routes,/WHERE tenant_id=\?/);
 assert.match(routes,/token_hash=\?/);
 for(const dir of ['public','browser_public'])for(const file of ['sbc-customer-design-brief.html','sbc-customer-design-brief.js','sbc-customer-design-requests-v1.js']){
  assert.equal(fs.readFileSync(path.join(root,'public',file),'utf8'),fs.readFileSync(path.join(root,dir,file),'utf8'));
 }
});
