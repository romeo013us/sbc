'use strict';
// SBC V66.141: apply strictly after V66.140; no source-server writes except isolated CI.
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66141_ORDER_DELIVERY_AND_MAPPING_GUARD';
function one(s,from,to,label){const count=s.split(from).length-1;if(count!==1)throw Error('DELIVERY_MAPPING_ANCHOR_MISMATCH:'+label+':'+count);return s.replace(from,()=>to);}
function patchServer(input){
 let s=String(input||'');
 if(s.includes(MARK)){
  if(s.split(MARK).length!==2||!s.includes('BUNDLE_COMPONENT_MAPPING_REQUIRED')||!s.includes("stage==='DELIVERED'"))throw Error('DELIVERY_MAPPING_PARTIAL_STAGE');
  return s;
 }
 if(!s.includes('SBC_V66140_BUNDLE_CLOSE_GATE'))throw Error('DELIVERY_MAPPING_REQUIRES_BUNDLE_GATE');
 s=one(s,"  if(stage==='FULFILLED'){","  // "+MARK+"\n  if(stage==='FULFILLED'||stage==='DELIVERED'){",'delivery-status');
 s=one(s,"   const parts=fulfillmentItemsForOrder(order);\n   if(parts.length>1){",
  "   const parts=fulfillmentItemsForOrder(order);\n   if(SBC_V66140_COVERAGE.needsMapping(order,parts))throw Object.assign(Error('BUNDLE_COMPONENT_MAPPING_REQUIRED'),{code:'BUNDLE_COMPONENT_MAPPING_REQUIRED'});\n   if(parts.length>1){",'catalog-guard');
 s=one(s,"  const components=fulfillmentItemsForOrder(order);\n  let jobs=[];",
  "  const components=fulfillmentItemsForOrder(order);\n  if(SBC_V66140_COVERAGE.needsMapping(order,components))return res.json({ok:true,source:'CATALOG_RECIPE_REQUIRED',...SBC_V66140_COVERAGE.mappingHold(order,components)});\n  let jobs=[];",'catalog-report');
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),raw=fs.readFileSync(file,'utf8'),next=patchServer(raw);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66141_ISOLATED_STAGE!=='YES')throw Error('DELIVERY_MAPPING_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,next);console.log('[SBC V66.141] delivery and catalog mapping guard staged safely');
 }else console.log('[SBC V66.141] preflight PASS; pinned source unchanged');
}
module.exports={patchServer,MARK};
