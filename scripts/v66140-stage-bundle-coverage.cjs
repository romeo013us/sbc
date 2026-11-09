'use strict';
/* SBC V66.140: append a non-invasive bundle coverage gate to an ALREADY V66.138
   protected disposable server. Existing pinned master server is never edited. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66140_BUNDLE_CLOSE_GATE';
function one(s,needle,replacement,label){
 const n=s.split(needle).length-1;
 if(n!==1)throw Error('BUNDLE_GATE_ANCHOR_INVALID:'+label+':'+n);
 return s.replace(needle,()=>replacement);
}
function patchServer(input){
 let s=String(input||'');
 if(s.includes(MARK)){
  if(s.split(MARK).length!==2||!s.includes("app.get('/api/kim400/orders/:id/coverage'")||!s.includes('BUNDLE_CHILD_JOBS_NOT_DELIVERED'))throw Error('BUNDLE_GATE_PARTIAL_STAGE');
  return s;
 }
 if(!s.includes('SBC_V66138_FULFILLMENT_COMMIT_AND_PROVIDER_TRUTH'))throw Error('BUNDLE_GATE_REQUIRES_V66138_DURABILITY');
 const imp="const SBC_V66138_FULFILLMENT_TRUTH=require('./enterprise/v66138-fulfillment-truth.cjs');";
 s=one(s,imp,imp+"\nconst SBC_V66140_COVERAGE=require('./enterprise/v66140-fulfillment-bundle-coverage.cjs'); // "+MARK,'import');
 const before="  snapshot=V400.capture(req.params.id);\n  const result=mutate();";
 const gate=[
 "  if(stage==='FULFILLED'){",
 "   const parts=fulfillmentItemsForOrder(order);",
 "   if(parts.length>1){",
 "    const [jobs]=await mysqlPool.query('SELECT item_id,product,vendor,status,vendor_status,vendor_order_number,tracking_number FROM sbc_fulfillment_jobs WHERE tenant_id=? AND order_id=?',[Number(tenantId),String(order.id)]);",
 "    const coverage=SBC_V66140_COVERAGE.summary({components:parts,jobs});",
 "    if(!coverage.ready)throw Object.assign(Error('BUNDLE_CHILD_JOBS_NOT_DELIVERED: '+coverage.missing.map(x=>x.itemName+' ('+x.reason+')').slice(0,6).join('; ')),{code:'BUNDLE_CHILD_JOBS_NOT_DELIVERED'});",
 "   }",
 "  }"
 ].join("\n");
 s=one(s,before,gate+"\n"+before,'bundle-guard');
 const route=[
 "app.get('/api/kim400/orders/:id/coverage',auth,requireCapability('fulfillment.manage'),async(req,res)=>{",
 " try{",
 "  const tenantId=requireRequestTenant(req);",
 "  const order=v400Orders().find(x=>String(x.id)===String(req.params.id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));",
 "  if(!order)return res.status(404).json({ok:false,error:'FULFILLMENT_ORDER_NOT_FOUND_IN_TENANT'});",
 "  const components=fulfillmentItemsForOrder(order);",
 "  let jobs=[];",
 "  if(components.length>1){",
 "   if(!mysqlPool)return res.status(503).json({ok:false,error:'FULFILLMENT_MYSQL_UNAVAILABLE'});",
 "   const [rows]=await mysqlPool.query('SELECT item_id,product,vendor,status,vendor_status,vendor_order_number,tracking_number FROM sbc_fulfillment_jobs WHERE tenant_id=? AND order_id=?',[Number(tenantId),String(order.id)]);",
 "   jobs=rows||[];",
 "  }",
 "  res.setHeader('Cache-Control','no-store');",
 "  return res.json({ok:true,source:'EXISTING_MYSQL_FULFILLMENT_JOBS',...SBC_V66140_COVERAGE.summary({components,jobs})});",
 " }catch(e){return res.status(503).json({ok:false,error:'FULFILLMENT_COVERAGE_UNAVAILABLE'})}",
 "});"
 ].join("\n");
 const summary="app.get('/api/kim400/summary',auth,";
 s=one(s,summary,route+"\n"+summary,'coverage-route');
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8'),updated=patchServer(source);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66140_ISOLATED_STAGE!=='YES')throw Error('BUNDLE_GATE_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,updated);
  console.log('[SBC V66.140] safely staged tenant-scoped bundle completion gate');
 }else console.log('[SBC V66.140] exact-anchor preflight PASS; source unchanged');
}
module.exports={patchServer,MARK};
