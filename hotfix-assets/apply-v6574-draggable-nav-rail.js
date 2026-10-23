'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6574_DRAGGABLE_NAV_RAIL';
const CSS_NAME='sbc-v6574-draggable-nav-rail.css';
const JS_NAME='sbc-v6574-draggable-nav-rail.js';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function registerHtml(file,label){
 let html=fs.readFileSync(file,'utf8');
 if(!html.includes('/'+CSS_NAME)){
  html=once(html,'</head>','<link rel="stylesheet" href="/'+CSS_NAME+'?v=66.0.1-nav-rail">\n</head>',label+' CSS insertion');
 }
 if(!html.includes('/'+JS_NAME)){
  html=once(html,'</body>','<script src="/'+JS_NAME+'?v=66.0.1-nav-rail" defer></script>\n</body>',label+' script insertion');
 }
 if(!html.includes(MARKER)){
  html=once(html,'</body>','<!-- '+MARKER+' -->\n</body>',label+' marker insertion');
 }
 fs.writeFileSync(file,html);
}
function apply(root){
 const sourceDir=__dirname;
 const cssSource=path.join(sourceDir,'v6574-draggable-nav-rail.css');
 const jsSource=path.join(sourceDir,'v6574-draggable-nav-rail.js');
 const publicDir=path.join(root,'public');
 if(!fs.existsSync(cssSource)||!fs.existsSync(jsSource)||!fs.existsSync(path.join(publicDir,'index.html')))throw new Error(MARKER+': source navigation assets or public/index.html are missing');
 const htmlFiles=['public/index.html','browser_public/index.html'].map(rel=>({rel,file:path.join(root,rel)})).filter(x=>fs.existsSync(x.file));
 if(!htmlFiles.length)throw new Error(MARKER+': no HTML entrypoint found');
 for(const item of htmlFiles)registerHtml(item.file,item.rel);
 for(const dir of ['public','browser_public']){
  const targetDir=path.join(root,dir);
  fs.mkdirSync(targetDir,{recursive:true});
  fs.copyFileSync(cssSource,path.join(targetDir,CSS_NAME));
  fs.copyFileSync(jsSource,path.join(targetDir,JS_NAME));
 }
 for(const item of htmlFiles){
  const html=fs.readFileSync(item.file,'utf8');
  if(!html.includes('/'+CSS_NAME)||!html.includes('/'+JS_NAME)||!html.includes(MARKER))throw new Error(MARKER+': incomplete HTML registration in '+item.rel);
 }
 for(const dir of ['public','browser_public']){
  for(const name of [CSS_NAME,JS_NAME]){
   const target=path.join(root,dir,name);
   if(!fs.existsSync(target)||fs.statSync(target).size<100)throw new Error(MARKER+': missing or empty generated asset '+dir+'/'+name);
  }
 }
 return {marker:MARKER,changed:['public/index.html','browser_public/index.html','public/'+CSS_NAME,'public/'+JS_NAME,'browser_public/'+CSS_NAME,'browser_public/'+JS_NAME],crmWrites:false,serverChanges:false,idempotent:true};
}
module.exports={apply,MARKER};