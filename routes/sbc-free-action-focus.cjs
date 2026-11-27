'use strict';
// Authenticated, read-only, tenant-isolated CRM next actions. Never mutates.
const {planActions,easternToday}=require('../enterprise/sbc-free-action-focus.cjs');
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
     const today=easternToday();
     const windowEnd=new Date(Date.parse(today+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
     // Prioritize older commitments and upcoming dates across the authorized portfolio.
     // Bound the result to 500 planned rows; row 501 is only a truncation sentinel.
     // No command, credentials, phone numbers or private notes leave this route.
     const sql="SELECT id,business_name,phone,status,assigned_to,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND LOWER(TRIM(COALESCE(status,''))) NOT IN ('deleted','archived','duplicate')"+
       (actor.role==='account_manager'?' AND assigned_to=?':'')+
       ' ORDER BY CASE WHEN follow_up <= ? THEN 0 ELSE 1 END, CASE WHEN follow_up <= ? THEN follow_up ELSE NULL END, created_at DESC,id ASC LIMIT 501';
     const args=actor.role==='account_manager'?[tid,String(actor.id),windowEnd,windowEnd]:[tid,windowEnd,windowEnd];
     const [rows]=await ctx.mysqlPool.query(sql,args);
     if(!Array.isArray(rows))throw Error('ACTION_SNAPSHOT_UNAVAILABLE');
     const sample=rows.slice(0,500);
     const result=planActions({tenantId:tid,actor,rows:sample,today,limit});
     return res.json({...result,sampledRecords:sample.length,sourceLimit:500,
       samplePolicy:'DUE_FIRST_BOUNDED',moreRecordsPossible:rows.length>500});
   }catch{
     return res.status(503).json({ok:false,error:'ACTION_SNAPSHOT_UNAVAILABLE'});
   }
 });
 return PATH;
}
module.exports={register,PATH};
