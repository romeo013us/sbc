'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MARK='SBC_PREVIEW_TO_APPOINTMENT_V1';
function patchServer(input) {
 if(input.includes(MARK))return input;
 let source=input;
 const once=(before,after)=>{assert.equal(source.split(before).length-1,1,'Preview anchor changed: '+before.slice(0,100));source=source.replace(before,()=>after)};
 const line=(prefix,after)=>{const rows=source.split('\n').filter(x=>x.startsWith(prefix));assert.equal(rows.length,1,'Preview route changed: '+prefix);once(rows[0],after)};
 once("const {direct: directDemoWithKim} = require('./enterprise/kim-demo-director');",
 "const {direct: directDemoWithKim} = require('./enterprise/kim-demo-director');\nconst SBC_PREVIEW_SALES = require('./enterprise/sbc-preview-sales-policy.cjs'); // "+MARK);
 once("  const c=(db.customers||[]).find(x=>x.id===String(customerId));\n  if(!c)throw new Error('Customer not found.');",
 "  const c=(db.customers||[]).find(x=>x.id===String(customerId)&&SBC_PREVIEW_SALES.canOperate(x,overrides.actor,overrides.tenantId));\n  if(!c)throw new Error('DEMO_CUSTOMER_NOT_AUTHORIZED');");
 once("existing=m.websiteDemos.find(x=>x.customerId===c.id&&!x.archived);",
 "existing=m.websiteDemos.find(x=>x.customerId===c.id&&!x.archived&&SBC_PREVIEW_SALES.sameTenant(x,overrides.tenantId));");
 const tick=String.fromCharCode(96),dollar=String.fromCharCode(36);
 once("  const slug=existing?.slug||"+tick+dollar+"{base}-"+dollar+"{String(c.id).slice(-6)}"+tick+";",
 "  const slug=SBC_PREVIEW_SALES.newSlug(base);");
 once("id:existing?.id||id('demo'),customerId:c.id,customer:seed.customer,industry:",
 "id:existing?.id||id('demo'),tenantId:overrides.tenantId,customerId:c.id,customer:seed.customer,industry:");
 once("status:'Ready',templateMetadata:",
 "status:'Draft',approvedAt:null,approvedBy:null,checkoutEnabled:false,templateMetadata:");
 once("eventType:'demo.created',tenantId:TENANT_DEFAULT_ID,orderId:null,action:'demo_ready',risk:'normal',requiresHuman:false,",
 "eventType:'demo.created',tenantId:overrides.tenantId,orderId:null,action:'demo_draft',risk:'normal',requiresHuman:true,");
 once("if(process.env.SBC_DEMO_AUTO_DEPLOY==='true')await deployDemoSftp(demo);",
 "if(process.env.SBC_DEMO_AUTO_DEPLOY==='true'&&demo.status==='Approved')await deployDemoSftp(demo);");
 once("return premiumHtml.replace('</body>',checkoutBlock+'</body>');",
 "return premiumHtml.replace('</body>',(demo.status==='Approved'&&demo.checkoutEnabled===true?checkoutBlock:'')+'</body>');");
 once("  const demo=await createWebsiteDemo(c.id,req.body||{});let o=acquisitionRecordFor(c.id);",
 "  const demo=await createWebsiteDemo(c.id,{...(req.body||{}),actor:req.user,tenantId:requireRequestTenant(req)});let o=acquisitionRecordFor(c.id);");
 once("Object.assign(o,{demoId:demo.id,demoUrl:demo.url,status:'DEMO_READY',lastAction:'demo_created',updatedAt:now()});",
 "Object.assign(o,{demoId:demo.id,demoUrl:'',status:'DEMO_DRAFT',lastAction:'demo_created',updatedAt:now()});");
 once("return await createWebsiteDemo(String(a.customerId),a);",
 "return await createWebsiteDemo(String(a.customerId),{...a,actor:req.user,tenantId:requireRequestTenant(req)});");
 line("app.post('/api/website-demos',auth,",
 "app.post('/api/website-demos',auth,async(req,res)=>{"+
 "if(!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||SBC_RUNTIME_READ_ONLY||!sbcWriterLeaseReady)return res.status(423).json({ok:false,error:'DEMO_WRITER_UNAVAILABLE'});"+
 "try{const tenantId=requireRequestTenant(req);const d=await createWebsiteDemo(String(req.body?.customerId||''),{...(req.body||{}),tenantId,actor:req.user});"+
 "const c=(db.customers||[]).find(x=>x.id===d.customerId&&SBC_PREVIEW_SALES.sameTenant(x,tenantId));"+
 "res.status(201).json({ok:true,demo:{...d,html:undefined,salesScript:SBC_PREVIEW_SALES.salesScript(c,d)}});"+
 "}catch(e){res.status(e.message==='DEMO_CUSTOMER_NOT_AUTHORIZED'?404:400).json({ok:false,error:e.message})}});");
 const routes=[
 "app.get('/api/website-demos/:id/preview',auth,(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');",
 "  let tid;try{tid=requireRequestTenant(req)}catch{return res.status(403).end()}",
 "  const d=megaData().websiteDemos.find(x=>x.id===req.params.id);",
 "  const c=(db.customers||[]).find(x=>x.id===d?.customerId);",
 "  if(!SBC_PREVIEW_SALES.canReadDemo(d,c,req.user,tid))return res.status(404).type('text/plain').send('Preview unavailable');",
 "  res.type('html').send(buildDemoHtml(d));","});",
 "app.post('/api/website-demos/:id/approve',auth,ownerOnly,async(req,res)=>{",
 "  if(!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||SBC_RUNTIME_READ_ONLY||!sbcWriterLeaseReady)return res.status(423).json({ok:false,error:'DEMO_WRITER_UNAVAILABLE'});",
 "  let tid;try{tid=requireRequestTenant(req)}catch{return res.status(403).json({ok:false,error:'TENANT_CONTEXT_REQUIRED'})}",
 "  const m=megaData(),d=m.websiteDemos.find(x=>x.id===req.params.id);",
 "  const c=(db.customers||[]).find(x=>x.id===d?.customerId);",
 "  if(!SBC_PREVIEW_SALES.canReadDemo(d,c,req.user,tid))return res.status(404).json({ok:false,error:'DEMO_NOT_FOUND'});",
 "  let approval;try{approval=SBC_PREVIEW_SALES.reviewApproval(req.body||{})}catch(e){return res.status(400).json({ok:false,error:e.message})}",
 "  const prior=db.megaOpsStore,approved={...d,...approval,tenantId:tid,approvedBy:req.user.id,approvedAt:now(),updatedAt:now()};",
 "  m.websiteDemos=m.websiteDemos.map(x=>x.id===d.id?approved:x);",
 "  try{await megaSave(m)}catch(_){db.megaOpsStore=prior;return res.status(503).json({ok:false,error:'DEMO_REVIEW_NOT_COMMITTED'})}",
 "  audit(req.user,'website_demo_approved','Approved concept for demonstration',{demoId:approved.id,customerId:approved.customerId});",
 "  res.json({ok:true,demo:{...approved,html:undefined,salesScript:SBC_PREVIEW_SALES.salesScript(c,approved)}});",
 "});"].join('\n');
 line("app.get('/api/website-demos/:id',auth,",
 routes+"\n"+
 "app.get('/api/website-demos/:id',auth,(req,res)=>{"+
 "let tid;try{tid=requireRequestTenant(req)}catch{return res.status(403).json({ok:false,error:'TENANT_CONTEXT_REQUIRED'})}"+
 "const d=megaData().websiteDemos.find(x=>x.id===req.params.id||x.customerId===req.params.id);"+
 "const c=(db.customers||[]).find(x=>x.id===d?.customerId);"+
 "if(!SBC_PREVIEW_SALES.canReadDemo(d,c,req.user,tid))return res.status(404).json({ok:false,error:'DEMO_NOT_FOUND'});"+
 "res.setHeader('Cache-Control','no-store');"+
 "res.json({...d,html:undefined,salesScript:SBC_PREVIEW_SALES.salesScript(c,d)});"+
 "});");
 once("    if(!c)return res.status(404).json({ok:false,error:'Demo customer not found.'});\n    const tenantId=Number(c.tenantId);",
 "    if(!c)return res.status(404).json({ok:false,error:'Demo customer not found.'});\n"+
 "    if(!SBC_PREVIEW_SALES.canCheckout(d,c))return res.status(403).json({ok:false,error:'DEMO_CHECKOUT_NOT_AUTHORIZED'});\n"+
 "    const tenantId=Number(c.tenantId);");
 once("app.get('/demo/:slug',async(req,res)=>{const d=megaData().websiteDemos.find(x=>x.slug===req.params.slug&&!x.archived);if(!d)return res.status(404).type('html').send('<h1>Demo not found</h1>');res.setHeader('Cache-Control','no-store');",
 "app.get('/demo/:slug',async(req,res)=>{"+
 "res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');"+
 "res.setHeader('Referrer-Policy','no-referrer');"+
 "const d=megaData().websiteDemos.find(x=>x.slug===req.params.slug&&!x.archived);"+
 "const c=(db.customers||[]).find(x=>x.id===d?.customerId);"+
 "if(!SBC_PREVIEW_SALES.publicReady(d,c))return res.status(404).type('html').send('<h1>Preview not available</h1>');");
 return source;
}
if(require.main===module){
 const file=path.join(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8');
 const compiled=patchServer(source);
 if(process.argv.includes('--apply')){
   assert.equal(process.env.SBC_ISOLATED_PREVIEW_STAGE,'YES','Disposable staging required');
   if(compiled!==source)fs.writeFileSync(file,compiled);
 }
 console.log('SBC preview-to-appointment stage verified');
}
module.exports={patchServer,MARK};
