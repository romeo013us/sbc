'use strict';
// Trusted offline reconciliation only: never calls a publish endpoint.
const lock='sbc:runtime:writer:v1',channels=['facebook','instagram','linkedin','google_business'];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),ref=x=>typeof x==='string'&&/^[A-Za-z0-9_:/.-]{1,255}$/.test(x),id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x),slug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const epoch=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x?Date.parse(x):NaN;
const sqlTime=x=>new Date(x).toISOString().replace('T',' ').replace('Z','');
const validSlot=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T(?:10:00|22:00)$/.test(x)&&Number.isFinite(Date.parse(x.slice(0,10)))&&new Date(x.slice(0,10)).toISOString().slice(0,10)===x.slice(0,10);
function createPublicationLedger({conn,tenantId,accounts,assertWriter,loadSubmission,readProviderPost,clock=Date.now}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!accounts||Object.keys(accounts).length<1||Object.entries(accounts).some(([k,v])=>!channels.includes(k)||!ref(v))||!['execute','beginTransaction','commit','rollback','destroy'].every(k=>typeof conn?.[k]==='function')||![assertWriter,loadSubmission,readProviderPost,clock].every(x=>typeof x==='function'))throw Error('INVALID_PUBLICATION_CONFIG');
 const pinned=Object.freeze({...accounts});let busy=false;
 const guard=async()=>{if(await assertWriter()!==true)throw Error('PUBLICATION_WRITER_REQUIRED');};
 const fence=async()=>{await guard();const [[r]]=await conn.execute('SELECT IS_USED_LOCK(?)=CONNECTION_ID() AS held',[lock]);if(Number(r?.held)!==1)throw Error('PUBLICATION_WRITER_REQUIRED');};
 async function insert(sql,args){await guard();const [r]=await conn.execute(sql,args);if(r.affectedRows!==1)throw Error('PUBLICATION_WRITE_NOT_CONFIRMED');}
 async function recordPublication(submissionId){
  if(!id(submissionId)||busy)throw Error('PUBLICATION_REQUEST_INVALID');busy=true;let started=false,committing=false;
  try{
   await guard();const s=Object.freeze({...await loadSubmission({tenantId,submissionId})}),submitted=epoch(s.submittedAt),verified=epoch(s.verifiedAt),before=clock();
   if(s.tenantId!==tenantId||s.submissionId!==submissionId||!Object.hasOwn(pinned,s.channel)||s.accountRef!==pinned[s.channel]||!ref(s.postRef)||!ref(s.mediaRef)||!slug(s.slug)||!validSlot(s.slotLocal)||!['square','landscape','portrait'].includes(s.format)||!Number.isInteger(s.revision)||s.revision<1||s.revision>4294967295||![s.sha256,s.sourceAssetId,s.logoSha256,s.manifestSha256].every(hash)||!Number.isFinite(submitted)||!Number.isFinite(verified)||!Number.isSafeInteger(before)||submitted>before||verified>submitted||submitted-verified>3600000)throw Error('PUBLICATION_SUBMISSION_INVALID');
   const p=await readProviderPost({channel:s.channel,accountRef:s.accountRef,postRef:s.postRef}),published=epoch(p?.publishedAt),observed=clock();
   if(!p||p.channel!==s.channel||p.accountRef!==s.accountRef||p.postRef!==s.postRef||p.mediaRef!==s.mediaRef||p.status!=='published'||!Number.isFinite(published)||!Number.isSafeInteger(observed)||observed<before||published<submitted||published>observed)throw Error('PUBLICATION_PROVIDER_INVALID');
   await fence();await conn.beginTransaction();started=true;
   // Persist the immutable evidence even if a review was revoked AFTER submission. No permission to publish again.
   await insert('INSERT INTO sbc_core_marketing_publication_receipts (tenant_id,channel,account_ref,slot_local,submission_id,provider_post_ref,provider_media_ref,slug,format,revision,sha256,source_asset_id,manifest_sha256,verified_at,submitted_at,published_at,observed_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM sbc_core_marketing_inventory i JOIN sbc_core_marketing_readbacks r ON r.tenant_id=i.tenant_id AND r.slug=i.slug AND r.format=i.format AND r.revision=i.revision AND r.sha256=i.sha256 WHERE i.tenant_id=? AND i.slug=? AND i.format=? AND i.revision=? AND i.sha256=? AND i.source_asset_id=? AND i.logo_sha256=? AND i.final_approved_sha256=i.sha256 AND i.final_approved_at<=? AND r.verified_at=? AND r.manifest_sha256=? AND IS_USED_LOCK(?)=CONNECTION_ID()',
    [tenantId,s.channel,s.accountRef,s.slotLocal,submissionId,s.postRef,s.mediaRef,s.slug,s.format,s.revision,s.sha256,s.sourceAssetId,s.manifestSha256,sqlTime(verified),sqlTime(submitted),sqlTime(published),sqlTime(observed),tenantId,s.slug,s.format,s.revision,s.sha256,s.sourceAssetId,s.logoSha256,sqlTime(submitted),sqlTime(verified),s.manifestSha256,lock]);
   await insert('INSERT INTO sbc_core_marketing_source_history (tenant_id,channel,provider_post_ref,source_asset_id,sha256,observed_at) SELECT ?,?,?,?,?,? FROM DUAL WHERE IS_USED_LOCK(?)=CONNECTION_ID()',[tenantId,s.channel,s.postRef,s.sourceAssetId,s.sha256,sqlTime(observed),lock]);
   await insert('INSERT INTO sbc_core_campaign_registry (tenant_ref,channel,campaign_slug,asset_sha256,provider_post_ref,published_at) SELECT ?,?,?,?,?,? FROM DUAL WHERE IS_USED_LOCK(?)=CONNECTION_ID()',['sbc:'+tenantId,s.channel,s.slug,s.sha256,s.postRef,sqlTime(published),lock]);
   await fence();committing=true;await conn.commit();started=false;return {status:'PUBLICATION_RECORDED',postRef:s.postRef,publicationReady:false};
  }catch(e){
   if(committing||['SBC_MYSQL_AMBIGUOUS_WRITE','ECONNRESET','ETIMEDOUT','PROTOCOL_CONNECTION_LOST','EPIPE'].includes(e?.code)||e?.fatal){conn.destroy();throw Object.assign(Error('PUBLICATION_COMMIT_UNCONFIRMED',{cause:e}),{code:'PUBLICATION_COMMIT_UNCONFIRMED'});}
   if(started){try{await conn.rollback();}catch(cause){conn.destroy();throw Object.assign(Error('PUBLICATION_COMMIT_UNCONFIRMED',{cause}),{code:'PUBLICATION_COMMIT_UNCONFIRMED'});}}
   throw e;
  }finally{busy=false;}
 }
 return Object.freeze({recordPublication});
}
module.exports={createPublicationLedger};
