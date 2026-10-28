'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6632_REMOVE_FLOATING_LEAD_IMPORT';
const BANNER='<style id="sbc-v6632-no-floating-import">/* '+MARKER+' */ #sbc-lead-import-launcher,#sbc-master-list-launcher,#sbc-lead-import-overlay{display:none!important}</style>';
function apply(root){
 const files=['public/index.html','browser_public/index.html'],changes=[];
 let scriptFound=0;
 for(const rel of files){
  const p=path.join(root,rel);
  if(!fs.existsSync(p))throw Error(MARKER+': missing '+rel);
  let html=fs.readFileSync(p,'utf8');
  if(html.includes(MARKER))throw Error(MARKER+': already applied in '+rel);
  const script=/<script\b[^>]*\bsrc=["']\/sbc-lead-import-v6541\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;
  const matches=[...html.matchAll(script)];scriptFound+=matches.length;
  if(matches.length>1)throw Error(MARKER+': multiple importer script tags in '+rel);
  html=html.replace(script,'');
  if(!html.includes('</head>'))throw Error(MARKER+': no head in '+rel);
  html=html.replace('</head>',BANNER+'\n</head>');
  fs.writeFileSync(p,html);changes.push(rel);
 }
 if(scriptFound!==1)throw Error(MARKER+': expected exactly one active floating-import script, found '+scriptFound);
 for(const rel of ['public/sw.js','browser_public/sw.js']){
  const p=path.join(root,rel);if(!fs.existsSync(p))continue;
  let sw=fs.readFileSync(p,'utf8');const re=/const CACHE=['"][^'"]+['"]/;
  if(!re.test(sw))throw Error(MARKER+': cache tag absent '+rel);
  sw=sw.replace(re,"const CACHE='sbc-static-v66-32-no-floating-import'");
  fs.writeFileSync(p,sw);changes.push(rel);
 }
 // Prospect CSVs must never be bundled into public runtime assets.\n // The authenticated manual CSV importer remains available.\n const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 if(index.includes('/sbc-lead-import-v6541.js'))throw Error(MARKER+': legacy modal still launches');
 return {marker:MARKER,changed:changes,legacyFloatingImportDisabled:true,masterLeadsPreserved:false,manualOwnerCsvUpload:true,crmWrites:false,autoImport:false,recoveryGatesUnchanged:true};
}
module.exports={apply,MARKER};