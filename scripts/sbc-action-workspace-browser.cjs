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
function writeFixture(role){
 const owner=role==='owner';
 const actor=owner?{id:'owner_001',role:'owner'}:{id:'manager_001',role:'account_manager'};
 const scoped=owner?rows:rows.map(r=>({...r,assigned_to:'manager_001'}));
 const data={...planActions({tenantId:7,actor,rows:scoped,today:'2026-11-25'}),sampledRecords:scoped.length,moreRecordsPossible:false};
 const shell='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SBC workspace visual proof — synthetic</title><style>body{margin:0;padding:20px;background:#080e18;color:#edf3fa;font:14px system-ui}main{max-width:1160px;margin:auto}header{font-weight:700;letter-spacing:.04em;font-size:13px;color:#a8b9cc}'+css+'</style><body><main><header>SUCCESSFUL BY CHOICE / SYNTHETIC '+role.toUpperCase()+' WORKSPACE PREVIEW</header><div id="'+(owner?'sbcFocusNav':'view-accounts')+'"></div></main>';
 const bootstrap='<script>window.__fixtureCalls=0;window.fetch=async()=>{window.__fixtureCalls++;return {ok:true,json:async()=>('+JSON.stringify(data).replace(/</g,'\\u003c')+')}};window.__opened="";window.sbcNavigate=v=>{window.__opened=v};document.addEventListener("click",e=>{if(e.target.dataset.action==="open-account")window.__opened=e.target.dataset.id});</script>';
 const script='<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>';
 const checks='<script>document.addEventListener("DOMContentLoaded",()=>{'+(owner?'document.querySelector(".sbc-actions-open").click();':'')+'});setTimeout(()=>{try{const q=s=>document.querySelector(s);if(document.querySelectorAll(".sbc-actions-lane").length!==4)throw Error("lane count");if(!q(".sbc-actions-items").textContent.includes("Sample Auto Studio"))throw Error("initial priority");q("[data-lane=upcoming]").click();if(!q(".sbc-actions-items").textContent.includes("Sample Barber Shop"))throw Error("upcoming");q(".sbc-actions-go").click();if(window.__opened!=="'+(owner?'customers':'fixture_upcoming')+'")throw Error("account navigation");'+(owner?'q(".sbc-actions-open").click();':'')+'setTimeout(()=>{try{q("[data-lane=pipeline]").click();if(!q(".sbc-actions-items").textContent.includes("25 CRM records"))throw Error("pipeline");if(document.documentElement.scrollWidth>innerWidth+1)throw Error("page overflow");const board=q(".sbc-actions-board");if(board.scrollWidth>board.clientWidth+1)throw Error("board overflow");if(window.__fixtureCalls!=='+(owner?2:1)+')throw Error("unexpected API call");q("[data-lane=commitments]").click();document.body.dataset.acceptance="pass";}catch(e){document.body.dataset.acceptance="fail";document.body.dataset.error=e.message;}},100);}catch(e){document.body.dataset.acceptance="fail";document.body.dataset.error=e.message;}},200);</script>';
 fs.writeFileSync(path.join(tmp,role+'.html'),shell+bootstrap+script+checks+'</body></html>');
}
writeFixture('owner');writeFixture('account_manager');
const bin=process.env.CHROME_BIN||['google-chrome','chromium','chromium-browser'].find(x=>cp.spawnSync(x,['--version']).status===0);
assert(bin,'Chrome is required for browser proof');
function run(role,width,height,extra){
 return cp.execFileSync(bin,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--virtual-time-budget=1500','--window-size='+width+','+height,'--user-data-dir='+path.join(tmp,'profile-'+role+'-'+width),...extra,'file://'+path.join(tmp,role+'.html')],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','ignore'],maxBuffer:4*1024*1024});
}
try{
 for(const role of ['owner','account_manager'])for(const [w,h,label] of [[1440,1000,'desktop'],[500,940,'narrow']]){
  const html=run(role,w,h,['--dump-dom']);assert(/<body[^>]*data-acceptance="pass"/.test(html),'Real Chrome acceptance failed: '+role+' '+label+' '+(html.match(/data-error="[^"]*"/)||['no diagnostic'])[0]);
  const output=path.join(proof,role+'-'+label+'.png');run(role,w,h,['--screenshot='+output]);assert(fs.statSync(output).size>10000);
 }
 console.log('Chrome owner drawer and account manager desktop/narrow: four lanes, working selection, account navigation, bounded API use and no horizontal overflow. Synthetic records only.');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
