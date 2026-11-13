'use strict';
/* Single-source-of-truth for GoDaddy ZIP member selection.
 * CI may enumerate the repository with Python, but Node's audited
 * release policy decides inclusion. This avoids duplicate exclusion rules.
 * Source documents are never deleted; only deployment packages are trimmed.
 */
const fs=require('node:fs');
const {excludedReleasePath}=require('../enterprise/v66155-public-asset-policy.cjs');

function selectReleaseFiles(candidates){
 if(!Array.isArray(candidates))throw Error('SBC_RELEASE_SELECTOR_INVALID_INPUT: expected array');
 const seen=new Set(),out=[];
 for(const value of candidates){
  if(typeof value!=='string'||!value||value.includes('\\')||value.includes('\0')||
    value.startsWith('/')||value.split('/').some(x=>!x||x==='.'||x==='..')){
    throw Error('SBC_RELEASE_SELECTOR_INVALID_PATH: '+String(value));
  }
  if(seen.has(value))throw Error('SBC_RELEASE_SELECTOR_DUPLICATE: '+value);
  seen.add(value);
  if(!excludedReleasePath(value))out.push(value);
 }
 return out.sort();
}
if(require.main===module){
 try{
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  process.stdout.write(JSON.stringify(selectReleaseFiles(input))+'\n');
 }catch(error){
  console.error(error?.message||error);
  process.exitCode=1;
 }
}
module.exports={selectReleaseFiles};
