'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6662_PUBLIC_CLIENT_HUB_BOUNDARIES';
function once(src,from,to,why){
 const count=src.split(from).length-1;
 if(count!==1)throw Error(MARKER+': '+why+' anchor count='+count);
 return src.replace(from,to);
}
function patchServer(src){
 if(src.includes(MARKER))throw Error(MARKER+': double install');
 src=once(src,
  "app.post('/api/mega/client-portal/:customerId/token',auth,async(req,res)=>{if(!isMgr(req))return res.status(403).json({error:'Owner or manager access required.'});const c=db.customers.find(x=>x.id===req.params.customerId);",
  "// "+MARKER+": legacy client-hub links also require the authenticated user's tenant.\n"+
  "const SBC_V6662_CLIENT_HUB=require('./enterprise/v6662-client-hub-security.cjs');\n"+
  "app.post('/api/mega/client-portal/:customerId/token',auth,async(req,res)=>{if(!isMgr(req))return res.status(403).json({error:'Owner or manager access required.'});let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}const c=db.customers.find(x=>x.id===req.params.customerId&&Number(x.tenantId)===tenantId);",
  'prevent cross-tenant owner/manager generating client bearer links');
 src=once(src,
  "c.portalToken=c.portalToken||crypto.randomBytes(24).toString('hex');c.updatedAt=now();",
  "if(!SBC_V6662_CLIENT_HUB.validToken(c.portalToken))c.portalToken=crypto.randomBytes(24).toString('hex');c.updatedAt=now();",
  'malformed legacy client bearer tokens invalidated before creation');
 src=once(src,
  "app.get('/api/public/client/:token',async(req,res)=>{const c=db.customers.find(x=>x.portalToken===req.params.token);",
  "app.get('/api/public/client/:token',async(req,res)=>{const token=String(req.params.token||'');if(!SBC_V6662_CLIENT_HUB.validToken(token))return res.status(404).json({error:'Portal not found.'});res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');const c=db.customers.find(x=>x.portalToken===token);",
  'reject malformed public tokens and prevent sensitive link caching');
 const htmlStart="app.get('/client/:token',(req,res)=>{res.send(";
 const htmlNext="\n\napp.use('/assets'";
 const first=src.indexOf(htmlStart),end=src.indexOf(htmlNext,first);
 if(first<0||end<=first||src.indexOf(htmlStart,first+1)!==-1)throw Error(MARKER+': legacy HTML handler must appear once');
 const route="app.get('/client/:token',(req,res)=>{\n"+
  " const token=String(req.params.token||'');\n"+
  " if(!SBC_V6662_CLIENT_HUB.validToken(token))return res.status(404).type('text/plain').send('Portal unavailable.');\n"+
  " const page=SBC_V6662_CLIENT_HUB.render(token);\n"+
  " res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');\n"+
  " res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');\n"+
  " res.setHeader('Content-Security-Policy',page.csp);\n"+
  " res.status(200).type('html').send(page.html);\n"+
  "});";
 src=src.slice(0,first)+route+src.slice(end);
 src=once(src,
  "app.post('/api/kim/control-plane/run',auth,async(req,res)=>{",
  "app.post('/api/kim/control-plane/run',auth,ownerOnly,async(req,res)=>{",
  'owner-only manual full-autonomy run');
 src=once(src,
  "app.get('/api/kim/control-plane',auth,(req,res)=>{",
  "app.get('/api/kim/control-plane',auth,ownerOnly,(req,res)=>{",
  'owner-only operational private control plane');
 src=once(src,
  "price:Number(o.price||0),notes:o.notes||'',createdAt:o.createdAt",
  "price:Number(o.price||0),notes:String(parsed.customerVisibleNotes||'').slice(0,1000),createdAt:o.createdAt",
  'customer-facing order responses must exclude raw internal financial notes');
 new vm.Script(src,{filename:'server.js'});
 return src;
}
function apply(root){
 const serverFile=path.join(root,'server.js'),helperSource=path.join(__dirname,'../enterprise/v6662-client-hub-security.cjs'),
  helperDest=path.join(root,'enterprise/v6662-client-hub-security.cjs');
 if(!fs.existsSync(serverFile)||!fs.existsSync(helperSource)||!fs.existsSync(path.dirname(helperDest)))
  throw Error(MARKER+': required files missing');
 const source=fs.readFileSync(serverFile,'utf8');
 const patched=patchServer(source);
 new vm.Script(fs.readFileSync(helperSource,'utf8'),{filename:helperSource});
 fs.copyFileSync(helperSource,helperDest);fs.writeFileSync(serverFile,patched);
 return {marker:MARKER,files:['server.js','enterprise/v6662-client-hub-security.cjs'],noCustomerWrites:true,noSchemaWrites:true};
}
module.exports={MARKER,patchServer,apply};
