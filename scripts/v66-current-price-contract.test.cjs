'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {offer,amountMatches}=require('../enterprise/sbc-website-checkout-offers.cjs');
test('public website checkout enforces canonical setup amounts and rejects client price changes',()=>{
 for(const [id,price] of [['quickstart',99],['starter',199],['website-custom',499]]){
  const item=offer(id);assert.equal(item.price,price);assert.equal(amountMatches(item,price*100),true);
  for(const amount of [price*100-1,price*100+1,0,-1,String(price*100),NaN])assert.equal(amountMatches(item,amount),false);
 }
 assert.equal(offer('unknown'),null);assert.equal(offer('__proto__'),null);assert.equal(amountMatches(null,19900),false);
});
