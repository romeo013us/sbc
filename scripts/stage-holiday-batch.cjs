'use strict';
// Trusted offline operator only. Two separate phases; never approve or publish automatically.
const fs=require('node:fs/promises'),path=require('node:path');
const {stageSocialJpeg}=require('../enterprise/creative-intelligence/social-jpeg.cjs');
const {buildSocialRelease}=require('../enterprise/creative-intelligence/social-release.cjs');
const SLOTS=['thanksgiving-2026-engagement','black-friday-2026-invest','black-friday-2026-growth'];
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function validate(options,entries,approval){
 if(!Array.isArray(options.priorSourceIds)||options.priorSourceIds.length>100000||!options.priorSourceIds.every(hash))throw Error('INVALID_HOLIDAY_HISTORY');
 const fields=approval?['slug','jobId','approvedSha256','reviewVersion']:['slug','jobId'];
 if(!Array.isArray(entries)||entries.length!==3||entries.some(e=>!e||Object.keys(e).length!==fields.length||fields.some(k=>!Object.hasOwn(e,k))||!SLOTS.includes(e.slug)||typeof e.jobId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(e.jobId)||(approval&&(!hash(e.approvedSha256)||!Number.isSafeInteger(e.reviewVersion)||e.reviewVersion<1)))||new Set(entries.map(e=>e.slug)).size!==3||new Set(entries.map(e=>e.jobId)).size!==3)throw Error('INVALID_HOLIDAY_BATCH');
 return SLOTS.map(s=>entries.find(e=>e.slug===s));
}
async function stageHolidayBatch(options,entries){
 const ordered=validate(options,entries,false),seen=new Set(options.priorSourceIds),digests=new Set(),staged=[];
 for(const e of ordered){const s=await stageSocialJpeg({...options,jobId:e.jobId});if(seen.has(s.sourceAssetId)||digests.has(s.sha256))throw Error('SOCIAL_CREATIVE_REUSED');seen.add(s.sourceAssetId);digests.add(s.sha256);staged.push({slug:e.slug,jobId:e.jobId,...s});}
 return {schemaVersion:1,publicationReady:false,finalReviewRequired:true,entries:staged};
}
async function packageHolidayBatch(options,entries){
 const ordered=validate(options,entries,true);return buildSocialRelease({...options,entries:ordered.map(({jobId,approvedSha256,reviewVersion})=>({jobId,approvedSha256,reviewVersion}))});
}
async function main(){
 const [mode,input,out]=process.argv.slice(2);if(process.argv.length!==5||!['stage','package'].includes(mode)||!input||!out||!path.isAbsolute(out))throw Error('Usage: node scripts/stage-holiday-batch.cjs stage|package input.json /absolute/new-private-output');
 const st=await fs.stat(input);if(!st.isFile()||st.size>8*1024*1024)throw Error('INVALID_HOLIDAY_INPUT');const data=JSON.parse(await fs.readFile(input,'utf8'));validate(data,data.entries,mode==='package');
 const env=process.env;if(env.SBC_CREATIVE_LOCAL_ENABLED!=='1'||!path.isAbsolute(env.SBC_CREATIVE_ROOT||''))throw Error('CREATIVE_LOCAL_RENDERER_NOT_CONFIGURED');
 for(const name of ['jobs.db','reviews.db']){if(!(await fs.lstat(path.join(env.SBC_CREATIVE_ROOT,name))).isFile())throw Error('EXISTING_REVIEW_STORE_REQUIRED');}
 const {environmentRuntime}=require('../enterprise/creative-intelligence/workspace.cjs');const rt=environmentRuntime(env);if(!rt)throw Error('CREATIVE_LOCAL_RENDERER_NOT_CONFIGURED');
 try{await fs.mkdir(out,{mode:0o700});const options={reviews:rt.reviews,tenantId:rt.tenantId,ffmpeg:env.SBC_CREATIVE_FFMPEG,ffprobe:env.SBC_CREATIVE_FFPROBE,logoPath:env.SBC_SOCIAL_LOGO_PATH,logoSha256:env.SBC_SOCIAL_LOGO_SHA256,outputRoot:path.join(out,'jpeg'),priorSourceIds:data.priorSourceIds};
 if(mode==='stage'){const staged=await stageHolidayBatch(options,data.entries);await fs.writeFile(path.join(out,'private-stage.json'),JSON.stringify(staged,null,2)+'\n',{flag:'wx',mode:0o600});}
 else{const r=await packageHolidayBatch(options,data.entries);await fs.writeFile(path.join(out,'release.zip'),r.zip,{flag:'wx',mode:0o600});await fs.writeFile(path.join(out,'candidate-manifest.json'),JSON.stringify(r.manifest,null,2)+'\n',{flag:'wx',mode:0o600});await fs.writeFile(path.join(out,'private-receipts.json'),JSON.stringify(r.privateReceipts,null,2)+'\n',{flag:'wx',mode:0o600});}
 console.log(JSON.stringify({status:'PRIVATE_OUTPUT_CREATED',publicationReady:false,mode}));
 }finally{rt.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={stageHolidayBatch,packageHolidayBatch};
