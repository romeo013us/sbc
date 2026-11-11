'use strict';
/* V66.149 – owner dashboard shortcut to independent HR department.
 * Source mirror parity and disposable GoDaddy staging. No new access role.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66149_HR_DEPARTMENT_SHORTCUT';
const OLD='<button type="button" class="btn ghost" onclick="sbcOpenOwnerAcceptanceDesk()">🛡️ Owner Acceptance Desk</button>';
const NEW=OLD+'<button type="button" class="btn ghost" onclick="sbcOpenHrDepartment()">👥 HR Department</button>';
const FN="\n/* SBC_V66149_HR_DEPARTMENT_SHORTCUT — owner only. */\nfunction sbcOpenHrDepartment(){\n if(state.me?.role!=='owner')return toast('Owner access required');\n window.location.assign('/hr-workstation.html');\n}\n";

function patchApp(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66148_SOFT_DELETED_CRM_TRUTH_UI'))throw Error('HR_REQUIRES_CURRENT_SBC_OWNER_BASELINE');
 if(s.split(OLD).length!==2)throw Error('HR_OWNER_BUTTON_ANCHOR_NOT_UNIQUE');
 s=s.replace(OLD,NEW);
 const anchor='function sbcOpenOwnerAcceptanceDesk(){';
 if(s.split(anchor).length!==2)throw Error('HR_OWNER_ROUTER_ANCHOR_NOT_UNIQUE');
 return s.replace(anchor,FN+'\n'+anchor);
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const files=['public/app.js','browser_public/app.js'];
 const source=files.map(f=>fs.readFileSync(path.join(root,f),'utf8'));
 if(source[0]!==source[1])throw Error('HR_DASHBOARD_SOURCES_DIVERGED');
 const target=source.map(patchApp);
 if(target[0]!==target[1])throw Error('HR_DASHBOARD_OUTPUT_DIVERGED');
 if(apply){
  if(process.env.SBC_V66149_ISOLATED_STAGE!=='YES')throw Error('HR_DASHBOARD_DISPOSABLE_STAGE_ONLY');
  files.forEach((f,i)=>fs.writeFileSync(path.join(root,f),target[i]));
 }
 return {changed:source[0]!==target[0],bytes:target[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('HR_DASHBOARD_LINK_NOT_PACKAGED');
 console.log('[V66.149] owner HR launcher '+(r.changed?'READY':'PACKAGED'));
}
module.exports={patchApp,patchFiles,MARK};
