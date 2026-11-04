'use strict';
// V66.78: The owner confirmed two hosted Square links and corrected supplier quantity.
// Apply ONLY to the disposable compiled server after existing staged transforms.
// Preserve old cards200 IDs for existing transaction associations; change current display label + provider URL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8');
const marker='/* SBC_V6678_OWNER_CONFIRMED_250_CARDS */';
const fromUrl="cards200: 'https://square.link/u/G4DTFmin'";
const toUrl="cards200: 'https://square.link/u/HxgFM50Y'";
const fromName="name:'Business Cards — 200'";
const toName="name:'Business Cards — 250'";
const fromPackage='200 business cards',toPackage='250 business cards';
let code=original;
if(!code.includes(marker)){
 assert.equal(code.split(fromUrl).length-1,1,'exactly one legacy $50 Square URL expected');
 assert.equal(code.split(fromName).length-1,1,'exactly one existing cards200 catalog label expected');
 assert.equal(code.split(fromPackage).length-1,2,'exactly two $349 package/fulfillment references expected');
 code=code.replace(fromUrl,toUrl).replace(fromName,toName).replaceAll(fromPackage,toPackage);
 const identity='const PAYMENT_LINKS = {';
 assert.equal(code.split(identity).length-1,1,'payment link catalog must be unique');
 code=code.replace(identity,marker+'\n'+identity);
}
assert.ok(code.includes(marker),'stage marker required');
assert.ok(code.includes(toUrl)&&code.includes(toName)&&code.includes(toPackage),'corrected owner offer missing');
assert.ok(!code.includes(fromUrl)&&!code.includes(fromName)&&!code.includes(fromPackage),'stale 200-card terms must be absent');
assert.equal(code.split(toName).length-1,1,'catalog label duplicate');
assert.equal(code.split(toPackage).length-1,2,'package references duplicate');
if(process.argv.includes('--apply')){
 if(code!==original)fs.writeFileSync(file,code);
 console.log('[SBC V66.78] owner-confirmed $50/250-card link, package text and catalog label staged (no Square charge)');
}else console.log('[SBC V66.78] stage anchors checked; source unchanged');
