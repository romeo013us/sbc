'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6633_DEFERRED_DASHBOARD_GRID_COLLAPSE';
const RULES=[
'/* '+MARKER+': do not let an asynchronously appended production deck turn all of #content into 12 narrow tracks. */',
'#app.app .main #content:has(> #sbcProductionControlDashboard){',
'  display:block!important;grid-template-columns:none!important;',
'  width:100%!important;min-width:0!important;max-width:100%!important;',
'  box-sizing:border-box!important;',
'}',
'#app.app .main #content:has(> #sbcProductionControlDashboard)>*{',
'  grid-column:1/-1!important;',
'  width:100%!important;min-width:0!important;max-width:100%!important;',
'  box-sizing:border-box!important;',
'}',
'@media(max-width:760px){#app.app .main #content:has(> #sbcProductionControlDashboard){display:block!important}}'
].join('\n');
function apply(root){
 const changed=[];
 for(const dir of ['public','browser_public']){
  const target=path.join(root,dir,'sbc-v6601-reference-cockpit.css');
  const deck=path.join(root,dir,'sbc-v6562-executive-dashboard.css');
  if(!fs.existsSync(target)||!fs.existsSync(deck))throw Error(MARKER+': missing compiled CSS in '+dir);
  const original=fs.readFileSync(deck,'utf8');
  if(!original.includes('#content:has(> #sbcProductionControlDashboard){display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))'))throw Error(MARKER+': known 12-column trigger absent '+dir);
  let css=fs.readFileSync(target,'utf8');
  if(css.includes(MARKER))throw Error(MARKER+': duplicate patch '+dir);
  if(!css.includes('#app.app>.main'))throw Error(MARKER+': missing modern main selector '+dir);
  css+='\n'+RULES+'\n';
  fs.writeFileSync(target,css);changed.push(path.relative(root,target));
 }
 return {marker:MARKER,changed,cssOnly:true,crmWrites:false,uiOnly:true,mainLayoutOwnerPreserved:true,noSchedulingChanges:true};
}
module.exports={apply,MARKER,RULES};