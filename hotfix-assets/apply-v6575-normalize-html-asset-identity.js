'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6575_NORMALIZE_HTML_ASSET_IDENTITY';
const LEGACY=/([?&]v=)65\.1\.61(?=([&#"'\s]|$))/g;
function apply(root){
 let changed=[];
 for(const rel of ['public/index.html','browser_public/index.html']){
  const file=path.join(root,rel);
  if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8');
  const after=before.replace(LEGACY,'$1'+require('../package.json').version);
  if(after!==before){fs.writeFileSync(file,after);changed.push(rel);}
 }
 if(!changed.length){
  const files=['public/index.html','browser_public/index.html'].map(p=>path.join(root,p)).filter(fs.existsSync);
  if(!files.length)throw Error(MARKER+': no HTML entrypoint found');
  if(files.some(f=>/[?&]v=65\.1\.61(?=[&#"'\s]|$)/.test(fs.readFileSync(f,'utf8'))))throw Error(MARKER+': stale asset query remained after normalization');
 }
 return {marker:MARKER,changed};
}
module.exports={apply,MARKER};
