'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6606_CRM_EDIT_WORKFLOW';
function replaceOnce(source,from,to,label){
 const found=source.split(from).length-1;
 if(found!==1)throw Error(MARKER+': '+label+' expected one anchor, found '+found);
 return source.replace(from,to);
}
function apply(root){
 const server=path.join(root,'server.js'),index=path.join(root,'public','index.html'),workspace=path.join(root,'public','sbc-lead-workspace-v6519.js');
 const originalServer=fs.readFileSync(server,'utf8');
 if(originalServer.includes(MARKER))return {marker:MARKER,changed:false};
 const serverNext=replaceOnce(originalServer,
  'registerCRMRoutes(app,{auth,getContext:()=>({db,mysqlPool,audit,saveData,user:null,recoveryRequired:()=>Boolean(MYSQL_RECOVERY_REQUIRED)})});',
  'registerCRMRoutes(app,{auth,getContext:()=>({db,mysqlPool,audit,saveData,user:null,recoveryRequired:()=>Boolean(MYSQL_RECOVERY_REQUIRED)})});\n/* '+MARKER+' */\nrequire(\'./routes/crm-edits-v6606\')(app,{auth,getContext:()=>({db,mysqlPool,audit,recoveryRequired:()=>Boolean(MYSQL_RECOVERY_REQUIRED)})});',
  'CRM route registration');
 const workspaceNext=replaceOnce(fs.readFileSync(workspace,'utf8'),
  "<td>${esc(r.status || 'Unspecified')}</td></tr>",
  "<td>${esc(r.status || 'Unspecified')}<button class=\"slw-btn\" type=\"button\" data-sbc-lead-edit-id=\"${esc(r.id)}\">Edit</button></td></tr>",
  'Lead Workspace action');
 const indexNext=replaceOnce(fs.readFileSync(index,'utf8'),
  '<script src="/sbc-lead-workspace-v6519.js?v=66.0.0-kim-launcher-removedstudio" defer></script>',
  '<script src="/sbc-lead-workspace-v6519.js?v=66.0.0-kim-launcher-removedstudio" defer></script><script src="/sbc-lead-edit-v6606.js?v=66.0.6" defer></script>',
  'browser entry');
 // Compute all replacements and check file dependencies before writing any output.
 for(const filename of ['crm-edits-v6606.js','sbc-lead-edit-v6606.js','v6606-crm-edits-test.js'])
  if(!fs.existsSync(path.join(__dirname,filename)))throw Error(MARKER+': missing '+filename);
 fs.mkdirSync(path.join(root,'routes'),{recursive:true});
 fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'crm-edits-v6606.js'),path.join(root,'routes','crm-edits-v6606.js'));
 fs.copyFileSync(path.join(__dirname,'sbc-lead-edit-v6606.js'),path.join(root,'public','sbc-lead-edit-v6606.js'));
 fs.copyFileSync(path.join(__dirname,'v6606-crm-edits-test.js'),path.join(root,'scripts','v6606-crm-edits-test.js'));
 fs.writeFileSync(server,serverNext);
 fs.writeFileSync(workspace,workspaceNext);
 fs.writeFileSync(index,indexNext);
 return {marker:MARKER,changed:true};
}
module.exports={MARKER,apply};
