'use strict';
// Diagnostic only. Never runs the server, contacts a provider, or prints environment variables.
const fs=require('node:fs'),path=require('node:path');
const lines=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8').split(/\r?\n/);
const match=/ECONOMIC_COST_DATA_REQUIRED|ECONOMIC_GATE_UNAVAILABLE|\/api\/quotes\b|economic.*(?:gate|margin|cost)|SBC.*QUOTE.*COST/i;
let shown=0,selected=[];
for(let n=0;n<lines.length;n++)if(match.test(lines[n]))selected.push(n);
console.log('[SBC V66 QUOTE DIAGNOSTIC] matching lines:',selected.length);
const context=new Set();
for(const n of selected.slice(0,36))for(let k=Math.max(0,n-7);k<=Math.min(lines.length-1,n+10);k++)context.add(k);
for(const n of [...context].sort((a,b)=>a-b)){
  if(shown++>=280)break;
  const line=lines[n];
  if(/(process\.env|PASSWORD|AUTH_TOKEN|API_SECRET|PRIVATE_KEY|API_KEY|SECRETS)/i.test(line)){
    console.log(String(n+1).padStart(5,'0')+' [source line omitted: environment or credential reference]');
    continue;
  }
  console.log(String(n+1).padStart(5,'0')+' '+line.slice(0,1400));
}
console.log('[SBC V66 QUOTE DIAGNOSTIC] complete; no mutation performed.');
