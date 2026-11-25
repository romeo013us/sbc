'use strict';
/* V66.155 - GoDaddy extraction overlays old files; deny stale diagnostics at HTTP level. */
const BANNED_DIRS=new Set(['.git','.github','node_modules','data','backups','starter-leads','dist','dist-stage','releases','__pycache__','.pytest_cache','runtime-spool']);
// Reviewed root-only source history. Preserve active and guardian-referenced attestations.
const HISTORICAL_ROOT_ARTIFACTS=new Set([
 "BUILD-MANIFEST-V60.4.1.txt",
 "BUILD-VERIFICATION-V65.1.10-SESSION-OVERLAY-HOTFIX.json",
 "BUILD-VERIFICATION-V65.1.10.json",
 "BUILD-VERIFICATION-V65.1.6.json",
 "BUILD-VERIFICATION-V65.1.8.json",
 "RELEASE-MANIFEST-V64.0.0.json",
 "RELEASE-MANIFEST-V64.2.16.json",
 "RELEASE-MANIFEST-V64.2.17.json",
 "RELEASE-MANIFEST-V65.0.3.json",
 "RELEASE-MANIFEST-V65.0.4.json",
 "LEAD-WORKSPACE-TEST-REPORT.txt",
 "all-tests.txt",
 "browser-war-file-results.json",
 "browser-war-results.json",
 "SHA256-V65.0.9-OWNER-LEADS.txt",
 "V56.25.0-FILE-SHA256.txt",
 "V56.6-COMPONENT-HASHES.txt",
 "V60.3.0-FILE-HASHES.txt",
 "V65.0.7-RELEASE-MANIFEST.txt",
 "component-sha256-v56.23.0.txt",
 "component-sha256.txt"
]);
const RECOVERY_FILE=/(?:\.sql\.enc$|^sbc-backup-.*\.sql$|^\.sbc-backup-.*\.partial$)/i;
const DANGEROUS=/\.(?:zip|tgz|tar|gz|csv|sqlite|db|pem|p12|pfx|key|log|bak|orig|swp)$/i;
function excludedReleasePath(name){
 if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||name.includes('\0'))return true;
 const bits=name.split('/');if(bits.some(x=>!x||x==='.'||x==='..'||BANNED_DIRS.has(x)))return true;
 const file=bits[bits.length-1];
 // Repository-root Markdown is source history, never a GoDaddy runtime dependency.
 // Keep README.md for platform/operator orientation; preserve all docs in GitHub.
 if(bits.length===1&&/\.md$/i.test(file)&&file!=='README.md')return true;
 if(bits.length===1&&HISTORICAL_ROOT_ARTIFACTS.has(file))return true;
 if(file==='.env'||file.startsWith('.env.')||DANGEROUS.test(file)||RECOVERY_FILE.test(file))return true;
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
  f==='.env'||f.startsWith('.env.')||DANGEROUS.test(f)||RECOVERY_FILE.test(f)||/\.sql$/i.test(f)||/(?:^|\/)(?:starter-leads|backups|data|\.git)(?:\/|$)/i.test(p);
}
module.exports={excludedReleasePath,denyPublicRequest};
