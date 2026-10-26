'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6662_GODKIM_TENANT_ORDER_GATE';
function patchServer(src){
 if(src.includes(MARKER))throw Error(MARKER+': duplicate');
 const start=src.indexOf("app.post('/api/kim/god/orchestrate/:orderId'");
 const end=src.indexOf("\napp.post('/api/kim/voice/session'",start);
 if(start<0||end<=start||src.indexOf("app.post('/api/kim/god/orchestrate/:orderId'",start+1)!==-1)
  throw Error(MARKER+': unable to isolate GodKim order endpoint');
 let route=src.slice(start,end);
 const a="if(req.user?.role!=='owner')return res.status(403).json({error:'GodKim execution control is reserved for Romeo / owner.'});try{const order=(db.orders||[]).find(o=>String(o.id)===String(req.params.orderId));";
 const c="if(req.user?.role!=='owner')return res.status(403).json({error:'GodKim execution control is reserved for Romeo / owner.'});"+
  "let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}"+
  "try{const order=(db.orders||[]).find(o=>String(o.id)===String(req.params.orderId)&&Number(o.tenantId)===tenantId);";
 if(route.split(a).length!==2)throw Error(MARKER+': missing order authorizer');
 route=route.replace(a,c);
 const send="const c=(db.customers||[]).find(x=>x.id===order.customerId);";
 if(route.split(send).length!==2)throw Error(MARKER+': missing customer status recipient');
 route=route.replace(send,"const c=(db.customers||[]).find(x=>x.id===order.customerId&&Number(x.tenantId)===tenantId);");
 route="// "+MARKER+": an owner route cannot orchestrate another tenant's order or contact.\n"+route;
 const out=src.slice(0,start)+route+src.slice(end);
 new vm.Script(out,{filename:'server.js'});return out;
}
function apply(root){
 const p=path.join(root,'server.js');
 if(!fs.existsSync(p))throw Error(MARKER+': compiled server missing');
 const output=patchServer(fs.readFileSync(p,'utf8'));
 fs.writeFileSync(p,output);
 return {marker:MARKER,files:['server.js'],noPaymentCalls:true,noProductionWrites:true};
}
module.exports={MARKER,patchServer,apply};
