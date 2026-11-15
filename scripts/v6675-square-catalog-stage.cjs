'use strict';
// V66.75 owner-supplied $699 checkout mapping; disposable staged server only.
// No Square API calls, customer mutations, or Office Box entitlement changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../server.js');
const original=fs.readFileSync(file,'utf8');
const marker='/* SBC_V6675_SQUARE_699_OWNER_LINK */';
const link='https://square.link/u/c8wuNr1c';
const old="basic: 'https://square.link/u/uf53mzCR', essentials: '',";
const replacement="basic: 'https://square.link/u/uf53mzCR', essentials: '"+link+"',";
const productOld="officeBoxEntitlement:'included-foundation', paymentUrl:''";
const productNew="officeBoxEntitlement:'included-foundation', paymentUrl:PAYMENT_LINKS.essentials";
let code=original;
if(!original.includes(marker)){
 assert.equal(original.split(old).length-1,1,'Square package mapping must be unique');
 assert.equal(original.split(productOld).length-1,1,'Complete Launch mapping must be unique');
 code=code.replace(old,replacement).replace(productOld,productNew);
 code=code.replace('const PAYMENT_LINKS = {',marker+'\nconst PAYMENT_LINKS = {');
}
const modern=code.includes("SBC_PRICE.offer('complete').paymentUrl");
if(modern){
 const pricing=require('../enterprise/sbc-public-package-pricing-v20261115.cjs');
 for(const [id,cents,slug] of [['starter',19900,'xD1tRvlT'],['basic',49900,'2mkZwvXa'],['essentials',79900,'atJchS8R'],['complete',99900,'YdzUoWl3']]){
  const item=pricing.offer(id);
  assert.equal(item.priceCents,cents,'Pricing contract mismatch: '+id);
  assert.equal(item.paymentUrl,'https://square.link/u/'+slug,'Square link mismatch: '+id);
 }
 assert.ok(code.includes("professional: SBC_PRICE.offer('complete').paymentUrl"));
 assert.ok(!code.includes("essentials: 'https://square.link/u/c8wuNr1c'"),'old checkout mappings must not return');
}else{
 assert.ok(code.includes(marker)&&code.includes(replacement)&&code.includes(productNew));
 assert.ok(!code.includes(old)&&!code.includes(productOld));
}
if(process.argv.includes('--apply')){if(code!==original)fs.writeFileSync(file,code);
 console.log('[SBC V6675] Pinned owner-provided $699 Square URL applied to staged runtime; no payment');}
else console.log('[SBC V6675] Source patch anchors verified, no source modifications');