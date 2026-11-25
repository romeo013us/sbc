'use strict';
// No owner credentials, provider calls, or publish operations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PLAN,IMPORT,sign,isRefillWindow}=require('../enterprise/sbc-creative-importer-auth.cjs');
const {generate}=require('../enterprise/sbc-social-asset-engine.cjs');
const {createBundle}=require('../enterprise/sbc-social-creative-bundle.cjs');
function endpoint(origin,route){
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('HTTPS_HOST_ORIGIN_REQUIRED');
 return new URL(route,u);
}
async function request(origin,route,body,key,fetcher=fetch){
 const r={method:'POST',path:route,body,timestamp:String(Date.now()),nonce:crypto.randomBytes(16).toString('hex')};
 const response=await fetcher(endpoint(origin,route),{method:r.method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','Accept':'application/json','x-sbc-creative-time':r.timestamp,'x-sbc-creative-nonce':r.nonce,'x-sbc-creative-signature':sign(r,key)},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok||result.ok!==true)throw Error('CREATIVE_MACHINE_HTTP_'+response.status);
 return result;
}
async function sync({origin,key,privateKey,logo,fetcher=fetch,render=generate,now=Date.now()}){
 const plan=await request(origin,PLAN,{},key,fetcher);
 if(!Number.isSafeInteger(plan.tenantId)||plan.tenantId<1||!Number.isInteger(plan.approved)||plan.approved<0||!Array.isArray(plan.missing)||!Array.isArray(plan.assets)||plan.missing.length>14)throw Error('INVALID_REFILL_PLAN');
 let staged=0;
 if(plan.missing.length){
  const rows=render({targetSlots:plan.missing,logo,history:plan.assets});
  const bundle=createBundle(rows,{tenantId:plan.tenantId,privateKey,now:Date.now()});
  // An ambiguous response requires a fresh plan; never blindly replay an import.
  const result=await request(origin,IMPORT,bundle,key,fetcher);
  if(result.staged!==rows.length)throw Error('IMPORT_COUNT_UNCONFIRMED');
  staged=result.staged;
 }
 return {staged,approved:plan.approved,low:plan.approved<6,productionCertified:false};
}
async function main(){
 if(process.argv.includes('--scheduled')&&!isRefillWindow(Date.now())){console.log('Outside 06:00 Eastern refill window; no host requests made.');return;}
 const result=await sync({origin:process.env.SBC_HOST_BASE_URL,key:process.env.SBC_CREATIVE_IMPORTER_SECRET,privateKey:process.env.SBC_CREATIVE_ED25519_PRIVATE_KEY,logo:fs.readFileSync(path.join(__dirname,'../public/assets/sbc-logo.jpg'))});
 const line='Staged '+result.staged+' draft creatives; '+result.approved+' approved future slots before import.';
 console.log(line);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+'\n');
 if(result.low){console.log('::warning::Approved creative inventory below 6; owner review required.');process.exitCode=2;}
}
if(require.main===module)main().catch(()=>{console.error('Creative refill failed; review authorized host configuration and inventory.');process.exitCode=1;});
module.exports={endpoint,request,sync};
