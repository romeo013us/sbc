'use strict';
/* SBC Account + Social: optional integration with the existing CRM and session.
 * No migrations, timers, provider calls or automatic routes on require().
 * Global role/auth policy must separately permit account_manager before login rollout.
 */
const {createMysqlRepository}=require('../enterprise/sbc-account-social-mysql.cjs');
const {createService}=require('../enterprise/sbc-account-social-core.cjs');
const {createMetaProvider}=require('../enterprise/sbc-account-social-meta.cjs');
const {registerAccountSocialRoutes}=require('./sbc-account-social-v1.cjs');
const {createMysqlHandoffRepository}=require('../enterprise/sbc-lorna-handoff-mysql-v1.cjs');
const {createHandoffService}=require('../enterprise/sbc-lorna-handoff-v1.cjs');
const {registerHandoffRoutes}=require('./sbc-lorna-handoff-v1.cjs');
const {requireTenantContext}=require('../enterprise/tenant-context.cjs');
function projectLeadEvidence(row){
 // Project the existing CRM's authoritative JSON fields. Missing or corrupt
 // evidence is always unverified; never infer verification from a display label.
 let evidence={};try{const raw=row.lead_intelligence_json;evidence=typeof raw==='string'?JSON.parse(raw):raw||{}}catch{}
 return {...row,tenantId:Number(row.tenant_id),leadAssistStatus:String(evidence.autoVerificationStatus||evidence.leadAssistStatus||''),
  verificationStatus:String(evidence.verificationStatus||''),doNotContact:evidence.doNotContact===true,salesSuppressed:evidence.salesSuppressed===true};
}
function registerAccountSocialIntegration(app,{
 enabled=false,auth,getContext,resolveSessionActor=req=>req.user,
 requireTenant=requireTenantContext,isWriterReady=()=>false,resolveSecret=null,
 publishingEnabled=false,fetchImpl,clock
}={}){
 if(!enabled)return false;
 if(typeof auth!=='function')throw Error('AUTH_MIDDLEWARE_REQUIRED');
 if(typeof getContext!=='function')throw Error('RUNTIME_CONTEXT_PROVIDER_REQUIRED');
 if(typeof requireTenant!=='function')throw Error('TENANT_CONTEXT_PROVIDER_REQUIRED');
 const getPool=()=>{const pool=getContext()?.mysqlPool;if(!pool||typeof pool.query!=='function')throw Error('MYSQL_WRITER_UNAVAILABLE');return pool};
 // The pool reference is late-bound: the existing Command Center owns DB lifecycle.
 const pool={query:(sql,args)=>getPool().query(sql,args),getConnection:()=>{const p=getPool();if(typeof p.getConnection!=='function')throw Error('TRANSACTIONAL_MYSQL_WRITER_REQUIRED');return p.getConnection();}};
 const projectCustomerEvidence=projectLeadEvidence;
 const lookupCustomer=async(t,id)=>{
  const [rows]=await pool.query('SELECT id,tenant_id,business_name AS businessName,status,phone,assigned_to AS assignedTo,lead_intelligence_json FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[t,id]);
  return rows[0]?projectCustomerEvidence(rows[0]):null;
 };
 const lookupWorker=async(t,id)=>{
  const ctx=getContext();
  const users=ctx?.db?.users||ctx?.users||ctx?.v9?.users;
  if(!Array.isArray(users))return null; // fail closed until authoritative worker reader is connected
  const worker=users.find(x=>String(x.id)===String(id)&&Number(x.tenantId??x.tenant_id)===Number(t));
  return worker||null;
 };
 const repository=createMysqlRepository({pool,lookupCustomer,lookupWorker});
 const provider=createMetaProvider({fetchImpl,resolveSecret:typeof resolveSecret==='function'?resolveSecret:async()=>{throw Error('SOCIAL_SECRET_BRIDGE_NOT_CONFIGURED')}});
 const writerReady=()=>isWriterReady()===true;
 const service=createService({repository,provider,clock,publishingEnabled:publishingEnabled===true,writerReady});
 const resolveActor=req=>{
  const identity=resolveSessionActor(req),tenant=requireTenant();
  const tid=Number(tenant?.tenantId),uid=String(identity?.id||'');
  if(!Number.isSafeInteger(tid)||tid<1||!uid||!identity?.role||Number(identity?.tenantId??tid)!==tid)throw Object.assign(Error('AUTHENTICATED_CONTEXT_REQUIRED'),{code:'AUTHENTICATED_CONTEXT_REQUIRED'});
  return {tenantId:tid,id:uid,role:String(identity.role)};
 };
 registerAccountSocialRoutes(app,{enabled:true,service,auth,resolveActor,writeReady:writerReady});
 const handoffRepository=createMysqlHandoffRepository({pool,lookupCustomer,lookupWorker});
 const handoffService=createHandoffService({repository:handoffRepository,clock});
 registerHandoffRoutes(app,{enabled:true,service:handoffService,auth,resolveActor,writeReady:writerReady});
 return {routesEnabled:true,publishingEnabled:publishingEnabled===true,service,handoffService};
}
module.exports={registerAccountSocialIntegration,projectCustomerEvidence:projectLeadEvidence};
