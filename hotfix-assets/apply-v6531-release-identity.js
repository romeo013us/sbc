'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6531_RELEASE_IDENTITY_CACHE_FIX';
const VERSION='65.1.31';
function replaceOnce(s,regex,replacement,label){const matches=s.match(regex)||[];if(matches.length!==1)throw new Error(MARKER+': '+label+' match count '+matches.length);return s.replace(regex,replacement);}
function apply(root){
 const htmlPath=path.join(root,'public','index.html');
 if(!fs.existsSync(htmlPath))throw new Error(MARKER+': public/index.html missing');
 let html=fs.readFileSync(htmlPath,'utf8');
 html=replaceOnce(html,/<title>[^<]*SBC Business Command Center[^<]*<\\/title>/i,'<title>SBC Business Command Center — V'+VERSION+'</title>','browser tab title');
 html=html.replace(/(<meta name="description" content=")[^"]*(">)/,'$1Successful By Choice private business operating system · V'+VERSION+'$2');
 fs.writeFileSync(htmlPath,html);
 const swPath=path.join(root,'public','sw.js');
 if(!fs.existsSync(swPath))throw new Error(MARKER+': public/sw.js missing');
 let sw=fs.readFileSync(swPath,'utf8');
 sw=replaceOnce(sw,/const CACHE='[^']+';/,"const CACHE='sbc-static-v65-1-31';",'service worker cache identity');
 sw=sw.replace(/keys.filter(k=>\\/\\^sbc-static-v\\(\\?:55\\|56\\)-\\/.test(k)&&k!==CACHE)/,"keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)");
 if(!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)"))sw=sw.replace(/const keys=await caches.keys\\(\\);await Promise.all\\(keys.filter\\([^;]+?\\.map\\(k=>caches.delete\\(k\\)\\)\\);/,"const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
 if(!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)"))throw new Error(MARKER+': service-worker legacy cache purge was not installed');
 fs.writeFileSync(swPath,sw);
 const pkgPath=path.join(root,'package.json'), pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
 if(pkg.name!=='sbc-business-command-center')throw new Error(MARKER+': unexpected package name');
 pkg.version=VERSION;pkg.description='SBC OS V65.1.31 release identity, browser cache repair, and writer-lease marker fix';
 fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\\n');
 const lockPath=path.join(root,'package-lock.json');
 if(fs.existsSync(lockPath)){const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));lock.version=VERSION;if(lock.packages&&lock.packages['']){lock.packages[''].version=VERSION;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;}fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\\n');}
 const identityPath=path.join(root,'config','release-identity.js');
 if(fs.existsSync(identityPath)){let ident=fs.readFileSync(identityPath,'utf8').replace(/const RELEASE_VERSION = '[^']+';/,"const RELEASE_VERSION = '"+VERSION+"';").replace(/const RELEASE_NAME = '[^']+';/,"const RELEASE_NAME = 'RELEASE_IDENTITY_CACHE_FIX';").replace(/major:\\d+,minor:\\d+,patch:\\d+/,"major:65,minor:1,patch:31");fs.writeFileSync(identityPath,ident);}
 return {marker:MARKER,version:VERSION};
}
module.exports={apply,MARKER,VERSION};
