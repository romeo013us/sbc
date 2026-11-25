'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/sbc-customer-journey-v1.js'),'utf8');
const wait=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const nodes=new Map(),pending=[],requests=[];
 function el(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,hidden:false,attrs:{},handlers:{},classList:{toggle(){}},querySelectorAll(){return []},addEventListener(name,fn){this.handlers[name]=fn},setAttribute(k,v){this.attrs[k]=v}});return nodes.get(id)}
 const detail=(id,name,steps=[],previewUrl='')=>({ok:true,readOnly:false,account:{customerId:id,businessName:name,nextAction:'Review order',assignedToName:'Owner'},inquiries:[],appointments:[],events:[],orders:[{id:'order-'+id,product:'Website',price:199,status:'In progress',paymentVerified:true,protectedQa:false,revision:2,steps,previewUrl}]});
 const response=d=>({ok:true,json:async()=>d});
 const fetch=async(url,options)=>{requests.push({url,options});if(url==='/api/me')return response({role:'owner'});if(url.endsWith('/queue'))return response({rows:[{customerId:'a',businessName:'A'},{customerId:'b',businessName:'B'}],readOnly:false,counts:{}});if(url.endsWith('/reminders'))return response({sendEnabled:false,receipts:[]});if(url.includes('/accounts/')&&options.method==='GET')return new Promise((resolve,reject)=>pending.push({url,resolve:d=>resolve(response(d)),reject}));throw Error('Unexpected request '+url)};
 vm.runInNewContext(source,{document:{getElementById:el,querySelectorAll:()=>[]},location:{search:''},URLSearchParams,fetch});
 const select=id=>el('queue').handlers.click({target:{closest:()=>({dataset:{account:id}})}});
 return {el,pending,requests,detail,select};
}
test('account switch clears prior actions and ignores older responses even when returning to the same account',async()=>{
 const f=fixture();await wait();f.select('a');await wait();f.pending.shift().resolve(f.detail('a','Old visible account'));await wait();assert.match(f.el('detail').innerHTML,/Old visible account/);
 f.select('b');await wait();assert.doesNotMatch(f.el('detail').innerHTML,/Old visible account/);assert.equal(f.el('detail').attrs['aria-busy'],'true');
 f.select('a');await wait();f.select('b');await wait();const olderB=f.pending.shift(),oldA=f.pending.shift(),latestB=f.pending.shift();latestB.resolve(f.detail('b','Latest account'));await wait();olderB.resolve(f.detail('b','Stale response'));oldA.resolve(f.detail('a','Wrong account'));await wait();assert.match(f.el('detail').innerHTML,/Latest account/);assert.doesNotMatch(f.el('detail').innerHTML,/Stale response|Wrong account/);assert.equal(f.el('detail').attrs['aria-busy'],'false');
 f.select('a');await wait();f.pending.shift().reject(Error('ACCOUNT_NOT_FOUND'));await wait();assert.doesNotMatch(f.el('detail').innerHTML,/Latest account/);assert.match(f.el('detail').innerHTML,/could not load/i);
});
test('delivery requires URL form, and released orders cannot offer revision form',async()=>{
 const f=fixture();await wait();f.select('a');await wait();const steps=['intake','build','qa','approval','release','delivery'].map(key=>({key,label:key,completed:key!=='delivery'}));f.pending.shift().resolve(f.detail('a','Delivery account',steps,'https://example.invalid/proof'));await wait();const html=f.el('detail').innerHTML;assert.match(html,/data-deliver="order-a"/);assert.doesNotMatch(html,/data-step="delivery"|data-preview="order-a"/);assert.match(html,/Next required action/);
});
