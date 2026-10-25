'use strict';
// V66.26: single owner for the dashboard shell. V66 cockpit CSS and
// v6612 nav geometry own layout; no global DOM reparenting.
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6626_POST_LOAD_LAYOUT_SINGLE_OWNER';
const REMOVALS=['sbc-v6602-layout-containment','sbc-v6572-layout-observer'];
const CSS=[
 '<style id="sbc-v6626-layout-single-owner">',
 '/* '+MARKER+' — one layout owner; no post-hydration DOM reparenting. */',
 '#app.app>.main{min-width:0;max-width:100%;overflow-x:clip;box-sizing:border-box}',
 '#app.app>.main>.content{min-width:0;max-width:100%;box-sizing:border-box}',
 '#app.app>.main>.content>#sbcConsultativeRevenueMount,',
 '#app.app>.main>.content>#sbcGodTierBroadcastMount{display:block;position:relative;float:none;flex:none;clear:both;width:100%;min-width:0;max-width:100%;margin:16px 0;box-sizing:border-box}',
 '@media(max-width:760px){#app.app>.main>.content>#sbcConsultativeRevenueMount,#app.app>.main>.content>#sbcGodTierBroadcastMount{margin:12px 0}}',
 '</style>'
].join('\n');
function apply(root){
 const changed=[];
 for(const rel of ['public/index.html','browser_public/index.html']){
  const f=path.join(root,rel);
  if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);
  let html=fs.readFileSync(f,'utf8');
  if(html.includes(MARKER))throw Error(MARKER+': repeated patch in '+rel);
  for(const id of REMOVALS){
   const re=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])[^>]*>[\\s\\S]*?<\\/script>\\s*','gi');
   const hits=[...html.matchAll(re)];
   if(hits.length!==1)throw Error(MARKER+': expected one '+id+' in '+rel+', found '+hits.length);
   html=html.replace(re,'<!-- '+MARKER+': removed '+id+' (unsafe post-load DOM mutation) -->\n');
  }
  if(!html.includes('sbc-v6601-reference-cockpit.css')||!html.includes('sbc-nav-geometry-v6612.js'))throw Error(MARKER+': missing fixed layout assets '+rel);
  if(!/<\/head>/i.test(html))throw Error(MARKER+': no head boundary in '+rel);
  html=html.replace(/<\/head>/i,CSS+'\n</head>');
  fs.writeFileSync(f,html);
  changed.push(rel);
 }
 for(const rel of ['public/consultative-revenue-v56-13-5.js','public/god-tier-broadcast-v56-13-4.js']){
  const file=path.join(root,rel);
  if(!fs.existsSync(file))throw Error(MARKER+': absent modern revenue module '+rel);
  const src=fs.readFileSync(file,'utf8');
  const expected=rel.includes('consultative')?'SBC_V6603_CONSULTATIVE_SINGLETON':'SBC_V6603_BROADCAST_SINGLETON';
  if(!src.includes(expected)||!src.includes('target.appendChild(el)'))throw Error(MARKER+': modern mount guarantee missing '+rel);
 }
 return {marker:MARKER,changed,crmWrites:false,htmlOnly:true,removedWholeDocumentMutation:true,removedWidthRewriter:true,navGeometryPreserved:true};
}
module.exports={apply,MARKER,REMOVALS};