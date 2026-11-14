'use strict';
/* SBC multi-client Meta adapter. No direct outbound traffic until injected into
 * a production service with account-scoped vault resolution and owner approval.
 * Does not create tokens or request new permissions; Meta authorization is external.
 */
const {setTimeout:delay}=require('node:timers/promises');
function err(code){throw Object.assign(new Error(code),{code});}
function createMetaProvider({resolveSecret,fetchImpl=globalThis.fetch,graphVersion='v26.0',sleep=ms=>delay(ms)}={}){
 if(typeof resolveSecret!=='function'||typeof fetchImpl!=='function')throw new TypeError('vault resolver and fetch required');
 if(!/^v\d{1,3}\.\d{1,2}$/.test(graphVersion))throw new TypeError('version must match vNN.N');
 const graph='https://graph.facebook.com/'+graphVersion;
 async function auth(tenantId,customerId,platform,secretRef){
  if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<1||!customerId||!['facebook','instagram'].includes(platform)||!/^vault:/.test(String(secretRef||'')))err('META_AUTH_CONTEXT_INVALID');
  const token=await resolveSecret({tenantId,customerId,platform,secretRef});
  if(typeof token!=='string'||token.length<12)err('META_CHANNEL_NOT_CONNECTED');
  return token;
 }
 async function request(token,accountId,edge,{method='GET',form=null,params=null}={}){
  if(!/^[A-Za-z0-9_]{1,200}$/.test(String(accountId||'')))err('META_PROVIDER_ID_INVALID');
  const endpoint=graph+'/'+encodeURIComponent(accountId)+(edge?'/'+edge:'');
  const url=new URL(endpoint);if(params)for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  let response;
  try{response=await fetchImpl(url.toString(),{method,headers:{Authorization:'Bearer '+token,...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(form?{body:new URLSearchParams(form)}:{}),signal:AbortSignal.timeout(12000)});}catch{err('META_NETWORK_OUTCOME_UNKNOWN');}
  if(!response||typeof response.json!=='function')err('META_RESPONSE_INVALID');
  const result=await response.json().catch(()=>({}));
  if(!response.ok)err('META_HTTP_'+String(response.status||'UNKNOWN').replace(/[^0-9]/g,''));
  return result;
 }
 async function verify({tenantId,customerId,platform,providerAccountId,secretRef}={}){
  const token=await auth(tenantId,customerId,platform,secretRef);
  const d=await request(token,providerAccountId,'',{params:{fields:platform==='instagram'?'id,username':'id,name'}});
  return {verified:Boolean(d.id)&&String(d.id)===String(providerAccountId),providerAccountId:String(d.id||'')};
 }
 async function publish({tenantId,customerId,channel,post}={}){
  if(!channel||channel.tenantId!==Number(tenantId)||channel.customerId!==customerId||channel.status!=='VERIFIED'||channel.platform!==post?.platform||channel.id!==post.channelId||post.customerId!==customerId||post.tenantId!==Number(tenantId)||!post.approvedAt)err('META_CHANNEL_POST_MISMATCH');
  const token=await auth(tenantId,customerId,channel.platform,channel.secretRef);
  const platform=channel.platform,id=channel.providerAccountId;
  if(platform==='facebook'){
   const form={message:String(post.body||'')};if(post.ctaUrl)form.link=String(post.ctaUrl);
   const d=await request(token,id,'feed',{method:'POST',form});if(!d.id)err('META_REMOTE_ID_MISSING');return {id:String(d.id)};
  }
  if(platform==='instagram'){
   if(!/^https:\/\/[^\s]+$/i.test(String(post.mediaUrl||'')))err('META_INSTAGRAM_MEDIA_REQUIRED');
   const container=await request(token,id,'media',{method:'POST',form:{image_url:post.mediaUrl,caption:String(post.body||'')}});
   if(!container.id)err('META_IG_CONTAINER_MISSING');
   let ready=false;
   for(let i=0;i<5;i++){
    const s=await request(token,String(container.id),'',{params:{fields:'status_code'}});
    if(s.status_code==='FINISHED'){ready=true;break;}
    if(s.status_code==='ERROR'||s.status_code==='EXPIRED')err('META_IG_CONTAINER_FAILED');
    if(i<4)await sleep(1000);
   }
   if(!ready)err('META_IG_CONTAINER_UNCERTAIN');
   const d=await request(token,id,'media_publish',{method:'POST',form:{creation_id:String(container.id)}});
   if(!d.id)err('META_REMOTE_ID_MISSING');return {id:String(d.id)};
  }
  err('META_PLATFORM_INVALID');
 }
 return {verify,publish};
}
module.exports={createMetaProvider};
