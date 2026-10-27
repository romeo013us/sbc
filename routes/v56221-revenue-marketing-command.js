'use strict';
const E=require('../enterprise/v56221-revenue-marketing-command');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
 const guard=ownerOnly||((req,res,next)=>next());
 const ctx=()=>getContext();
 app.get('/api/v56221/revenue-marketing/autopilot/status',auth,guard,async(req,res)=>{try{res.json({ok:true,version:E.VERSION,config:await E.growthConfig(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/autopilot/config',auth,guard,async(req,res)=>{try{res.json(await E.setGrowthConfig(req.body||{},req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/autopilot/run',auth,guard,async(req,res)=>{try{res.status(202).json(await E.run(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/v56221/revenue-marketing/status',auth,guard,async(req,res)=>{try{const c=ctx();res.json({ok:true,version:E.VERSION,...await E.kimBrief(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:'Revenue marketing command unavailable.'});}});
 app.get('/api/v56221/revenue-marketing/metrics',auth,guard,async(req,res)=>{try{res.json(await E.metrics(global.__SBC_REQUIRE_TENANT(req),Number(req.query?.days||30)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/campaigns',auth,guard,async(req,res)=>{try{res.status(201).json({ok:true,campaign:await E.createCampaign(req.body||{},req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/campaigns/:id/approve',auth,guard,async(req,res)=>{try{res.json(await E.approveCampaign(req.params.id,req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/spend',auth,guard,async(req,res)=>{try{res.status(201).json(await E.recordSpend(req.body||{},req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/events',auth,guard,async(req,res)=>{try{res.status(201).json(await E.event(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/referrals',auth,guard,async(req,res)=>{try{res.status(201).json(await E.createReferral(req.body||{},req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/referrals/event',auth,async(req,res)=>{try{res.status(201).json(await E.referralEvent(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/seo-assets',auth,guard,async(req,res)=>{try{res.status(201).json({ok:true,asset:await E.createSeoAsset(req.body||{},req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/run',auth,guard,async(req,res)=>{try{res.status(202).json(await E.run(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});

 app.post('/api/v56221/revenue-marketing/seo-assets/:id/publish',auth,guard,async(req,res)=>{try{res.status(200).json(await E.publishSeoAsset(req.params.id,req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56221/revenue-marketing/acquisition/run',auth,guard,async(req,res)=>{try{res.status(202).json(await E.acquisitionRun(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.get('/growth/:slug',async(req,res)=>{try{const asset=await E.publicSeoAsset(req.params.slug);if(!asset)return res.status(404).type('text/plain').send('SBC growth resource not found.');res.type('html').send(asset.content_html);}catch(e){res.status(503).type('text/plain').send('SBC growth resource temporarily unavailable.');}});
 app.get('/sitemap-growth.xml',async(req,res)=>{try{res.type('application/xml').send(await E.sitemapXml(1));}catch(e){res.status(503).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');}});
 app.get('/robots.txt',(req,res)=>{res.type('text/plain').send('User-agent: *global.__SBC_REQUIRE_TENANT(req)nAllow: /global.__SBC_REQUIRE_TENANT(req)nSitemap: /sitemap-growth.xmlglobal.__SBC_REQUIRE_TENANT(req)n');});
 app.get('/business-checkup',async(req,res)=>{res.type('html').send(E.businessCheckupHtml());});
 app.post('/api/public/v56222/business-checkup',async(req,res)=>{try{res.status(200).json(await E.businessCheckup(req.body||{}));}catch(e){res.status(400).json({ok:false,error:'Business checkup unavailable.'});}});
 app.post('/api/public/v56221/business-checkup',async(req,res)=>{try{res.status(200).json(await E.businessCheckup(req.body||{}));}catch(e){res.status(400).json({ok:false,error:'Business checkup unavailable.'});}});
};
module.exports.ENGINE=E;
