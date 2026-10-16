'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6549_LORNA_LEAST_PRIVILEGE',FROM='65.1.47',TO='65.1.48';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw new Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8');}
function write(root,rel,s){fs.writeFileSync(path.join(root,rel),s);}
function apply(root){
 let server=read(root,'server.js');
 if(server.includes(MARKER))throw new Error(MARKER+': patch already present in source');
 const gate=String.raw`
// ${MARKER}: deny-by-default workforce boundary for the Lead Researcher role. This runs before API routes, including routes that were previously missing auth middleware.
function sbcLornaRole(user){return ['lead_researcher','lead_generator','researcher','prospector'].includes(String(user?.role||'').trim().toLowerCase());}
function sbcLornaAllowedRequest(req,user){
 const p=String(req.path||''),m=String(req.method||'GET').toUpperCase();
 if(!p.startsWith('/api/'))return !/^\/(?:office-box|ops-center|admin|settings|system-console|commercial-console)(?:\/|$)/i.test(p);
 if((p==='/api/login'||p==='/api/logout')&&['POST','GET'].includes(m))return true;
 if(p==='/api/me'||p==='/api/release-identity')return m==='GET';
 if(p==='/api/v9/bootstrap')return m==='GET';
 if(p==='/api/v9/lead-verification')return m==='GET';
 if(/^\/api\/v9\/lead-verification\/[^/]+$/.test(p))return m==='POST';
 if(p==='/api/v9/time/clock')return m==='POST';
 if(p==='/api/v9/time/status')return m==='GET';
 if(p==='/api/workforce/lorna')return m==='GET';
 if(p==='/api/workforce/lead-draft')return m==='GET';
 if(p==='/api/workforce/leads')return ['GET','POST'].includes(m);
 if(/^\/api\/workforce\/leads\/[^/]+$/.test(p))return m==='GET';
 if(p==='/api/v10/leads/submit')return m==='POST';
 if(p==='/api/crm/leads/import')return m==='POST';
 if(p==='/api/training')return m==='GET';
 if(/^\/api\/training\/courses\/[^/]+$/.test(p))return m==='GET';
 if(/^\/api\/training\/history\/[^/]+$/.test(p)&&m==='GET'){
  const requested=decodeURIComponent(p.split('/').pop()||'');
  return [user?.id,user?.username].some(x=>x!=null&&String(x)===requested);
 }
 if(['/api/training/telemetry','/api/training/progress','/api/training/attempts'].includes(p))return m==='POST';
 if(/(?:^|\/)(?:time[-_]?clock|clock[-_]?in|clock[-_]?out|time[-_]?entries|timeentries)(?:\/|$)/i.test(p)&&['GET','POST'].includes(m)&&!/(?:admin|team|payroll|export|audit|settings|users|all)/i.test(p))return true;
 if(/^\/api\/(?:workforce\/)?(?:onboarding\/me|onboarding\/self|workforce\/onboarding)(?:\/|$)/i.test(p)&&['GET','POST'].includes(m))return true;
 return false;
}
app.use(async function sbcLornaLeastPrivilegeGate(req,res,next){
 const p=String(req.path||'');
 const isApi=p.startsWith('/api/');
 const isSensitivePage=/^\/(?:office-box|ops-center|admin|settings|system-console|commercial-console)(?:\/|$)/i.test(p);
 if(!isApi&&!isSensitivePage)return next();
 if(isApi&&['/api/login','/api/release-identity'].includes(p))return next();
 try{
  const user=await sessionUser(req);
  if(!user||!sbcLornaRole(user))return next();
  if(sbcLornaAllowedRequest(req,user))return next();
  res.setHeader('Cache-Control','no-store');
  return res.status(403).json({ok:false,code:'LORNA_LEAST_PRIVILEGE_DENIED',error:'This page or API is outside the Lead Researcher role.'});
 }catch(e){
  console.warn('[SBC LORNA ACCESS] session verification failed; restricted request blocked:',String(e?.code||e?.message||'session error'));
  return res.status(503).json({ok:false,code:'LORNA_ACCESS_VERIFICATION_FAILED',error:'Access could not be verified. The request was blocked.'});
 }
});
`;
 server=once(server,"app.get('/api/gateways/readiness',auth,",""+gate+"\napp.get('/api/gateways/readiness',auth,",'install deny-by-default route gate before API routes');
 server=once(server,"researcher=role==='lead_researcher'","researcher=sbcLornaRole(req.user)",'recognize all Lead Researcher aliases');
 server=once(server,'researcher?db.customers:fulfillment?','researcher?db.customers.filter(c=>{const status=String(c?.status||\'Lead\').trim().toLowerCase();const assignedTo=String(c?.assignedTo||\'\');const mine=!assignedTo||assignedTo===String(req.user.id);const active=!([\'customer\',\'lost\',\'do not call\',\'dnc\',\'closed\',\'duplicate\'].includes(status));const notSalesReady=String(c?.verificationStatus||\'\')!==\'Sales Ready\';return active&&mine&&(notSalesReady||assignedTo===String(req.user.id));}):fulfillment?','scope Lorna bootstrap lead records');
 server=once(server,'websiteDemos:v.websiteDemos,workforceNotes:v.workforceNotes||{}','websiteDemos:researcher?{}:v.websiteDemos,workforceNotes:researcher?{}:(v.workforceNotes||{})','hide other workforce notes and demos');
 server=once(server,"res.json({stats,leads:mine.slice(0,1000),users:(db.users||[]).filter(u=>u.active!==false&&['lead_researcher','caller','manager','owner'].includes(u.role)).map(u=>({id:u.id,name:u.name,role:u.role}))});","res.json({stats,leads:mine.slice(0,1000),users:['owner','manager'].includes(req.user.role)?(db.users||[]).filter(u=>u.active!==false&&['lead_researcher','caller','manager','owner'].includes(u.role)).map(u=>({id:u.id,name:u.name,role:u.role})):[]});",'hide employee roster from researcher verification response');
 server=once(server,"const mine=sbcLornaRole(req.user)?all.filter(c=>!c.verificationStatus||c.verificationStatus!=='Sales Ready'||c.assignedTo===req.user.id):all;","const mine=req.user.role==='lead_researcher'?all.filter(c=>{const status=String(c.status||'Lead').trim().toLowerCase(),assigned=String(c.assignedTo||'');return !['customer','lost','do not call','dnc','closed','duplicate'].includes(status)&&(!assigned||assigned===String(req.user.id))&&(String(c.verificationStatus||'')!=='Sales Ready'||assigned===String(req.user.id));}):all;",'scope verification queue to active unassigned or own leads');
 server=once(server,"const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id));if(!c)return res.status(404).json({error:'Lead not found.'});","const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id));if(!c)return res.status(404).json({error:'Lead not found.'});if(sbcLornaRole(req.user)&&req.user.role!=='owner'&&req.user.role!=='manager'){const status=String(c.status||'Lead').trim().toLowerCase(),assigned=String(c.assignedTo||'');if(['customer','lost','do not call','dnc','closed','duplicate'].includes(status)||(assigned&&assigned!==String(req.user.id))||(String(c.verificationStatus||'')==='Sales Ready'&&assigned!==String(req.user.id))){return res.status(403).json({error:'This lead is outside your assigned research queue.'});}}",'scope direct lead lookup to permitted research queue');
 if(!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED')||!server.includes('MYSQL_RECOVERY_REQUIRED'))throw new Error(MARKER+': existing recovery/writer protections missing');
 write(root,'server.js',server);
 let html=read(root,'public/index.html');
 const ui=String.raw`
<script id="sbc-lorna-least-privilege-ui">
(function(){
 'use strict';
 var role='',redirected=false,readInFlight=false,originalFetch=window.fetch.bind(window);
 var allowed=new Set(['acquisition','training','timeclock']);
 var restrictedSelectors='.global-search,#globalSearch,#storageLabel,.status-dot,.office-box-link,.sidebar-bottom a,.sidebar-group-label';
 function isResearcher(r){return ['lead_researcher','lead_generator','researcher','prospector'].includes(String(r||'').toLowerCase());}
 function setRestricted(el,hide){
  if(!el)return;
  if(hide){
   if(!el.hasAttribute('data-sbc-lorna-managed')){el.setAttribute('data-sbc-lorna-managed','1');el.setAttribute('data-sbc-lorna-was-hidden',el.hidden?'1':'0');}
   el.hidden=true;el.setAttribute('aria-hidden','true');el.setAttribute('tabindex','-1');
  }else if(el.hasAttribute('data-sbc-lorna-managed')){
   el.hidden=el.getAttribute('data-sbc-lorna-was-hidden')==='1';
   el.removeAttribute('aria-hidden');el.removeAttribute('tabindex');el.removeAttribute('data-sbc-lorna-managed');el.removeAttribute('data-sbc-lorna-was-hidden');
  }
 }
 function apply(){
  var restricted=isResearcher(role);
  document.querySelectorAll('[data-view]').forEach(function(el){setRestricted(el,restricted&&!allowed.has(String(el.getAttribute('data-view')||'')));});
  document.querySelectorAll(restrictedSelectors).forEach(function(el){setRestricted(el,restricted);});
  document.querySelectorAll('.sidebar-bottom a[href^="http"],.sidebar-bottom a[href="/office-box"]').forEach(function(el){setRestricted(el,restricted);});
  document.querySelectorAll('.owner-only').forEach(function(el){setRestricted(el,restricted);});
  if(restricted&&!redirected){
   var app=document.querySelector('#app');
   var button=document.querySelector('[data-view="acquisition"]');
   if(app&&button&&!app.classList.contains('hidden')){redirected=true;button.click();}
  }
 }
 function resolve(data){
  var u=data&&(data.user||data.me||data.profile||data);
  role=String(u&&(u.role||(u.user&&u.user.role))||'').toLowerCase();
  apply();
 }
 function readMe(){
  if(readInFlight)return;
  readInFlight=true;
  originalFetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d)resolve(d);else{role='';apply();}}).catch(function(){role='';apply();}).finally(function(){readInFlight=false;});
 }
 window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||'';
  return originalFetch(input,init).then(function(response){
   if(/\/api\/me(?:[?#]|$)/.test(url)){response.clone().json().then(resolve).catch(function(){});}
   if(/\/api\/login(?:[?#]|$)/.test(url)&&response.ok){role='';readMe();}
   if(/\/api\/logout(?:[?#]|$)/.test(url)&&response.ok){role='';redirected=false;apply();}
   return response;
  });
 };
 var observer=new MutationObserver(function(){apply();var app=document.querySelector('#app');if(!role&&app&&!app.classList.contains('hidden'))readMe();});
 function start(){readMe();var target=document.body;if(target)observer.observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>
`;
 html=once(html,'</body>',ui+'\n</body>','install role-aware least-privilege navigation');
 html=html.replace(/V65\.1\.47/g,'V65.1.48');
 write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');
 const cache=sw.match(/const CACHE=['"][^'"]+['"]/);
 if(!cache)throw new Error(MARKER+': service-worker cache key missing');
 sw=sw.replace(cache[0],"const CACHE='sbc-static-v65-1-48-lorna-least-privilege'");
 write(root,'public/sw.js',sw);
 const pkg=JSON.parse(read(root,'package.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw new Error(MARKER+': expected package '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.48 applies least-privilege Lead Researcher UI and server API access controls';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));
 if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw new Error(MARKER+': lockfile identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');
 identity=once(identity,"const RELEASE_VERSION = '65.1.47';","const RELEASE_VERSION = '65.1.48';",'release version');
 identity=once(identity,"const RELEASE_NAME = 'LEAD_IMPORT_CACHE_CONTRACT';","const RELEASE_NAME = 'LORNA_LEAST_PRIVILEGE';",'release name');
 identity=once(identity,'major:65,minor:1,patch:47','major:65,minor:1,patch:48','semantic version');
 write(root,'config/release-identity.js',identity);
 const browserPath='browser_public/app.js';let browser=read(root,browserPath);
 if(!browser.includes('65.1.47'))throw new Error(MARKER+': browser release identity anchor missing');
 write(root,browserPath,browser.replace(/65\.1\.47/g,'65.1.48'));
 const vp=path.join(root,'VERSION');if(fs.existsSync(vp))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.47/g,'65.1.48'));
 return {marker:MARKER,version:TO,uiAllowlist:['acquisition','training','timeclock'],serverDenyByDefault:true,roleAliases:['lead_researcher','lead_generator','researcher','prospector'],preservesOwnerAndNonResearcherRoles:true,recoveryAndWriterGatesPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
