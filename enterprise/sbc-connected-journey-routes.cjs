'use strict';
// Every staff route checks the live account's tenant and assignment in the service.
function register(app,{service,recovery,auth,portalAuth,requireTenant}={}){
 const handle=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{return res.json(await fn(req))}catch(e){return res.status(e.status||503).json({ok:false,code:e.status?e.message:'JOURNEY_UNAVAILABLE'})}};
 const tid=req=>requireTenant(req);
 app.get('/api/sbc/journey/queue',auth,handle(req=>service.queue(req.user,tid(req))));
 app.get('/api/sbc/journey/accounts/:id',auth,handle(req=>service.detail(req.params.id,req.user,tid(req))));
 app.post('/api/sbc/journey/accounts/:id/review',auth,handle(req=>service.review(req.params.id,req.user,tid(req),req.body||{})));
 app.post('/api/sbc/journey/accounts/:id/consent',auth,handle(req=>recovery.recordConsent(req.params.id,req.user,tid(req),req.body||{})));
 app.post('/api/sbc/journey/orders/:id/progress',auth,handle(req=>service.progress(req.params.id,req.user,tid(req),req.body||{})));
 app.post('/api/sbc/journey/reconcile',auth,handle(req=>service.reconcile(req.user,tid(req))));
 app.get('/api/sbc/journey/reminders',auth,handle(req=>{service.queue(req.user,tid(req));return recovery.preview(req.user,tid(req))}));
 app.post('/api/sbc/journey/reminders/run',auth,handle(req=>recovery.run(tid(req),req.user)));
 app.get('/api/portal/journey',portalAuth,handle(req=>service.portalSummary(req)));
 app.post('/api/portal/journey/orders/:id/approval',portalAuth,handle(req=>service.approve(req,req.params.id,req.body||{})));
 app.post('/api/portal/journey/appointments/:id/reschedule-request',portalAuth,handle(req=>service.reschedule(req,req.params.id,req.body||{})));
 return {registered:true};
}
module.exports={register};
