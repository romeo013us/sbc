'use strict';
// Offline readback only. No approval, upload, or publication authority.
const {createHash}=require('node:crypto'),fs=require('node:fs/promises');
const hash=b=>createHash('sha256').update(b).digest('hex'),isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const destination='https://sbcmia.com/assets/social/campaigns/';
function validate(manifest){
 if(!exact(manifest,['schemaVersion','publicationReady','entries'])||manifest.schemaVersion!==1||manifest.publicationReady!==false||!Array.isArray(manifest.entries)||manifest.entries.length<1||manifest.entries.length>3)throw Error('INVALID_SOCIAL_MANIFEST');
 const seen=new Set();for(const e of manifest.entries){if(!exact(e,['sha256','url','alt','mime','width','height','bytes'])||!isHash(e.sha256)||e.url!==destination+e.sha256+'.jpg'||e.mime!=='image/jpeg'||e.width!==1080||e.height!==1080||!Number.isSafeInteger(e.bytes)||e.bytes<10000||e.bytes>4*1024*1024||typeof e.alt!=='string'||!e.alt.trim()||e.alt.length>180||/[\x00-\x1f\x7f]/.test(e.alt)||seen.has(e.sha256))throw Error('INVALID_SOCIAL_ENTRY');seen.add(e.sha256);}
 return JSON.parse(JSON.stringify(manifest));
}
async function readback(e,transport){
 const signal=AbortSignal.timeout(15000);const response=await transport(e.url,{method:'GET',redirect:'error',signal,cache:'no-store',headers:{Accept:'image/jpeg','Cache-Control':'no-cache'}});
 if(response.status!==200||response.redirected||(response.url&&response.url!==e.url)||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='image/jpeg'||!response.body){await response.body?.cancel();throw Error('SOCIAL_HTTP_INVALID');}
 const reader=response.body.getReader();let count=0;const chunks=[];
 try{for(;;){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>e.bytes)throw Error('SOCIAL_SIZE_MISMATCH');chunks.push(Buffer.from(value));}}
 catch(err){await reader.cancel().catch(()=>{});throw err;}finally{reader.releaseLock();}
 const b=Buffer.concat(chunks);if(count!==e.bytes||b.readUInt16BE(0)!==0xffd8||b.readUInt16BE(b.length-2)!==0xffd9||hash(b)!==e.sha256)throw Error('SOCIAL_DIGEST_MISMATCH');
 return {...e,verifiedAt:new Date().toISOString()};
}
async function verifySocialDeploy(input,{transport=fetch}={}){
 const manifest=validate(input),entries=[];for(const e of manifest.entries)entries.push(await readback(e,transport));
 return {schemaVersion:1,manifestSha256:hash(JSON.stringify(manifest)),mediaVerified:true,publicationReady:false,entries};
}
function buildCampaignLink({channel,campaignSlug,assetSha256}){
 if(!['facebook','instagram','linkedin','google_business'].includes(channel)||typeof campaignSlug!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaignSlug)||!isHash(assetSha256))throw Error('INVALID_ATTRIBUTION_INPUT');
 const url=new URL('https://sbcmia.com/');url.search=new URLSearchParams({utm_source:channel,utm_medium:'organic_social',utm_campaign:campaignSlug,utm_content:assetSha256});return url.href;
}
if(require.main===module){(async()=>{if(process.argv.length!==3)throw Error('Usage: node scripts/verify-social-deploy.cjs candidate-manifest.json');const p=process.argv[2],s=await fs.stat(p);if(!s.isFile()||s.size>16384)throw Error('INVALID_SOCIAL_MANIFEST');const r=await verifySocialDeploy(JSON.parse(await fs.readFile(p,'utf8')));console.log(JSON.stringify(r,null,2));})().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={verifySocialDeploy,buildCampaignLink};
