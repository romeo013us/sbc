'use strict';
/* V66.155 - GoDaddy extraction overlays old files; deny stale diagnostics at HTTP level. */
const BANNED_DIRS=new Set(['.git','.github','node_modules','data','backups','starter-leads','dist','dist-stage','releases','__pycache__','.pytest_cache','runtime-spool']);
const DANGEROUS=/\.(?:zip|tgz|tar|gz|csv|sqlite|db|pem|p12|pfx|key|log|bak|orig|swp)$/i;
function excludedReleasePath(name){
 if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||name.includes('\0'))return true;
 const bits=name.split('/');if(bits.some(x=>!x||x==='.'||x==='..'||BANNED_DIRS.has(x)))return true;
 const file=bits[bits.length-1];
 if(file==='.env'||file.startsWith('.env.')||DANGEROUS.test(file))return true;
 if(/^(public|browser_public)\//.test(name)&&/\.sql$/i.test(file))return true;
 if(/^(?:id_rsa|id_ed25519|credentials\.json|service-account(?:-key)?\.json)$/i.test(file))return true;
 if(/^(?:public|browser_public)\/(?:diag[0-9]*\.html|index\.html\.pre-commercial)$/i.test(name))return true;
 return false;
}
function denyPublicRequest(raw){
 let p=String(raw??'').split(/[?#]/)[0];try{p=decodeURIComponent(p)}catch{return true}
 if(p.includes('\0')||p.includes('\\'))return true;p=p.replace(/\/+/g,'/');
 const f=p.split('/').pop();
 return /^(?:diag[0-9]*\.html|index\.html\.pre-commercial|credentials\.json|service-account(?:-key)?\.json)$/i.test(f)||
  f==='.env'||f.startsWith('.env.')||DANGEROUS.test(f)||/\.sql$/i.test(f)||/(?:^|\/)(?:starter-leads|backups|data|\.git)(?:\/|$)/i.test(p);
}
module.exports={excludedReleasePath,denyPublicRequest};
