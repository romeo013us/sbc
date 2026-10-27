'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const failures=[];
for(const line of server.split(/\r?\n/)){
  if(/mysqlPool\.query/.test(line) && /req\.(body|query|params)/.test(line) && !/\[[^\]]*req\./.test(line) && !/\?/.test(line)) failures.push('Potential unparameterized request data in SQL: '+line.trim().slice(0,160));
}
if(/TWILIO_AUTH_TOKEN\s*=\s*['"][^'"]+['"]/.test(server))failures.push('Hardcoded Twilio token detected.');
if(/GODADDY_(?:PAT|API_KEY|API_SECRET)\s*=\s*['"][^'"]+['"]/.test(server))failures.push('Hardcoded GoDaddy credential detected.');
for(const f of ['public/.htaccess','infra/mesh/zero-trust.yaml','infra/mesh/network-policy.yaml','infra/k8s/pvc.yaml','infra/k8s/secret-policy.md','enterprise/distributed-lock.js','ecosystem.config.cjs'])if(!fs.existsSync(path.join(root,f)))failures.push(`Missing ${f}`);
const envFiles=['V32-WORLD-READY-ENV-TEMPLATE.txt','AUTOMATION-ENV-TEMPLATE.txt'];
for(const f of envFiles){if(fs.existsSync(path.join(root,f))){const t=fs.readFileSync(path.join(root,f),'utf8');if(/(?:sk-|AC[a-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/i.test(t))failures.push(`Potential live credential in ${f}.`);}}
if(!/SBC_DEMO_WORKER_TOKEN/.test(server))failures.push('Demo worker token boundary missing.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('SBC security static checks passed: request data SQL guard clear; no hardcoded target credentials; boundary files present.');
