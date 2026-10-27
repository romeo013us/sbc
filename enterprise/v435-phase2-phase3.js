'use strict';
const crypto=require('crypto');

const VERSION='43.5.0';
const now=()=>new Date().toISOString();
const b64u=v=>Buffer.from(v).toString('base64url');
const unb64u=v=>Buffer.from(String(v),'base64url');

function key(env=process.env){
  const raw=String(env.SBC_TENANT_CONTEXT_KEY||env.SBC_SESSION_SECRET||'').trim();
  if(!raw) throw new Error('SBC_TENANT_CONTEXT_KEY or SBC_SESSION_SECRET is required.');
  return crypto.createHash('sha256').update(raw).digest();
}
function signTenantContext({tenantId,actorId,role,issuedAt=Date.now(),ttlMs=300000},env=process.env){
  const body={v:1,tenantId:Number(tenantId),actorId:String(actorId||''),role:String(role||''),iat:Number(issuedAt),exp:Number(issuedAt)+Number(ttlMs)};
  if(!Number.isSafeInteger(body.tenantId)||body.tenantId<1)throw new Error('Invalid tenant context.');
  const payload=b64u(JSON.stringify(body));
  const sig=crypto.createHmac('sha256',key(env)).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyTenantContext(token,env=process.env,at=Date.now()){
  try{
    const [payload,sig]=String(token||'').split('.');
    if(!payload||!sig)return {ok:false,reason:'Malformed tenant context.'};
    const expected=crypto.createHmac('sha256',key(env)).update(payload).digest();
    const supplied=Buffer.from(sig,'base64url');
    if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return {ok:false,reason:'Invalid tenant context signature.'};
    const body=JSON.parse(unb64u(payload).toString('utf8'));
    if(body.v!==1||Number(body.exp)<=Number(at)||Number(body.iat)>Number(at)+30000)return {ok:false,reason:'Expired or invalid tenant context.'};
    return {ok:true,context:body};
  }catch(e){return {ok:false,reason:'Invalid tenant context.'};}
}

const UNSAFE=/^\s*(drop|truncate|alter|grant|revoke|create|rename|delete)\b/i;
const TABLE=/\b(from|join|update|into|delete\s+from)\s+([a-zA-Z0-9_]+)/ig;
function tables(sql){const out=[];let m;while((m=TABLE.exec(String(sql||''))))out.push(m[2]);return [...new Set(out.map(x=>x.toLowerCase()))];}
function hasTenantPredicate(sql){return /\btenant_id\s*=\s*(\?|:\w+|\$\d+|\d+)(?:\s|$|[),])/i.test(String(sql||''));}
function injectTenantPredicate(sql){
  const s=String(sql||'').trim().replace(/;\s*$/,'');
  if(/\bwhere\b/i.test(s)) return `${s} AND tenant_id = ?`;
  return `${s} WHERE tenant_id = ?`;
}
function tenantGuard(sql,params,context,{mode='strict'}={}){
  const text=String(sql||'').trim();
  if(!text)throw new Error('Empty SQL is not permitted.');
  if(UNSAFE.test(text))throw new Error('Destructive SQL is blocked by the tenant query shield.');
  const ts=tables(text);
  const tenantTables=ts.filter(t=>t.startsWith('sbc_'));
  if(!tenantTables.length)return {sql:text,params:Array.isArray(params)?params:[],tables:ts,injected:false,context};
  if(hasTenantPredicate(text))return {sql:text,params:Array.isArray(params)?params:[],tables:ts,injected:false,context};
  if(mode==='inject' && /^(select|update|delete)\b/i.test(text))return {sql:injectTenantPredicate(text),params:[...(Array.isArray(params)?params:[]),context.tenantId],tables:ts,injected:true,context};
  throw new Error('Tenant-scoped SQL must include tenant_id predicate.');
}
async function tenantQuery(pool,sql,params,context,opts={}){
  if(!pool||typeof pool.query!=='function')throw new Error('Database pool is unavailable.');
  const checked=tenantGuard(sql,params,context,opts);
  return pool.query(checked.sql,checked.params);
}

class PartnerCircuitBreaker{
  constructor(providers=[],options={}){
    this.threshold=Math.max(1,Number(options.threshold||3));
    this.cooldownMs=Math.max(1000,Number(options.cooldownMs||30000));
    this.providers=new Map(providers.map(name=>[String(name),{name:String(name),failures:0,state:'CLOSED',openedAt:0,lastError:'',lastSuccessAt:0}]));
  }
  state(name){const p=this.providers.get(String(name));if(!p)return null;if(p.state==='OPEN'&&Date.now()-p.openedAt>=this.cooldownMs){p.state='HALF_OPEN';}return {...p};}
  eligible(order=[]){return order.map(String).filter(n=>{const p=this.state(n);return p&&p.state!=='OPEN';});}
  failure(name,error){const p=this.providers.get(String(name));if(!p)return null;p.failures++;p.lastError=String(error?.message||error||'failure').slice(0,500);if(p.failures>=this.threshold){p.state='OPEN';p.openedAt=Date.now();}return this.state(name);}
  success(name){const p=this.providers.get(String(name));if(!p)return null;p.failures=0;p.state='CLOSED';p.lastError='';p.lastSuccessAt=Date.now();return this.state(name);}
  async execute(preference,handlers){
    const candidates=this.eligible(preference);
    if(!candidates.length)throw new Error('No healthy partner provider is available.');
    const attempts=[];
    for(const name of candidates){
      const fn=handlers?.[name]; if(typeof fn!=='function')continue;
      try{const result=await fn();this.success(name);return {ok:true,provider:name,result,attempts};}
      catch(e){const state=this.failure(name,e);attempts.push({provider:name,error:String(e.message||e),state:state?.state||'UNKNOWN'});}
    }
    throw Object.assign(new Error('All configured partner providers failed.'),{attempts});
  }
  snapshot(){return [...this.providers.keys()].map(n=>this.state(n));}
  restore(snapshot=[]){for(const item of (snapshot||[])){const p=this.providers.get(String(item.name));if(!p)continue;Object.assign(p,{failures:Number(item.failures||0),state:String(item.state||'CLOSED'),openedAt:Number(item.openedAt||0),lastError:String(item.lastError||''),lastSuccessAt:Number(item.lastSuccessAt||0)});}}
}

function readiness(env=process.env){
  const keyReady=Boolean(String(env.SBC_TENANT_CONTEXT_KEY||env.SBC_SESSION_SECRET||'').trim());
  const providers=[
    {name:'4over4',configured:Boolean(env.FOUROVER4_ORDER_ENDPOINT&&env.FOUROVER4_API_KEY)},
    {name:'vistaprint',configured:Boolean(env.VISTAPRINT_ORDER_ENDPOINT&&env.VISTAPRINT_API_KEY)}
  ];
  return {ok:keyReady,version:VERSION,phase2:{partnerCircuitBreaker:true,providers},phase3:{cryptographicTenantContext:keyReady,tenantScopedQueryIngress:true,mysqlNativeRLS:false,note:'MySQL does not provide PostgreSQL-style native row-level security; enforcement is implemented at the application database-ingress layer.'}};
}
module.exports={VERSION,signTenantContext,verifyTenantContext,tenantGuard,tenantQuery,PartnerCircuitBreaker,readiness};
