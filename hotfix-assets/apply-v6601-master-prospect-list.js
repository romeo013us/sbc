'use strict';
// Security retirement: legacy client-side master prospect CSV was available
// from the public web root. The normal authenticated owner CSV upload remains.
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6601_MASTER_PROSPECT_LIST';
const CSV_NAME='sbc-master-prospect-list-2026-10-23.csv';
function apply(root){
 const importer=path.join(root,'public','sbc-lead-import-v6541.js');
 if(!fs.existsSync(importer))throw Error(MARKER+': authenticated importer missing');
 const publicFile=path.join(root,'public',CSV_NAME);
 if(fs.existsSync(publicFile))throw Error(MARKER+': refuse pre-existing public prospect CSV');
 return {marker:MARKER,version:'66.0.1',rows:0,csv:null,
  ui:'public/sbc-lead-import-v6541.js',crmWrites:false,autoImport:false,
  publicProspectExportDisabled:true};
}
module.exports={apply,MARKER,CSV_NAME};
