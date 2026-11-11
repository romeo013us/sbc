'use strict';
/* V66.149 independent HR department navigation in disposable compiled UI only */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66149_HR_DEPT_OWNER_LINK';
function one(s,oldText,newText,label){
 const n=s.split(oldText).length-1;
 if(n!==1)throw Error('HR_UI_ANCHOR_'+label+'_'+n);
 return s.replace(oldText,()=>newText);
}
function patchApp(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66148_SOFT_DELETED_CRM_TRUTH_UI'))throw Error('HR_UI_REQUIRES_OWNER_ACCEPTANCE');
 s=one(s,'function sbcOpenOwnerAcceptanceDesk(){',
  "/* "+MARK+" */\nfunction sbcOpenHrDepartment(){\n if(state.me?.role!=='owner')return toast('Owner access required');\n window.open('/hr-workstation.html','_blank','noopener,noreferrer');\n}\nfunction sbcOpenOwnerAcceptanceDesk(){",'owner-link');
 s=one(s,'onclick="sbcOpenOwnerAcceptanceDesk()">🛡️ Owner Acceptance Desk</button>',
  'onclick="sbcOpenOwnerAcceptanceDesk()">🛡️ Owner Acceptance Desk</button><button type="button" class="btn ghost" onclick="sbcOpenHrDepartment()">👥 HR Department</button>','dashboard');
 return s;
}
function patchV10(raw){
 let s=String(raw||'');
 if(s.includes('SBC_V66149_HR_ROLE_V10'))return s;
 s=one(s,"manager:'Manager'};","manager:'Manager',hr_manager:'HR Department Manager'};\n  /* SBC_V66149_HR_ROLE_V10 */",'role-label');
 const d=String.fromCharCode(36);
 const oldOpt='<option value="manager" '+d+"{u.role==='manager'?'selected':''}>Manager</option>";
 const newOpt='<option value="hr_manager" '+d+"{u.role==='hr_manager'?'selected':''}>HR Department Manager</option>";
 s=one(s,oldOpt,newOpt,'role-select');
 s=one(s,'<button class="btn primary" onclick="addWorker11()">+ Add Team Member</button></div>',
  '<button class="btn primary" onclick="addWorker11()">+ Add Team Member</button><button class="btn" onclick="window.open(\'/hr-workstation.html\',\'_blank\',\'noopener,noreferrer\')">👥 Open HR Department</button></div>','workforce-shortcut');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const pairs=[['public/app.js','browser_public/app.js',patchApp],
  ['public/v10.js','browser_public/v10.js',patchV10]];
 const result=[];
 for(const [a,b,fn] of pairs){
  const x=fs.readFileSync(path.join(root,a),'utf8'),y=fs.readFileSync(path.join(root,b),'utf8');
  if(x!==y)throw Error('HR_SOURCE_MIRROR_MISMATCH_'+a);
  const z=fn(x);
  if(apply){
   if(process.env.SBC_V66149_ISOLATED_STAGE!=='YES')throw Error('HR_UI_DISPOSABLE_STAGE_ONLY');
   for(const file of [a,b])fs.writeFileSync(path.join(root,file),z);
  }
  result.push({file:a,changed:z!==x,bytes:z.length});
 }
 return result;
}
if(require.main===module){
 const x=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&x.some(y=>y.changed))throw Error('HR_UI_NOT_IN_COMPILED_RELEASE');
 console.log('[V66.149] owner HR nav '+JSON.stringify(x));
}
module.exports={MARK,patchApp,patchV10,patchFiles};
