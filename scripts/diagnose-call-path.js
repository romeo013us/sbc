'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),zip=path.join(root,'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-call-diagnostic-'));
try{
 cp.execFileSync('unzip',['-q',zip,'-d',tmp]);
 const targets=[
  {file:'server.js',terms:['function openSbcDialer','async function openSbcDialer','app.get(\\'/api/voice/status\\'','app.get(\\'/api/voice/token\\'','app.post(\\'/api/voice/twiml\\'']},
  {file:'public/app.js',terms:['function openSbcDialer','async function openSbcDialer','async function ensureSbcVoice','async function sbcVoiceStatus']}
 ];
 function showTarget(file,src,term){const at=src.indexOf(term);if(at<0)return;const from=Math.max(0,at-350),to=Math.min(src.length,at+4200);console.log('\\nTARGET '+file+' term='+term+' offset='+at+'\\n'+src.slice(from,to)+'\\n---END TARGET---');}
 let files=0;
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory()){if(!['node_modules','.git','vendor'].includes(ent.name))walk(p);continue;}if(!/\.(?:js|cjs|mjs|json|html)$/i.test(ent.name))continue;let s;try{s=fs.readFileSync(p,'utf8')}catch{continue;}const rel=path.relative(tmp,p).replace(/\\\\/g,'/');if(['server.js','public/app.js'].includes(rel)){for(const t of targets.filter(x=>x.file===rel))for(const term of t.terms)showTarget(rel,s,term);}}}
 walk(tmp);console.log('\nCall path source extraction complete.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
