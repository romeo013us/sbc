'use strict';
/** SBC owner-only Prospect Research Library.
 * Stores approved PUBLIC research packets through existing Command Center writer.
 * No new database schema, no role expansion, no customer edits, no external calls.
 * Deployment durability must be verified on Published writer.
 */
const crypto=require('node:crypto');
const H=require('../public/sbc-prospect-handoff-v2.js');
const PATH='/api/owner/prospect-intelligence/packets';
const ID=/^sbc-handoff-[a-f0-9]{32}$/;
function register(app,{auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation,clock=Date.now}){
 if(typeof getStore!=='function'||typeof saveStore!=='function'||typeof writerReady!=='function'||typeof serializeSiteMutation!=='function')
  throw Error('SBC_PROSPECT_LIBRARY_DURABILITY_REQUIRED');
 const identity=req=>{
  let tenantId;try{tenantId=Number(requireTenant(req))}catch{tenantId=0}
  const ownerId=String(req.user?.id||'').trim();
  return req.user?.role==='owner'&&Number.isSafeInteger(tenantId)&&tenantId>0&&ownerId?{tenantId,ownerId}:null;
 };
 const visible=(all,id)=>all.filter(x=>x&&Number(x.tenantId)===id.tenantId&&String(x.ownerId)===id.ownerId);
 const output=x=>({id:x.id,requestId:x.requestId,packet:x.packet,createdAt:x.createdAt,status:'OWNER_MARKED_RESEARCH_ONLY'});
 app.get(PATH,auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const id=identity(req);if(!id)return res.status(403).json({ok:false,code:'PROSPECT_LIBRARY_OWNER_TENANT_REQUIRED'});
  try{
   const store=getStore(),all=Array.isArray(store?.sbcProspectPacketVault)?store.sbcProspectPacketVault:[];
   return res.json({ok:true,records:visible(all,id).slice(0,25).map(output),permission:'OWNER_ONLY',
    staffAutomaticAccess:false,liveExternalAudit:false});
  }catch{return res.status(503).json({ok:false,code:'PROSPECT_LIBRARY_READ_UNAVAILABLE'})}
 });
 app.post(PATH,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const id=identity(req);if(!id)return res.status(403).json({ok:false,code:'PROSPECT_LIBRARY_OWNER_TENANT_REQUIRED'});
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestId','packet'].includes(k))||
   !ID.test(String(input.requestId||'')))return res.status(422).json({ok:false,code:'PROSPECT_LIBRARY_INPUT_INVALID'});
  let packet;
  try{packet=H.validatePacket(JSON.stringify(input.packet),clock())}
  catch{return res.status(422).json({ok:false,code:'PROSPECT_LIBRARY_PACKET_INVALID'})}
  if(!writerReady())return res.status(423).json({ok:false,code:'PROSPECT_LIBRARY_WRITER_UNAVAILABLE'});
  try{
   const result=await serializeSiteMutation(async()=>{
    if(!writerReady())return {status:423,body:{ok:false,code:'PROSPECT_LIBRARY_WRITER_UNAVAILABLE'}};
    const store=getStore(),all=Array.isArray(store?.sbcProspectPacketVault)?store.sbcProspectPacketVault:[];
    const same=visible(all,id).find(x=>x.requestId===input.requestId);
    if(same){
     if(JSON.stringify(same.packet)!==JSON.stringify(packet))return {status:409,body:{ok:false,code:'PROSPECT_LIBRARY_IDEMPOTENCY_CONFLICT'}};
     return {status:200,body:{ok:true,duplicate:true,record:output(same)}};
    }
    if(all.length>=300&&visible(all,id).length===0)return {status:507,body:{ok:false,code:'PROSPECT_LIBRARY_CAPACITY_REACHED'}};
    const entry={id:'spi-packet-'+crypto.randomUUID(),requestId:input.requestId,
     tenantId:id.tenantId,ownerId:id.ownerId,packet,createdAt:new Date(clock()).toISOString(),status:'OWNER_MARKED_RESEARCH_ONLY'};
    const own=visible(all,id);
    const stale=own.slice(24);const removed=new Set(stale.map(x=>x.id));
    const next=[entry,...all.filter(x=>!removed.has(x.id))];
    if(next.length>300)return {status:507,body:{ok:false,code:'PROSPECT_LIBRARY_CAPACITY_REACHED'}};
    const receipt=await saveStore({...store,sbcProspectPacketVault:next});
    if(receipt?.skipped===true||receipt?.ok===false)throw Error('PROSPECT_LIBRARY_NOT_DURABLE');
    return {status:201,body:{ok:true,record:output(entry),durable:true,notCustomerAction:true}};
   });
   return res.status(result.status).json(result.body);
  }catch{return res.status(503).json({ok:false,code:'PROSPECT_LIBRARY_SAVE_UNVERIFIED'})}
 });
}
module.exports={register,PATH};
