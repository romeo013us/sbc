'use strict';
// Smoke probe inside a disposable, network-disabled, credential-free container only.
const fs=require('node:fs'),path=require('node:path');
const port=Number(process.env.PORT||18777);
const out=process.env.SBC_COMPILER_REPORTS||'/work/reports';
const base='http://127.0.0.1:'+port;
if(process.env.SBC_RUNTIME_ROLE!=='readonly'||process.env.SBC_COMPILER_SANDBOX_CONFIRMED!=='1'||process.env.DB_HOST||process.env.DB_PASSWORD)
 throw Error('REFUSE: smoke test must be readonly with no database credentials');
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const report={mode:'readonly-no-credentials',checks:[],status:'INCOMPLETE'};
async function request(p,method='GET'){
 const resp=await fetch(base+p,{method,headers:method==='POST'?{'content-type':'application/json'}:{},body:method==='POST'?'{}':undefined,signal:AbortSignal.timeout(3000)});
 return {path:p,method,status:resp.status,body:(await resp.text()).slice(0,1200)};
}
async function run(){
 let up=false,last='unreachable';
 for(let i=0;i<25;i++){
  try{const r=await request('/livez');if(r.status===200){report.checks.push(r);up=true;break;}last='/livez '+r.status}
  catch(e){last=String(e.message||e)}
  await delay(1000);
 }
 if(!up)throw Error('HTTP LISTENER NOT READY: '+last);
 for(const p of ['/healthz','/readyz','/api/health']){
  const r=await request(p);report.checks.push(r);
  if(r.status!==200)throw Error('HEALTH CHECK FAILED: '+p+' '+r.status);
 }
 const unauth=await request('/api/money-machine-2/appointment','POST');report.checks.push(unauth);
 if(![401,403,423].includes(unauth.status))throw Error('WRITE WAS NOT BLOCKED BY AUTH OR RECOVERY GUARD: '+unauth.status);
 report.status='PASS_READONLY_HTTP_SMOKE';
}
run().catch(e=>{report.status='FAIL';report.error=String(e.stack||e);process.exitCode=2}).finally(()=>{
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'readonly-http-smoke.json'),JSON.stringify(report,null,2)+'\n');
 console.log('READONLY_HTTP_SMOKE',report.status,'checks',report.checks.map(x=>x.path+':'+x.status).join(','));
 if(report.error)console.error(report.error);
});
