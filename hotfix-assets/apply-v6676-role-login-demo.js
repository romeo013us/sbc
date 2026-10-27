'use strict';
// V66.76: Lorna login + synthetic buyer-demo isolation; no DB mutations or credential resets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6676_ROLE_LOGIN_AND_DEMO';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchors '+n);return s.replace(a,b)}
const DEMO_GATE="// SBC_V6676_DEMO_VIEWER_API: server-enforced allowlist, not a cosmetic CSS restriction.\nfunction sbcDemoViewerAllowed(method,route){\n const p=String(route||'').split('?')[0],m=String(method||'GET').toUpperCase();\n if(m==='POST'&&p==='/api/logout')return true;\n return m==='GET'&&['/api/me','/api/bootstrap','/api/catalog','/api/release-identity'].includes(p);\n}\napp.use(async function sbcDemoViewerGate(req,res,next){\n const p=String(req.path||'');if(!p.startsWith('/api/')||p==='/api/login')return next();\n try{\n  const user=Object.hasOwn(req,'_sbcRoleIdentity')?req._sbcRoleIdentity:await sessionUser(req);\n  if(!user||String(user.role||'')!=='demo')return next();\n  if(sbcDemoViewerAllowed(req.method,p))return next();\n  res.setHeader('Cache-Control','private, no-store');\n  return res.status(403).json({ok:false,code:'SBC_DEMO_READ_ONLY',error:'Demo mode uses sample data only. Sign in as the owner to perform business operations.'});\n }catch(e){return res.status(503).json({ok:false,code:'DEMO_AUTH_UNAVAILABLE',error:'Demo permissions could not be verified safely.'});}\n});";
const LORNA_BOOT="  // SBC_V6676_LORNA_BOOT: provide a minimal, tenant-scoped bootstrap for the regular login.\n  if(sbcLornaRole(req.user)){\n   const tenantId=Number(requireRequestTenant(req)),userId=String(req.user.id);\n   const allowed=c=>Number(c.tenantId)===tenantId &&\n    !['customer','lost','do not call','dnc','closed','duplicate','deleted'].includes(String(c.status||'Lead').toLowerCase()) &&\n    (!c.assignedTo||String(c.assignedTo)===userId) &&\n    (String(c.verificationStatus||'')!=='Sales Ready'||String(c.assignedTo)===userId);\n   const customers=(db.customers||[]).filter(allowed).map(c=>({\n    id:c.id,tenantId,businessName:c.businessName||'',contactName:c.contactName||'',phone:c.phone||'',email:c.email||'',\n    website:c.website||'',websiteStatus:c.websiteStatus||'',industry:c.industry||'',city:c.city||'',\n    status:c.status||'Lead',source:c.source||'',notes:c.notes||'',verificationStatus:c.verificationStatus||'',\n    leadTemperature:c.leadTemperature||'',assignedTo:c.assignedTo||'',researcherId:c.researcherId||'',\n    createdAt:c.createdAt||null,updatedAt:c.updatedAt||null\n   }));\n   const visible=new Set(customers.map(c=>String(c.id)));\n   res.setHeader('Cache-Control','private, no-store');\n   return res.json({version:BUILD_VERSION,storage:storageMode,user:{id:req.user.id,username:req.user.username,name:req.user.name,role:req.user.role},\n    settings:{businessName:db.settings.businessName,tagline:db.settings.tagline,slogan:db.settings.slogan},\n    customers,activities:(db.activities||[]).filter(a=>visible.has(String(a.meta?.customerId||''))).slice(0,50),\n    catalog:CATALOG,recovery:{required:Boolean(MYSQL_RECOVERY_REQUIRED)},\n    quotes:[],orders:[],renewals:[],appointments:[],sequences:[],sequenceEnrollments:[],\n    callReports:[],callScripts:{},emailTemplates:[],messageTemplates:[],tasks:[],portalAccounts:[],portalMessages:[],\n    hotWebLeads:[],opsSummary:{role:'lead_researcher',permissions:['research','verify','submit']}});\n  }";
const SYNTHETIC_DEMO="// SBC_V6676_SYNTHETIC_DEMO: fictional non-billable sample data only.\nfunction sbcV6676DemoBootstrapData(){\n const createdAt='2026-10-01T14:00:00.000Z';\n const customers=[\n  {id:'sbc_demo_lead_1',tenantId:-1,businessName:'Harbor Glow Studio (Demo)',contactName:'Sample Contact',phone:'555-0100',email:'hello@example.invalid',status:'Lead',source:'Synthetic Demo',industry:'Wellness',websiteStatus:'No Website',dealValue:349,createdAt,demo:true},\n  {id:'sbc_demo_lead_2',tenantId:-1,businessName:'Cypress Creative Works (Demo)',contactName:'Demo Representative',phone:'555-0101',email:'info@example.invalid',status:'Qualified',source:'Synthetic Demo',industry:'Professional Services',dealValue:699,createdAt,demo:true},\n  {id:'sbc_demo_customer_3',tenantId:-1,businessName:'Summit Community Print (Demo)',contactName:'Demo Buyer',phone:'555-0102',email:'sales@example.invalid',status:'Customer',source:'Synthetic Demo',industry:'Retail',dealValue:199,createdAt,demo:true}\n ];\n const quotes=[{id:'demo_quote_1',quoteNumber:'SBC-DEMO-001',customerId:'sbc_demo_lead_2',customerName:'Cypress Creative Works (Demo)',status:'Sent',total:699,items:[{name:'SBC Complete Business Launch',qty:1,unitPrice:699}],createdAt,demo:true}];\n const orders=[{id:'demo_order_1',customerId:'sbc_demo_customer_3',customerName:'Summit Community Print (Demo)',status:'In Production',product:'Demo Business Cards',total:199,createdAt,demo:true}];\n const renewals=[{id:'demo_renew_1',customerId:'sbc_demo_customer_3',customerName:'Summit Community Print (Demo)',status:'Upcoming',amount:49,dueDate:'2026-11-15',demo:true}];\n const activities=[{id:'demo_act_1',type:'customer',message:'Demo prospect qualified',createdAt,meta:{customerId:'sbc_demo_lead_2'},demo:true},\n  {id:'demo_act_2',type:'quote',message:'Demo proposal created — no real email sent',createdAt,meta:{customerId:'sbc_demo_lead_2'},demo:true}];\n return {customers,quotes,orders,renewals,activities,appointments:[],sequences:[],sequenceEnrollments:[],\n  emailTemplates:[],tasks:[],callReports:[],portalAccounts:[],portalMessages:[]};\n}";
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate server patch');
 s=once(s,"if(p==='/api/me'||p==='/api/release-identity')return m==='GET';","if(['/api/me','/api/release-identity','/api/bootstrap','/api/catalog'].includes(p))return m==='GET';",'Lorna regular bootstrap access');
 s=once(s," if(p==='/api/workforce/lead-draft')return m==='GET';"," if(p==='/api/workforce/lead-draft')return ['GET','PUT','DELETE'].includes(m);",'self-only research drafts');
 s=once(s," if(/^\\/api\\/workforce\\/leads\\/[^/]+$/.test(p))return m==='GET';"," if(/^\\/api\\/workforce\\/leads\\/[^/]+$/.test(p))return ['GET','PUT'].includes(m);",'research lead edits');
 s=once(s," if(p==='/api/crm/leads/import')return m==='POST';"," // Researchers use /api/workforce/leads; owner CSV import stays owner-only.",'remove misleading research CSV permission');
 s=once(s,"if(!user||!sbcLornaRole(user))return next();","req._sbcRoleIdentity=user;if(!user||!sbcLornaRole(user))return next();",'share authenticated session with demo gate');
 s=once(s,"app.get('/api/gateways/readiness',auth,",DEMO_GATE+"\napp.get('/api/gateways/readiness',auth,",'pre-route demo deny-by-default');
 s=once(s,"app.get('/api/bootstrap',auth,async(req,res)=>{",SYNTHETIC_DEMO+"\napp.get('/api/bootstrap',auth,async(req,res)=>{",'install explicit fictional demo data before login bootstrap');
 s=once(s,'const d=demoBootstrapData();return res.json({settings:', 'const d=sbcV6676DemoBootstrapData();return res.json({settings:', 'remove missing demo bootstrap function');
 s=once(s,"researcher?db.customers.filter(c=>{const status=String(c?.status||'Lead').trim().toLowerCase();",
  "researcher?db.customers.filter(c=>{if(Number(c?.tenantId)!==Number(requireRequestTenant(req)))return false;const status=String(c?.status||'Lead').trim().toLowerCase();",'workforce V9 bootstrap tenant isolation');
 s=once(s,'  const projectedCustomers=db.customers; // Authoritative CRM only. Recovery candidates are exposed separately and remain read-only.',
   '  const projectedCustomers=db.customers; // Authoritative CRM only. Recovery candidates are exposed separately and remain read-only.\n'+LORNA_BOOT, 'isolated researcher bootstrap');
 const anchor="app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{";
 const end="app.post('/api/v9/assign',auth,ownerOnly";
 const i=s.indexOf(anchor),j=s.indexOf(end,i+anchor.length);
 if(i<0||j<i)throw Error(MARKER+': lead verification boundaries missing');
 let route=s.slice(i,j);
 route=once(route,anchor,anchor+"if(SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED||!sbcWriterLeaseReady)return res.status(423).json({error:'CRM writer/recovery gate unavailable. No lead updated.'});",'verification write gate');
 const leadGuard="if(sbcLornaRole(req.user)){const tid=Number(requireRequestTenant(req)),uid=String(req.user.id),assigned=String(c.assignedTo||''),status=String(c.status||'Lead').toLowerCase();if(Number(c.tenantId)!==tid||['customer','lost','do not call','dnc','closed','duplicate','deleted'].includes(status)||(assigned&&assigned!==uid)||(String(c.verificationStatus||'')==='Sales Ready'&&assigned!==uid))return res.status(403).json({error:'Lead is outside your permitted research queue.'});}";
 route=once(route,'const b=req.body||{};',leadGuard+'const b=req.body||{};','verification authorization before field writes');
 s=s.slice(0,i)+route+s.slice(j);
 function patchSpecificRoute(first,last,from,to,label){
  const a=s.indexOf(first),b=s.indexOf(last,a+first.length);
  if(a<0||b<=a)throw Error(MARKER+': '+label+' boundaries missing');
  const revised=once(s.slice(a,b),from,to,label);s=s.slice(0,a)+revised+s.slice(b);
 }
 patchSpecificRoute("app.put('/api/workforce/leads/:id',auth,async(req,res)=>{",
  "app.get('/api/workforce/leads/:id',auth,async(req,res)=>{",
  'const b=req.body||{};',leadGuard+'const b=req.body||{};','research edit tenant and assignment authorization');
 patchSpecificRoute("app.get('/api/v9/lead-verification',auth,(req,res)=>{",
  "app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{",
  'const mine=sbcLornaRole(req.user)?all.filter(c=>{',
  'const mine=sbcLornaRole(req.user)?all.filter(c=>{if(Number(c.tenantId)!==Number(requireRequestTenant(req)))return false;',
  'research verification list tenant isolation');
 patchSpecificRoute("app.get('/api/workforce/leads/:id',auth,async(req,res)=>{",
  "app.post('/api/v10/leads/submit',auth,async(req,res)=>{",
  "const status=String(c.status||'Lead').trim().toLowerCase(),assigned=String(c.assignedTo||'');",
  "const status=String(c.status||'Lead').trim().toLowerCase(),assigned=String(c.assignedTo||'');if(Number(c.tenantId)!==Number(requireRequestTenant(req)))return res.status(403).json({error:'Lead is outside your tenant research queue.'});",
  'direct research record tenant isolation');
 s='// '+MARKER+'\n'+s;
 new vm.Script(s,{filename:'server.js'});return s;
}
const DEMO_CSS="/* SBC_V6676_DEMO_VIEWER: existing synthetic bootstrap remains the sole data source */\nbody.sbc-demo-mode #app [data-view]:not([data-view=\"dashboard\"]):not([data-view=\"customers\"]):not([data-view=\"quotes\"]):not([data-view=\"orders\"]):not([data-view=\"presentation\"]),\nbody.sbc-demo-mode #app .owner-only,body.sbc-demo-mode #app #sbcProductionControlDashboard,\nbody.sbc-demo-mode #app .global-search,body.sbc-demo-mode #app .office-box-link{display:none!important}\nbody.sbc-demo-mode #app .content:before{content:\"SBC DEMO · SAMPLE DATA ONLY · READ-ONLY · No real customer records or payments\";display:block;padding:10px 15px;margin-bottom:12px;border-radius:10px;border:1px solid #4777a0;background:#12253a;color:#f4f8ff;font:700 12px/1.5 system-ui}\nbody[data-theme=\"light\"].sbc-demo-mode #app .content:before{background:#e9f2fc;color:#19364f}";
function patchApp(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate app patch');
 const old='<div class="hero-actions"><button class="btn orange" onclick="newCustomer()">+ New Lead</button>';
 const fresh='<div class="hero-actions" ${state.me?.role===\'demo\'?\'style="display:none!important"\':\'\'}><button class="btn orange" onclick="newCustomer()">+ New Lead</button>';
 s=once(s,old,fresh,'demo owner action visibility');
 s=once(s,"if(state.view==='dashboard')setTimeout(loadProductionControlDashboard,0);",
  "if(state.view==='dashboard'&&state.me?.role!=='demo')setTimeout(loadProductionControlDashboard,0);",'demo network-free owner widget');
 s='// '+MARKER+'\n'+s;new vm.Script(s,{filename:'app.js'});return s;
}
function patchHtml(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate HTML patch');
 s=once(s,'</head>','<style id="sbc-v6676-demo-viewer">'+DEMO_CSS+'</style>\n</head>','curated demo CSS');
 s=once(s,"var allowed=new Set(['acquisition','training','timeclock']);",
  "var allowed=new Set(['acquisition','leadresearch','leadverification','training','timeclock']);",'Lorna research tools');
 s=once(s,"var button=document.querySelector('[data-view=\"acquisition\"]');",
  "var button=document.querySelector('[data-view=\"leadresearch\"]')||document.querySelector('[data-view=\"acquisition\"]');",'Lorna lead research landing');
 return '<!-- '+MARKER+' -->\n'+s;
}
function apply(root){
 const server=path.join(root,'server.js');fs.writeFileSync(server,patchServer(fs.readFileSync(server,'utf8')));
 const changed=['server.js'];
 for(const dir of ['public','browser_public']){
  const app=path.join(root,dir,'app.js'),html=path.join(root,dir,'index.html');
  fs.writeFileSync(app,patchApp(fs.readFileSync(app,'utf8')));
  fs.writeFileSync(html,patchHtml(fs.readFileSync(html,'utf8')));
  changed.push(dir+'/app.js',dir+'/index.html');
 }
 return {marker:MARKER,changed,dbWrites:false,credentialChanges:false,singleWriterPreserved:true,isolatedDemo:true};
}
module.exports={apply,MARKER,patchServer,patchApp,patchHtml};
