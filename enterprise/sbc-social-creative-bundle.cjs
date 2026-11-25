'use strict';
// Signed by the trusted offline renderer/operator. Hosted import needs Node crypto
// only; it verifies byte identity, signed metadata and slot identity, not pixels
// independently. The signer must use the real renderer's calculated dHash.
const crypto=require('node:crypto');
const {slots}=require('./sbc-social-asset-engine.cjs');
const MAX_TOTAL=5*1024*1024,MAX_IMAGE=2*1024*1024,MAX_MANIFEST=64*1024;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code)};
const hex=(s,n)=>typeof s==='string'&&s.length===n&&/^[a-f0-9]+$/.test(s);
function base64(s,limit,code){
 if(typeof s!=='string'||s.length>Math.ceil(limit/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))fail(code);
 const b=Buffer.from(s,'base64');if(b.length>limit||b.toString('base64')!==s)fail(code);return b;
}
function pngDimensions(png){
 if(!Buffer.isBuffer(png)||png.length<33||png.length>MAX_IMAGE||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(8)!==13||png.toString('ascii',12,16)!=='IHDR')fail('CREATIVE_BUNDLE_IMAGE');
 return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}
function metadata(row){
 const {key,at,hour,day,sha256,dhash,width,height,service,caption}=row||{};
 if(!hex(sha256,64)||!hex(dhash,16)||!['1080x1080','1200x630'].includes(width+'x'+height)||!['Websites','Hosting','Printing','Office Box','SEO','Notary'].includes(service)||typeof caption!=='string'||!caption.trim()||caption.length>1000)fail('CREATIVE_BUNDLE_METADATA');
 if(typeof day!=='string'||!slots(day).some(s=>s.key===key&&s.at===at&&s.hour===hour))fail('CREATIVE_BUNDLE_SLOT');
 return {key,at,hour,day,sha256,dhash,width,height,service,caption};
}
function checkRows(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>14)fail('CREATIVE_BUNDLE_METADATA');
 const result=rows.map(metadata);
 if(new Set(result.map(r=>r.key)).size!==result.length||new Set(result.map(r=>r.sha256)).size!==result.length)fail('CREATIVE_BUNDLE_DUPLICATE');
 return result;
}
function checkImage(row,png){
 const d=pngDimensions(png);
 if(hash(png)!==row.sha256||d.width!==row.width||d.height!==row.height)fail('CREATIVE_BUNDLE_IMAGE');
}
function keyOf(key,type){
 try{
  const k=key instanceof crypto.KeyObject?key:(type==='private'?crypto.createPrivateKey(key):crypto.createPublicKey(key));
  if(k.type!==type||k.asymmetricKeyType!=='ed25519')fail('CREATIVE_BUNDLE_KEY_REQUIRED');
  return k;
 }catch{fail('CREATIVE_BUNDLE_KEY_REQUIRED');}
}
function createBundle(rows,{tenantId,privateKey,now=Date.now()}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!Number.isFinite(now))fail('CREATIVE_BUNDLE_TENANT');
 const assets=checkRows(rows),files={};let total=0;
 for(const [i,row] of assets.entries()){
  const png=rows[i].png;checkImage(row,png);
  total+=png.length;if(total>MAX_TOTAL)fail('CREATIVE_BUNDLE_SIZE');
  files[row.sha256]=png.toString('base64');
 }
 const manifest=JSON.stringify({version:1,tenantId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),assets});
 const signature=crypto.sign(null,Buffer.from(manifest),keyOf(privateKey,'private')).toString('base64');
 return {manifest,signature,files};
}
function verifyBundle(bundle,{tenantId,publicKey,now=Date.now()}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!Number.isFinite(now))fail('CREATIVE_BUNDLE_TENANT');
 if(!bundle||typeof bundle.manifest!=='string'||Buffer.byteLength(bundle.manifest)>MAX_MANIFEST)fail('CREATIVE_BUNDLE_METADATA');
 const signature=base64(bundle.signature,64,'CREATIVE_BUNDLE_SIGNATURE');
 if(signature.length!==64||!crypto.verify(null,Buffer.from(bundle.manifest),keyOf(publicKey,'public'),signature))fail('CREATIVE_BUNDLE_SIGNATURE');
 let manifest;try{manifest=JSON.parse(bundle.manifest);}catch{fail('CREATIVE_BUNDLE_METADATA');}
 if(manifest.version!==1||manifest.tenantId!==tenantId)fail('CREATIVE_BUNDLE_TENANT');
 const created=Date.parse(manifest.createdAt),expires=Date.parse(manifest.expiresAt);
 if(!Number.isFinite(created)||!Number.isFinite(expires)||created>now+60000||expires<=now||expires-created!==86400000)fail('CREATIVE_BUNDLE_EXPIRED');
 const assets=checkRows(manifest.assets);
 if(!bundle.files||typeof bundle.files!=='object'||Array.isArray(bundle.files)||Object.keys(bundle.files).length!==assets.length)fail('CREATIVE_BUNDLE_IMAGE');
 let total=0;const verified=new Map();
 const rows=assets.map(row=>{
  if(!Object.hasOwn(bundle.files,row.sha256))fail('CREATIVE_BUNDLE_IMAGE');
  const png=base64(bundle.files[row.sha256],MAX_IMAGE,'CREATIVE_BUNDLE_IMAGE');
  total+=png.length;if(total>MAX_TOTAL)fail('CREATIVE_BUNDLE_SIZE');checkImage(row,png);
  verified.set(row.sha256,{width:row.width,height:row.height,dhash:row.dhash});
  return {...row,png,state:'DRAFT'};
 });
 return {rows,verifyPng(png){const p=verified.get(hash(png));if(!p)fail('CREATIVE_BUNDLE_IMAGE');return {...p};}};
}
module.exports={createBundle,verifyBundle};
