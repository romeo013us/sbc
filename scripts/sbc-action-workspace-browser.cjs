'use strict';
// Real Chromium rendering against the actual production JS/CSS and pure
// planner; only synthetic data, file-local fixture, zero provider traffic.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const root=path.resolve(__dirname,'..');
const proof=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'sbc-workspace-proof');
fs.mkdirSync(proof,{recursive:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-workspace-browser-'));
const js=fs.readFileSync(path.join(root,'public/sbc-free-actions-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/sbc-free-actions-v1.css'),'utf8');
const row=(id,name,patch={})=>({id,tenant_id:7,business_name:name,phone:'5550100',status:'Lead',assigned_to:'manager_001',follow_up:null,...patch});
const rows=[
 row('fixture_due','Sample Auto Studio',{follow_up:'2026-11-24'}),
 row('fixture_today','Sample Design Co.',{follow_up:'2026-11-25'}),
 row('fixture_hold','Sample Retail',{status:'Do Not Call'}),
 row('fixture_upcoming','Sample Barber Shop',{follow_up:'2026-11-28'}),
 ...Array.from({length:25},(_,i)=>row('fixture_new_'+i,'Sample Prospect '+i,{assigned_to:''}))
];
const data={...planActions({tenantId:7,actor:{id:'owner_001',role:'owner'},rows,today:'2026-11-25'}),sampledRecords:rows.length,moreRecordsPossible:false};
const shell='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SBC workspace visual proof — synthetic</title><style>body{margin:0;padding:20px;background:#080e18;color:#edf3fa;font:14px system-ui}main{max-width:1160px;margin:auto}header{font-weight:700;letter-spacing:.04em;font-size:13px;color:#a8b9cc}'+css+'</style><body><main><header>SUCCESSFUL BY CHOICE / SYNTHETIC WORKSPACE PREVIEW</header><div id="view-accounts"></div></main>';
const bootstrap='<script>window.fetch=async()=>({ok:true,json:async()=>'+JSON.stringify(data).replace(/</g,'\\u003c')+'});</script>';
const script='<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>';
const checks='<script>setTimeout(()=>{try{const q=s=>document.querySelector(s);if(document.querySelectorAll(".sbc-actions-lane").length!==4)throw Error("lane count");if(!q(".sbc-actions-items").textContent.includes("Sample Auto Studio"))throw Error("initial priority");q("[data-lane=upcoming]").click();if(!q(".sbc-actions-items").textContent.includes("Sample Barber Shop"))throw Error("upcoming");q("[data-lane=pipeline]").click();if(!q(".sbc-actions-items").textContent.includes("25 CRM records"))throw Error("pipeline");if(document.documentElement.scrollWidth>innerWidth+1)throw Error("overflow");q("[data-lane=commitments]").click();document.body.dataset.acceptance="pass";}catch(e){document.body.dataset.acceptance="fail";document.body.dataset.error=e.message;}},200);</script>';
fs.writeFileSync(path.join(tmp,'preview.html'),shell+bootstrap+script+checks+'</body></html>');
const bin=process.env.CHROME_BIN||['google-chrome','chromium','chromium-browser'].find(x=>cp.spawnSync(x,['--version']).status===0);
assert(bin,'Chrome is required for browser proof');
function run(width,height,extra){
 return cp.execFileSync(bin,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--virtual-time-budget=1500','--window-size='+width+','+height,'--user-data-dir='+path.join(tmp,'profile-'+width),...extra,'file://'+path.join(tmp,'preview.html')],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','ignore'],maxBuffer:4*1024*1024});
}
try{
 for(const [w,h,label] of [[1440,1000,'desktop'],[500,940,'narrow']]){
  const html=run(w,h,['--dump-dom']);assert.match(html,/<body[^>]*data-acceptance="pass"/,'Real Chrome acceptance failed: '+label);
  const output=path.join(proof,label+'.png');run(w,h,['--screenshot='+output]);assert(fs.statSync(output).size>10000);
 }
 console.log('Chrome desktop and narrow viewport: four lanes, working selection and no horizontal overflow. Synthetic records only.');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
