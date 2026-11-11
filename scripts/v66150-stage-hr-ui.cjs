'use strict';
/* V66.150 delegates existing HR owner workstation without adding competing owner UI. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66150_HR_MANAGER_ROLE_V10';
function once(s,a,b,label){
 const n=s.split(a).length-1;if(n!==1)throw Error('HR_DELEGATION_UI_ANCHOR_'+label+'_'+n);
 return s.replace(a,()=>b);
}
function patchV10(src){
 let s=String(src||'');
 if(s.includes(MARK))return s;
 s=once(s,"manager:'Manager'};",
  "manager:'Manager',hr_manager:'HR Department Manager'};\n  /* "+MARK+" */",'role-label');
 const d=String.fromCharCode(36);
 s=once(s,'<option value="manager" '+d+"{u.role==='manager'?'selected':''}>Manager</option>",
  '<option value="hr_manager" '+d+"{u.role==='hr_manager'?'selected':''}>HR Department Manager</option>",'role-choice');
 s=once(s,'<button class="btn primary" onclick="addWorker11()">+ Add Team Member</button></div>',
  '<button class="btn primary" onclick="addWorker11()">+ Add Team Member</button><button class="btn" onclick="window.open(\'/hr-workstation.html\',\'_blank\',\'noopener,noreferrer\')">👥 Open HR Management Console</button></div>','management-shortcut');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const paths=['public/v10.js','browser_public/v10.js'];
 const contents=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
 if(contents[0]!==contents[1])throw Error('HR_V10_MIRROR_MISMATCH');
 const out=contents.map(patchV10);
 if(apply){
  if(process.env.SBC_V66150_ISOLATED_STAGE!=='YES')throw Error('HR_DELEGATION_DISPOSABLE_STAGE_ONLY');
  paths.forEach((p,i)=>fs.writeFileSync(path.join(root,p),out[i]));
 }
 return {changed:out[0]!==contents[0],bytes:out[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('HR_DELEGATION_UI_NOT_IN_RELEASE');
 console.log('[V66.150] HR manager role UI '+(r.changed?'STAGE_READY':'COMPILED_PRESENT'));
}
module.exports={MARK,patchV10,patchFiles};
