'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),zip=path.join(root,'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-call-diagnostic-'));
try{
 cp.execFileSync('unzip',['-q',zip,'-d',tmp]);
 const patterns=[/openSbcDialer/ig,/api\/(?:calls?|voice|communications\/call)/ig,/twilio/ig,/client\.calls\.create/ig,/voiceUrl/ig,/callSid/ig];
 let files=0;
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory()){if(!['node_modules','.git','vendor'].includes(ent.name))walk(p);continue;}if(!/\.(?:js|cjs|mjs|json|html)$/i.test(ent.name))continue;let s;try{s=fs.readFileSync(p,'utf8')}catch{continue;}const matches=[];for(const re of patterns){re.lastIndex=0;let m;while((m=re.exec(s))&&matches.length<30){const start=Math.max(0,m.index-180),end=Math.min(s.length,m.index+320);matches.push({term:m[0],line:s.slice(0,m.index).split('\n').length,context:s.slice(start,end).replace(/\n/g,' ')});}}if(matches.length){files++;console.log('\nFILE '+path.relative(tmp,p));for(const m of matches.slice(0,30))console.log('L'+m.line+' ['+m.term+'] '+m.context);}}}
 walk(tmp);console.log('\nDIAGNOSTIC_FILES_WITH_CALL_MATCHES='+files);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
