'use strict';
const fs=require('fs');const path=require('path');
const SECRET_PATTERNS=[/(_KEY|_SECRET|_TOKEN|_PASSWORD|PAT|PRIVATE_KEY|ACCESS_TOKEN)$/i];
function auditSecrets({root=process.cwd(),logger=console}={}){
 const violations=[];const allowed=new Set(['secret.yaml.example','secret-policy.md']);
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','data','runtime-spool'].includes(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory()){walk(p);continue;}const rel=path.relative(root,p).replaceAll('\\','/');if(allowed.has(ent.name))continue;let s='';try{s=fs.readFileSync(p,'utf8')}catch{continue;}if(/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(s)||/sk-[A-Za-z0-9]{20,}/.test(s)){violations.push({file:rel,reason:'private key or token-like material detected'});continue;}for(const line of s.split(/\r?\n/)){if(/(API_KEY|SECRET|PASSWORD|TOKEN|PAT)\s*[:=]\s*['"][^'"\n]{12,}['"]/i.test(line)&&!/example|placeholder|process\.env/i.test(line)&&!/['"](?:[A-Z][A-Z0-9_]{3,})['"]\s*[,}]/.test(line))violations.push({file:rel,reason:'possible hardcoded credential'});}}
 }
 walk(root);return {ok:violations.length===0,violations,count:violations.length,policy:'Production secrets must remain in runtime secret stores; examples are permitted.'};
}
function assertSecretPolicy(opts={}){const r=auditSecrets(opts);if(!r.ok)throw new Error(`Secret audit failed: ${r.count} possible secret leak(s).`);return r;}
module.exports={auditSecrets,assertSecretPolicy,SECRET_PATTERNS};
