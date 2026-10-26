'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6637_NETWORK_ONLY_NO_OFFLINE_MUTATION_REPLAY';
const FETCH_REPLACEMENT=[
"// "+MARKER+": network-only UI/data. No cached authenticated HTML or stale runtime.",
"self.addEventListener('fetch',event=>{event.respondWith(fetch(event.request));});",
"// Historic IndexedDB records are preserved, but queued writes may NOT execute in background.",
"self.addEventListener('sync',event=>{",
"  if(event.tag==='sbc-offline-sync')event.waitUntil(Promise.resolve());",
"});"
].join('\n');
const QUEUE_REPLACEMENT=[
"// "+MARKER+": offline mutations require explicit new user action once online.",
"// Do not inspect, delete or silently replay previously stored IndexedDB records.",
"window.SBCOfflineSync=Object.freeze({",
"  queue:async()=>{const error=new Error('OFFLINE_WRITES_DISABLED: reconnect and submit explicitly');error.code='OFFLINE_WRITES_DISABLED';throw error;},",
"  flush:async()=>({flushed:0,automaticReplay:false,reason:'OFFLINE_WRITES_DISABLED'})",
"});"
].join('\n');
function patchSw(text,rel){
 if(text.includes(MARKER))throw Error(MARKER+': duplicate '+rel);
 const start=text.indexOf("self.addEventListener('fetch',");
 const sync=text.indexOf("self.addEventListener('sync',");
 if(start<0||sync<start||text.indexOf("self.addEventListener('fetch',",start+1)>=0||text.indexOf("self.addEventListener('sync',",sync+1)>=0)throw Error(MARKER+': ambiguous SW listeners '+rel);
 const between=text.slice(start,sync);
 if(!between.includes('caches.match(r)')||!between.includes("r.method!=='GET'"))throw Error(MARKER+': original caching semantics unexpected '+rel);
 const after=text.slice(sync);
 const oldSync=/^self\.addEventListener\('sync',e=>\{if\(e\.tag==='sbc-offline-sync'\).*?\}\);\s*$/m;
 const matches=[...after.matchAll(new RegExp(oldSync.source,'gm'))];
 if(matches.length!==1||!matches[0][0].includes("indexedDB.open('sbc-offline-v1'"))throw Error(MARKER+': unknown offline replay body '+rel);
 const remaining=after.replace(oldSync,'');
 const result=text.slice(0,start)+FETCH_REPLACEMENT+'\n'+remaining;
 if(/caches\.match\(r\)|indexedDB\.open\('sbc-offline-v1'/.test(result))throw Error(MARKER+': offline fallback remains '+rel);
 if(!result.includes('keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)'))throw Error(MARKER+': old browser cache cleanup missing '+rel);
 return result;
}
function patchMega(text,rel){
 if(text.includes(MARKER))throw Error(MARKER+': duplicate '+rel);
 const start=text.indexOf('window.SBCOfflineSync=(function(){');
 const endMarker="window.addEventListener('online',()=>flush().catch(()=>{}));return {queue,flush};})();";
 const end=text.indexOf(endMarker,start);
 if(start<0||end<start||text.indexOf('window.SBCOfflineSync=(function(){',start+1)>=0||text.indexOf(endMarker,end+1)>=0)throw Error(MARKER+': unknown offline queue '+rel);
 const old=text.slice(start,end+endMarker.length);
 if(!old.includes("tx.objectStore(STORE).add(")||!old.includes("fetch(x.url,")||!old.includes("r.sync?.register('sbc-offline-sync')"))throw Error(MARKER+': replay contract changed '+rel);
 return text.slice(0,start)+QUEUE_REPLACEMENT+text.slice(end+endMarker.length);
}
function apply(root){
 const changed=[];
 for(const dir of ['public','browser_public']){
  for(const [name,fn] of [['sw.js',patchSw],['mega.js',patchMega]]){
   const rel=dir+'/'+name,p=path.join(root,rel);
   if(!fs.existsSync(p))throw Error(MARKER+': missing '+rel);
   const after=fn(fs.readFileSync(p,'utf8'),rel);
   new (require('node:vm').Script)(after,{filename:rel});
   fs.writeFileSync(p,after);changed.push(rel);
  }
 }
 // V6638: install compact 10-Brain and accessible Kim header launcher after V6636 CSS bundling.
 const v6638='sbc-v6638-compact-brains-kim.js';
 const source=path.join(__dirname,v6638);
 if(!fs.existsSync(source))throw Error(MARKER+': missing V6638 canonical browser helper');
 const js=fs.readFileSync(source,'utf8');
 new (require('node:vm').Script)(js,{filename:v6638});
 const entrypoints=['public','browser_public'].filter(dir=>fs.existsSync(path.join(root,dir,'index.html')));
 if(entrypoints.length===1)throw Error(MARKER+': inconsistent public entrypoints for V6638');
 for(const dir of entrypoints){
  fs.copyFileSync(source,path.join(root,dir,v6638));
  const entry=path.join(root,dir,'index.html');
  let html=fs.readFileSync(entry,'utf8');
  if(!html.includes('id="sbc-v6638-inline-ui"')){
   if(!html.includes('</body>'))throw Error(MARKER+': missing HTML body end in '+dir);
   if(js.includes('</script'))throw Error(MARKER+': invalid browser helper HTML tag');
   html=html.replace('</body>','<script id="sbc-v6638-inline-ui">'+js+'</script>\n</body>');
   fs.writeFileSync(entry,html);
  }
  changed.push(dir+'/'+v6638,dir+'/index.html');
 }
 if(entrypoints.length===2){
  const perf=require('./apply-v6639-published-read-poll-guard.js').apply(root);
  changed.push(...perf.changed);
  const payments=require('./apply-v6640-payment-evidence-and-square-preflight.js').apply(root);
  changed.push(...payments.files);
  const fulfillment=require('./apply-v6641-fulfillment-requires-payment.js').apply(root);
  changed.push(...fulfillment.files);
  const mission=require('./apply-v6642-kim-mission-financial-governance.js').apply(root);
  changed.push(...mission.files);
 }
 return {marker:MARKER,changed,automaticMutationReplayDisabled:true,authenticatedHtmlCacheDisabled:true,
 historicalOfflineQueuePreserved:true,publicWritesBlockedWhenOffline:true,
 tenantSecurityUnchanged:true,crmWrites:false,ledgerMutations:false};
}
module.exports={apply,MARKER,patchMega,patchSw};
