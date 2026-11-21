'use strict';
// Authenticated, read-only, tenant-isolated CRM next actions. Never mutates.
const {planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const PATH='/api/sbc/free-actions/today';
function register(app,{auth,getContext,tenantForRead}={}){
 if(!app||typeof app.get!=='function'||typeof auth!=='function'||
    typeof getContext!=='function'||typeof tenantForRead!=='function')
   throw Error('FREE_ACTIONS_ROUTE_DEPENDENCIES_REQUIRED');
 app.get(PATH,auth,async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   const actor=req.user||{};
   if(!['owner','account_manager'].includes(actor.role)||actor.active===false||!actor.id)
     return res.status(403).json({ok:false,error:'ACTION_ACCESS_DENIED'});
   let tid;
   try{tid=Number(tenantForRead(req))}
   catch{return res.status(403).json({ok:false,error:'TENANT_CONTEXT_REQUIRED'})}
   if(!Number.isSafeInteger(tid)||tid<1)
     return res.status(403).json({ok:false,error:'TENANT_CONTEXT_REQUIRED'});
   const ctx=getContext();
   if(!ctx?.mysqlPool||typeof ctx.mysqlPool.query!=='function')
     return res.status(503).json({ok:false,error:'AUTHORITATIVE_MYSQL_UNAVAILABLE'});
   if(actor.role==='account_manager'){
     // Session role is insufficient without a current authorized staff record.
     const who=(ctx.db?.users||[]).find(u=>String(u.id)===String(actor.id)&&
       String(u.role)==='account_manager'&&u.active!==false&&
       Number(u.tenantId??u.tenant_id)===tid);
     if(!who)return res.status(403).json({ok:false,error:'STAFF_ACCESS_UNVERIFIED'});
   }
   const limit=req.query?.limit===undefined?12:Number(req.query.limit);
   if(!Number.isSafeInteger(limit)||limit<1||limit>30)
     return res.status(400).json({ok:false,error:'ACTION_LIMIT_INVALID'});
   try{
     // No command, credentials, phone numbers or private notes leave this route.
     const sql="SELECT id,business_name,phone,status,assigned_to,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted'"+
       (actor.role==='account_manager'?' AND assigned_to=?':'')+
       ' ORDER BY created_at DESC,id ASC LIMIT 500';
     const args=actor.role==='account_manager'?[tid,String(actor.id)]:[tid];
     const [rows]=await ctx.mysqlPool.query(sql,args);
     const result=planActions({tenantId:tid,actor,rows,limit});
     return res.json({...result,sampledRecords:rows.length,sourceLimit:500,
       moreRecordsPossible:rows.length===500});
   }catch{
     return res.status(503).json({ok:false,error:'ACTION_SNAPSHOT_UNAVAILABLE'});
   }
 });
 return PATH;
}
module.exports={register,PATH};
