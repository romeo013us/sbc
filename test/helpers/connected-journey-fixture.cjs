'use strict';
// Synthetic local acceptance fixture only. Never mounted by server.js.
const express=require('express');const {randomUUID}=require('node:crypto');
const {createService}=require('../../enterprise/sbc-connected-journey.cjs');
const {createRecovery}=require('../../enterprise/sbc-appointment-recovery.cjs');
const {createAccess}=require('../../enterprise/sbc-customer-activation.cjs');
const {register}=require('../../enterprise/sbc-connected-journey-routes.cjs');
const booking=require('../../enterprise/sbc-sales-p0p1.cjs');
const {createLiveDbView}=require('../../enterprise/sbc-live-db-view.cjs');
const BRIDGE=require('../../enterprise/v6660-website-bridge.cjs');
const ROLE=require('../../enterprise/sbc-account-manager-role-gate-v2.cjs');
async function fixture(){
 const owner={id:'boss',name:'Synthetic Owner',role:'owner',tenantId:1,active:true},manager={id:'am1',name:'Synthetic Manager',role:'account_manager',tenantId:1,active:true};
 let state={users:[owner,manager],customers:[],orders:[],tasks:[],activities:[],appointments:[],customerAccounts:[]},writes=0;
 const db=createLiveDbView(()=>state),service=createService({db,id:p=>p+'_'+randomUUID().replace(/-/g,''),now:()=>new Date().toISOString(),writerReady:()=>true,save:async()=>{writes++;return {persisted:true}}});
 const recovery=createRecovery(service),access=createAccess(service,{hashPassword:p=>'SYNTHETIC_ONLY_'+p.length});
 const app=express();app.use(express.json({verify:(req,res,buf)=>{req.rawBody=buf}}));
 app.use((req,res,next)=>{req.user=req.headers['x-test-actor']==='owner'?owner:req.headers['x-test-actor']==='am'?manager:null;next()});
 const auth=(req,res,next)=>{if(!req.user)return res.status(401).json({ok:false,code:'LOGIN_REQUIRED'});if(req.user.role==='account_manager'&&!ROLE.allowed(req.method,req.path))return res.status(403).json({ok:false});next()};
 const portalAuth=(req,res,next)=>{const c=db.customers.find(c=>c.id===req.headers['x-test-customer']);if(!c)return res.status(401).json({ok:false});req.portalCustomer=c;req.portalAccount={id:'synthetic-portal',customerId:c.id,tenantId:c.tenantId,active:true};next()};
 app.get('/api/me',auth,(req,res)=>res.json({ok:true,user:req.user}));
 const bridgeKey='synthetic-key-only-abcdefghijklmnopqrstuvwxyz-12345';
 app.post('/api/web-lead',async(req,res)=>{if(!BRIDGE.verify(req,{key:bridgeKey}).ok)return res.status(403).json({ok:false});try{res.json(await service.intake(1,req.body))}catch(e){res.status(e.status||503).json({ok:false,code:e.message})}});
 app.post('/api/sbc/journey/accounts/:id/invite',auth,async(req,res)=>{try{res.json(await access.invite(req.params.id,req.user,req.user.tenantId,req.body))}catch(e){res.status(e.status||503).json({ok:false,code:e.message})}});
 register(app,{service,recovery,auth,portalAuth,requireTenant:req=>req.user.tenantId});
 booking.register(app,{db,auth,requireTenant:req=>req.user.tenantId,save:async()=>({persisted:true}),writerReady:()=>true,id:p=>p+'_'+randomUUID(),serialize:service.serialize});
 app.use(express.static(require('node:path').join(__dirname,'../../public')));
 const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server))});
 return {url:'http://127.0.0.1:'+server.address().port,db,service,recovery,owner,manager,access,bridgeKey,get writes(){return writes},hydrate:value=>{state=value},close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})};
}
module.exports={fixture};
