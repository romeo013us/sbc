'use strict';
// Review events are separate from immutable rendered media. Only a trusted
// owner-authenticated route supplies actorId. No publication or billing action.
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const idOK=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const hashOK=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function openReviewStore({filename,queue,service,clock=Date.now}){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||typeof queue?.get!=='function'||typeof service?.get!=='function')throw Error('INVALID_REVIEW_CONFIG');
 const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 db.exec('CREATE TABLE IF NOT EXISTS creative_reviews(tenant INTEGER NOT NULL,project TEXT NOT NULL,job TEXT NOT NULL,asset TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,actor TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(tenant,project,job,version))');
 const args=(s,id)=>{if(!Number.isSafeInteger(s?.tenantId)||s.tenantId<1||!idOK(s.projectId)||!idOK(id))throw Error('INVALID_REVIEW_SCOPE');return [s.tenantId,s.projectId,id];};
 const latest=(s,id)=>db.prepare('SELECT * FROM creative_reviews WHERE tenant=? AND project=? AND job=? ORDER BY version DESC LIMIT 1').get(...args(s,id));
 const view=r=>({state:r.state,version:r.version,assetId:r.asset,actorId:r.actor,reviewedAt:r.at});
 function get(s,id){args(s,id);const job=queue.get(s,id);if(!job)return null;const r=latest(s,id);return r&&job.status==='completed'&&r.asset===job.assetId?view(r):{state:'unreviewed',version:r?.version||0};}
 function history(s,id){args(s,id);if(!queue.get(s,id))return [];return db.prepare('SELECT * FROM creative_reviews WHERE tenant=? AND project=? AND job=? ORDER BY version DESC LIMIT 100').all(...args(s,id)).map(view);}
 async function verified(s,id){const job=queue.get(s,id);if(!job)throw Error('REVIEW_JOB_NOT_FOUND');if(job.status!=='completed'||!hashOK(job.assetId))throw Error('REVIEW_JOB_NOT_READY');const item=await service.get(s,job.assetId),a=item?.asset;if(!a||a.id!==job.assetId||a.tenantId!==s.tenantId||a.projectId!==s.projectId||a.reviewState!=='draft'||!['image/png','video/mp4'].includes(a.mime)||!Buffer.isBuffer(item.bytes)||!item.bytes.length)throw Error('REVIEW_ASSET_INVALID');return item;}
 async function decide(s,id,actor,input){const key=args(s,id);if(!idOK(actor)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['decision','expectedVersion','rightsConfirmed','contentConfirmed'].includes(k))||!['approved','rejected'].includes(input.decision)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||(input.decision==='approved'&&(input.rightsConfirmed!==true||input.contentConfirmed!==true)))throw Error('INVALID_REVIEW');
  const {asset}=await verified(s,id);db.exec('BEGIN IMMEDIATE');try{const job=queue.get(s,id);if(job?.status!=='completed'||job.assetId!==asset.id)throw Error('REVIEW_JOB_NOT_READY');const prior=latest(s,id);if((prior?.version||0)!==input.expectedVersion)throw Error('STALE_REVIEW');const at=clock();if(!Number.isSafeInteger(at)||at<0)throw Error('INVALID_REVIEW_CLOCK');db.prepare('INSERT INTO creative_reviews(tenant,project,job,asset,version,state,actor,at) VALUES(?,?,?,?,?,?,?,?)').run(...key,asset.id,input.expectedVersion+1,input.decision,actor,at);const result=view(latest(s,id));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
 }
 async function exportApproved(s,id){const prior=get(s,id);if(prior?.state!=='approved')throw Error('REVIEW_REQUIRED');const item=await verified(s,id);const current=get(s,id);if(current?.state!=='approved'||current.version!==prior.version||current.assetId!==item.asset.id)throw Error('REVIEW_REQUIRED');return item;}
 return Object.freeze({get,history,decide,exportApproved,close:()=>db.close()});
}
module.exports={openReviewStore};
