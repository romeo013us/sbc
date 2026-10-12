'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6530_WRITER_LEASE_MARKER_FIX';
const LEASE='SBC_V6528_RUNTIME_WRITER_LEASE';
function apply(root){
 const serverPath=path.join(root,'server.js');
 let source=fs.readFileSync(serverPath,'utf8');
 if(!source.includes(LEASE)) throw new Error(MARKER+': expected writer-lease patch missing');
 const bad="'['+MARKER+']";
 const count=source.split(bad).length-1;
 if(count>0) source=source.split(bad).join("'["+LEASE+"]");
 if(source.includes(bad)) throw new Error(MARKER+': unresolved dynamic MARKER reference remains');
 if(!source.includes("'["+LEASE+"] process writer lease acquired")) throw new Error(MARKER+': writer-lease log repair not applied');
 fs.writeFileSync(serverPath,source);
 return {marker:MARKER,repairedMarkerReferences:count};
}
module.exports={apply,MARKER};
