/* SBC workstation loader: no dynamic network requests before explicit activation. */
(function(root){
 'use strict';
 function createLoader(manifest,loadScript){
  if(!manifest||typeof loadScript!=='function')throw Error('WORKSTATION_CONFIG_REQUIRED');
  const plans=new Map(),loaded=new Map(),workstations=new Map();
  for(const [key,urls] of Object.entries(manifest)){
   if(!/^[a-z][a-z0-9-]*$/.test(key)||!Array.isArray(urls)||!urls.length)throw Error('WORKSTATION_CONFIG_INVALID');
   for(const url of urls)if(typeof url!=='string'||!/^\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.js\?v=[A-Za-z0-9._-]+$/.test(url))throw Error('WORKSTATION_ASSET_INVALID');
   plans.set(key,Object.freeze([...urls]));
  }
  function once(url){
   if(loaded.has(url))return loaded.get(url);
   const promise=Promise.resolve().then(()=>loadScript(url)).catch(e=>{loaded.delete(url);throw e});
   loaded.set(url,promise);return promise;
  }
  return function load(key){
   if(!plans.has(key))return Promise.reject(Error('WORKSTATION_UNKNOWN'));
   if(workstations.has(key))return workstations.get(key);
   const urls=plans.get(key);
   const promise=(async()=>{for(const url of urls)await once(url)})().catch(e=>{workstations.delete(key);throw e});
   workstations.set(key,promise);return promise;
  };
 }
 if(typeof module==='object'&&module.exports){module.exports={createLoader};return;}
 if(!root||root.sbcLoadWorkstation)return;
 const manifest=Object.freeze({marketing:Object.freeze(['/sbc-market-intelligence.js?v=20261116-prospect-offline-v3','/sbc-v6567-marketing-hub.js?v=20261125-lazy-pilot'])});
 root.SBC_LAZY_MODULES=manifest;
 const load=root.sbcLoadWorkstation=createLoader(manifest,url=>new Promise((resolve,reject)=>{
  const tag=document.createElement('script');tag.src=url;tag.async=false;
  tag.onload=()=>{tag.onload=null;tag.onerror=null;resolve()};
  tag.onerror=()=>{tag.remove();reject(Error('WORKSTATION_LOAD_FAILED'))};
  document.head.appendChild(tag);
 }));
 let opening=null;
 function activate(button){
  if(!root.state?.me)return Promise.resolve();
  if(opening)return opening;
  button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Loading Marketing Hub…';
  opening=load('marketing').then(()=>{
   if(typeof root.SBCMarketingHub?.open!=='function')throw Error('WORKSTATION_ENTRY_MISSING');
   if(root.state?.me)root.SBCMarketingHub.open();
   button.textContent='Marketing Hub';
  }).catch(()=>{
   button.textContent='Retry Marketing Hub';button.focus();
  }).finally(()=>{button.disabled=false;button.removeAttribute('aria-busy');opening=null});
  return opening;
 }
 function mount(){
  if(document.getElementById('sbcMarketingHubNav'))return true;
  const nav=document.querySelector('.sidebar nav, aside nav, .sidebar .nav, #sidebar nav, nav[aria-label="Main navigation"]')||document.querySelector('.sidebar');
  if(!nav)return false;
  const b=document.createElement('button');b.id='sbcMarketingHubNav';b.type='button';b.className='mh-nav-button';
  b.innerHTML='<span aria-hidden="true">◈</span><span>Marketing Hub</span>';
  b.addEventListener('click',()=>void activate(b));nav.appendChild(b);return true;
 }
 function deepLink(){
  if(!/^#marketing(?:-hub)?$/i.test(root.location.hash)||!root.state?.me)return false;
  if(!mount())return false;const b=document.getElementById('sbcMarketingHubNav');if(b)void activate(b);return Boolean(b);
 }
 function boot(){
  mount();if(deepLink())return;
  let tries=0;const timer=setInterval(()=>{
   const ready=mount(),requested=/^#marketing(?:-hub)?$/i.test(root.location.hash);
   if((ready&&(!requested||deepLink()))||++tries>=40)clearInterval(timer);
  },500);
 }
 root.addEventListener('hashchange',deepLink);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window!=='undefined'?window:null);
