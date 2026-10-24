'use strict';
// Credential-free browser component regression on the real reconstructed public JS.
// Synthetic APIs here: this verifies UI behavior, NOT live authenticated sessions.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: synthetic browser gate is CI readonly only');
if(['DB_HOST','MYSQL_PASSWORD','SQUARE_ACCESS_TOKEN','TWILIO_AUTH_TOKEN'].some(k=>process.env[k]))throw Error('REFUSE: credentials present during browser test');
const root=path.resolve(process.env.SBC_BROWSER_ASSET_ROOT||'.sbc-isolated-runtime');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const leadId='ci-safe-lead';
const revision='a'.repeat(64);
const fixture={id:leadId,business_name:'SBC CI Customer',contact_name:'Alex',phone:'3055550123',email:'ci@example.org',status:'Lead',notes:'Previous verified note',revision};
const seen={detail:0,list:0,patch:[],create:[],externalRequests:[]};
function reply(res,status,body,type='application/json'){
 res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
 res.end(type==='application/json'?JSON.stringify(body):body);
}
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/'){
  return reply(res,200,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>SBC synthetic browser regression</h1><script src="/sbc-lead-workspace-v6519.js"></script><script src="/sbc-lead-edit-v6606.js"></script></body></html>','text/html');
 }
 if(['/sbc-lead-workspace-v6519.js','/sbc-lead-edit-v6606.js'].includes(pathname)){
  const file=path.join(root,'public',pathname.slice(1));
  if(!fs.existsSync(file))return reply(res,404,{error:'MISSING_REAL_ASSET'});
  return reply(res,200,fs.readFileSync(file),'application/javascript');
 }
 if(pathname==='/api/v6519/crm/leads'&&req.method==='GET'){
  seen.list++;return reply(res,200,{ok:true,data:[fixture],hasMore:false});
 }
 if(pathname==='/api/v6519/crm/leads/'+leadId&&req.method==='GET'){
  seen.detail++;return reply(res,200,{ok:true,data:{...fixture}});
 }
 if(pathname==='/api/v6606/crm/leads/'+leadId&&req.method==='PATCH'){
  let data='';req.on('data',chunk=>{data+=chunk;if(data.length>20000)req.destroy()});
  return req.on('end',()=>{
   const incoming=JSON.parse(data);seen.patch.push(incoming);
   if(seen.patch.length===1)return reply(res,409,{ok:false,code:'LEAD_STALE_REVISION'});
   return reply(res,200,{ok:true,durable:true,data:{...fixture,...incoming,revision:'b'.repeat(64)}});
  });
 }
 if(pathname==='/api/v65110/crm/leads'&&req.method==='POST'){
  let data='';req.on('data',c=>data+=c);
  return req.on('end',()=>{seen.create.push(JSON.parse(data));reply(res,423,{ok:false,code:'MYSQL_RECOVERY_REQUIRED'});});
 }
 return reply(res,404,{error:'NO_SYNTHETIC_ROUTE',pathname});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 let browser;
 try{
  browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1'||Number(u.port)!==port){seen.externalRequests.push(u.origin);return route.abort();}
   return route.continue();
  });
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
  await page.locator('#sbc-lead-workspace-launcher').click();
  await page.locator('#slw-rows').getByText('SBC CI Customer').waitFor();
  const edit=page.locator('[data-sbc-lead-edit-id="'+leadId+'"]');
  await edit.click();
  await page.locator('#sbc-v6606-editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#sbc-v6606-editor [name=notes]').inputValue(),'Previous verified note');
  await page.locator('#sbc-v6606-editor [name=notes]').fill('Attempted stale update');
  await page.locator('#sbc-v6606-edit-form button[type=submit]').click();
  await page.getByText(/changed elsewhere/i).waitFor();
  assert.equal(await page.locator('#sbc-v6606-editor').evaluate(n=>n.open),true,'stale conflict must keep editor open');
  assert.equal(seen.patch[0].revision,revision,'browser omitted authenticated read revision');
  await page.locator('#sbc-v6606-cancel').click();
  await edit.click();
  await page.locator('#sbc-v6606-editor [name=notes]').fill('Committed CI note');
  await page.locator('#sbc-v6606-edit-form button[type=submit]').click();
  await page.waitForFunction(()=>!document.getElementById('sbc-v6606-editor').open);
  assert.equal(seen.patch[1].notes,'Committed CI note');
  assert.equal(seen.patch[1].revision,revision);
  assert.ok(seen.list>=2,'save did not refresh Lead Workspace');
  await page.locator('#slw-form input[name=businessName]').fill('Locked CI New Lead');
  await page.locator('#slw-form button[type=submit]').click();
  await page.getByText(/Recovery lock is active. Lead retained in browser staging only/i).waitFor();
  assert.equal(seen.create.length,1);
  const dl=page.waitForEvent('download');
  await page.locator('#slw-export').click();
  const download=await dl;
  assert.ok(download.suggestedFilename().endsWith('.csv'),'locked stage CSV download missing');
  assert.deepEqual(seen.externalRequests,[]);
  console.log(JSON.stringify({
   status:'PASS_SYNTHETIC_BROWSER_UI',
   assetSource:'actual 57-patch compiled public JS',
   scope:'synthetic responses, no live auth, no network providers',
   checks:['list and edit buttons','prefill','revision sent','409 keeps editor open','durable save refreshes list','423 stages rather than claiming DB write','CSV export','mobile viewport controls','no external requests']
  },null,2));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('BROWSER_UI_GATE_FAILED',e.stack||e);process.exitCode=1});
