'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6612_NAV_GEOMETRY';
const FILES=['sbc-nav-geometry-v6612.css','sbc-nav-geometry-v6612.js'];
function insertOnce(src,anchor,text,label){
 const hits=src.split(anchor).length-1;
 if(hits!==1)throw Error(MARKER+': '+label+' expected 1 anchor, found '+hits);
 return src.replace(anchor,text+anchor);
}
function apply(root){
 const files=['public/index.html','browser_public/index.html'].filter(rel=>fs.existsSync(path.join(root,rel)));
 if(files.length<1)throw Error(MARKER+': no index entry');
 const htmlChanges=[];
 for(const rel of files){
  const source=fs.readFileSync(path.join(root,rel),'utf8');
  if(source.includes(MARKER)){htmlChanges.push({rel,html:source});continue;}
  let html=insertOnce(source,'</head>','<link rel="stylesheet" href="/sbc-nav-geometry-v6612.css?v=66.1.2">\n','head CSS');
  html=insertOnce(html,'</body>','<script src="/sbc-nav-geometry-v6612.js?v=66.1.2" defer></script>\n<!-- '+MARKER+' -->\n','body JS');
  htmlChanges.push({rel,html});
 }
 for(const name of FILES)if(!fs.existsSync(path.join(__dirname,name)))throw Error(MARKER+': missing '+name);
 for(const dir of ['public','browser_public']){
  if(!fs.existsSync(path.join(root,dir)))continue;
  for(const name of FILES)fs.copyFileSync(path.join(__dirname,name),path.join(root,dir,name));
 }
 for(const x of htmlChanges)fs.writeFileSync(path.join(root,x.rel),x.html);
 return {marker:MARKER,changed:htmlChanges.map(x=>x.rel),databaseChanges:false,recoveryGuardsChanged:false};
}
module.exports={MARKER,apply};
