'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6634_VERSIONED_ASSET_CACHE_FIX';
const VERSION='66.34-asset-cache-reset';
function once(s,from,to,label){const count=s.split(from).length-1;if(count!==1)throw Error(MARKER+': '+label+' found '+count+' instances');return s.replace(from,to);}
function apply(root){
 const serverFile=path.join(root,'server.js');
 let server=fs.readFileSync(serverFile,'utf8');
 if(server.includes(MARKER))throw Error(MARKER+': duplicate application');
 // Previously any ?v= caused a one-year immutable cache, even when files
 // changed under unchanged URLs. 66.0.0 dashboard CSS was repeatedly rewritten.
 // Only content-hashed FILENAMES may be immutable. All old query-string
 // 'versioned' assets must instead use the server's existing no-store policy.
 const unsafe=String.raw`if(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(file)&&/[?&]v=|\.[a-f0-9]{8,}\./i.test(String(res.req?.url||'')))`;
 const safe=String.raw`if(/\.[a-f0-9]{12,64}\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(file))`;
 server=once(server,unsafe,safe,'unsafe immutable query-string static caching');
 server=once(server,
  "app.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:",
  "/* "+MARKER+": only content-addressed filenames may be cached immutably. */\napp.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:",
  'static entry boundary');
 if(server.includes(unsafe))throw Error(MARKER+': unsafe immutable caching remains');
 fs.writeFileSync(serverFile,server);
 const changed=['server.js'];
 const re=/((?:src|href)=["']\/[^"'?]+\.(?:js|css)\?v=)[^"'&]+(["'])/g;
 for(const rel of ['public/index.html','browser_public/index.html']){
  const file=path.join(root,rel);let html=fs.readFileSync(file,'utf8');
  if(html.includes(MARKER))throw Error(MARKER+': already in '+rel);
  const matches=[...html.matchAll(re)];
  if(matches.length<(rel.startsWith('browser_public/')?10:110))throw Error(MARKER+': unexpectedly few versioned JS/CSS assets in '+rel+' ('+matches.length+')');
  html=html.replace(re,(all,prefix,quote)=>prefix+VERSION+quote);
  // Active old importer is intentionally disabled; do not reintroduce its UI.
  if(/<script[^>]+src=["']\/sbc-lead-import-v6541\.js/.test(html))throw Error(MARKER+': legacy lead importer re-enabled');
  fs.writeFileSync(file,html);changed.push(rel);
 }
 for(const rel of ['public/sw.js','browser_public/sw.js']){
  const file=path.join(root,rel);if(!fs.existsSync(file))continue;
  let sw=fs.readFileSync(file,'utf8');
  const cache=/const CACHE=['"][^'"]+['"]/;
  if(!cache.test(sw))throw Error(MARKER+': service-worker cache identity missing '+rel);
  sw=sw.replace(cache,"const CACHE='sbc-static-v66-34-content-revalidated'");
  fs.writeFileSync(file,sw);changed.push(rel);
 }
 return {marker:MARKER,changed,immutableOnlyForContentHashedFilenames:true,priorStaleAssetUrlsInvalidated:true,legacyUIRemainsDisabled:true,crmWrites:false,tenantProtectionUnchanged:true};
}
module.exports={apply,MARKER,VERSION};