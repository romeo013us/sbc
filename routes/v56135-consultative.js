'use strict';
const R=require('../enterprise/v56135-consultative-revenue-engine');

async function buildConsultativeCheckout({db,lead,solution,createSquarePaymentLinkForOrder,saveData,id,now}={}){
  if(!lead)throw new Error('Lead/customer not found.');
  if(!solution?.solutionProfile?.length)throw new Error('No consultative solution has been composed.');
  if(Number(solution.customerPayableNow||0)<=0)throw new Error('No payable setup amount is authorized for this solution.');
  if(!createSquarePaymentLinkForOrder)throw new Error('Square checkout service unavailable.');
  db.orders=db.orders||[];
  let order=db.orders.find(o=>String(o.customerId)===String(lead.id)&&['Pending','Quote','Checkout'].includes(String(o.status||''))&&String(o.paymentStatus||'').toLowerCase()!=='paid');
  const product=solution.solutionProfile.map(x=>x.name).join(' + ').slice(0,500);
  if(!order){order={id:id('order'),customerId:lead.id,customerName:lead.businessName||lead.contactName||'',product,quantity:1,status:'Pending',cost:0,price:Number(solution.customerPayableNow),paymentStatus:'Pending',fulfillmentStatus:'Awaiting Customer Payment',salesRepId:lead.assignedTo||'',notes:'Consultative solution bundle. Recurring value is recorded separately and is not charged by this one-time checkout.',metadata:{consultativeSolutionVersion:R.VERSION,solutionSkus:solution.solutionProfile.map(x=>x.sku),monthlyRecurring:Number(solution.monthlyRecurring||0)},createdAt:now(),updatedAt:now()};db.orders.unshift(order);}else{order.product=product;order.price=Number(solution.customerPayableNow);order.metadata={...(order.metadata||{}),consultativeSolutionVersion:R.VERSION,solutionSkus:solution.solutionProfile.map(x=>x.sku),monthlyRecurring:Number(solution.monthlyRecurring||0)};order.updatedAt=now();}
  const link=await createSquarePaymentLinkForOrder(order,{user:{id:'consultative-engine',name:'Kim Consultative Engine',role:'system'}});
  lead.sbcRevenueOfferPackageId='consultative-bundle';lead.sbcRevenueCheckoutOrderId=order.id;lead.sbcRevenueCheckoutUrl=link.url||'';lead.pipelineStage='Checkout';lead.updatedAt=now();await saveData();
  return {orderId:order.id,url:link.url,upfrontSetup:solution.upfrontSetup,monthlyRecurring:solution.monthlyRecurring,customerPayableNow:solution.customerPayableNow,items:solution.solutionProfile};
}

function register(app,{auth,ownerOnly,getContext,createSquarePaymentLinkForOrder,saveData,audit,id,now,getIntelligence}={}){
  const ctx=()=>getContext();
  app.get('/api/v56135/consultative/overview',auth,(req,res)=>{try{const c=ctx();res.json({ok:true,...R.snapshot(c)});}catch(e){res.status(500).json({ok:false,error:'Consultative overview unavailable.'});}});
  app.get('/api/v56135/consultative/catalog',auth,(req,res)=>{try{const c=ctx();res.json({ok:true,...R.catalogSummary(c.catalog)});}catch(e){res.status(500).json({ok:false,error:'Consultative catalog unavailable.'});}});
  app.post('/api/v56135/consultative/discover',auth,(req,res)=>{try{res.json({ok:true,data:R.discoverNeeds(req.body||{})});}catch(e){res.status(400).json({ok:false,error:'Discovery analysis failed.'});}});
  app.post('/api/v56135/consultative/diagnose-and-compose',auth,async(req,res)=>{
    try{
      const c=ctx();
      const lead=(c.db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));
      if(!lead)return res.status(404).json({ok:false,error:'Lead/customer not found.'});
      if(['FULFILLED','ACTIVE_CUSTOMER'].includes(String(lead.status||'').toUpperCase()))return res.status(409).json({ok:false,error:'Customer is already fulfilled/active; diagnosis is not a new-sale mutation.'});
      const industry=String(req.body?.industryVertical||lead.industry||'').trim();
      const observedGaps=Array.isArray(req.body?.observedGaps)?req.body.observedGaps.map(x=>String(x).trim().toUpperCase()).filter(Boolean):[];
      const discovery=R.discoverNeeds({text:req.body?.discoveryText||req.body?.text||'',matrix:Object.fromEntries(observedGaps.map(x=>[x,true]))});
      const needsMatrix=req.body?.needsMatrix||discovery.matrix;
      const global=getIntelligence?.()?.globalBIOS||getIntelligence?.();
      const solution=R.composeSolution({catalog:c.catalog,needsMatrix,discoveryText:discovery.raw,customer:lead,intelligence:global});
      if(solution.status!=='SOLUTION_COMPOSED')return res.status(422).json({ok:false,error:'No authorized solution could be composed.',discovery,solution});
      let margin={status:'UNKNOWN',reason:'Wholesale cost is not available in the canonical in-memory catalog.'};
      if(c.mysqlPool){
        try{
          const skus=solution.solutionProfile.map(x=>x.sku);
          const [rows]=await c.mysqlPool.query('SELECT sku,setup_fee,recurring_fee,wholesale_cost FROM sbc_authorized_catalog WHERE status=? AND sku IN (?)',['ACTIVE',skus]);
          const costBySku=new Map((rows||[]).map(r=>[String(r.sku),Number(r.wholesale_cost||0)]));
          const missing=skus.filter(sku=>!costBySku.has(String(sku)));
          if(!missing.length){
            const setup=Number(solution.upfrontSetup||0), recurring=Number(solution.monthlyRecurring||0);
            const cost=(rows||[]).reduce((n,r)=>n+Number(r.wholesale_cost||0),0);
            const basis=setup+recurring;
            margin={status:'OBSERVED',basis:Number(basis.toFixed(2)),wholesaleCost:Number(cost.toFixed(2)),marginPct:basis>0?Number(((basis-cost)/basis*100).toFixed(2)):null};
          }else margin={status:'UNKNOWN',reason:'Authorized catalog exists but wholesale cost coverage is incomplete.',missingSkus:missing};
        }catch(e){ margin={status:'UNKNOWN',reason:'Wholesale-cost lookup unavailable; no margin was fabricated.'}; }
      }
      lead.consultativeNeeds={version:R.VERSION,discovery,updatedAt:now()};
      lead.consultativeSolution={...solution,margin};
      lead.pipelineStage='Solution Matched';
      lead.sbcConsultativeStatus=solution.status;
      lead.sbcConsultativeUpdatedAt=now();
      await saveData();
      audit?.({id:'system',name:'Kim Consultative Engine',role:'system'},'consultative_diagnose_and_compose',`Diagnosed ${lead.businessName||lead.contactName||lead.id}`,{customerId:lead.id,industry,observedGaps,items:solution.solutionProfile.map(x=>x.sku),marginStatus:margin.status});
      res.json({ok:true,status:'SOLUTION_COMPOSED',leadId:lead.id,company:lead.businessName||lead.contactName||'',industryVertical:industry,discovery,solution:{...solution,margin},truth:'Observed SBC catalog, customer state, and available evidence only.'});
    }catch(e){
      res.status(500).json({ok:false,error:'Consultative processing engine exception.',details:String(e.message||'')});
    }
  });

  app.get('/api/v56135/consultative/telemetry',auth,(req,res)=>{
    res.setHeader('Content-Type','text/event-stream');
    res.setHeader('Cache-Control','no-cache, no-transform');
    res.setHeader('Connection','keep-alive');
    res.flushHeaders?.();
    const emit=()=>{
      try{
        const c=ctx();
        const snap=R.snapshot(c);
        const global=typeof getIntelligence==='function'?getIntelligence():null;
        const payload={status:'BIOS_LIVE_OBSERVED_FLOW',at:now(),metrics:snap.metrics,catalog:snap.catalog,global:global?.snapshot?.()||null,truth:'Observed runtime state only; no synthetic transaction values.'};
        res.write(`event:consultative_telemetryglobal.__SBC_REQUIRE_TENANT(req)ndata:${JSON.stringify(payload)}global.__SBC_REQUIRE_TENANT(req)nglobal.__SBC_REQUIRE_TENANT(req)n`);
      }catch(e){res.write(`event:errorglobal.__SBC_REQUIRE_TENANT(req)ndata:${JSON.stringify({ok:false,error:'Telemetry snapshot unavailable.'})}global.__SBC_REQUIRE_TENANT(req)nglobal.__SBC_REQUIRE_TENANT(req)n`);}
    };
    emit();
    const timer=setInterval(emit,5000);
    req.on('close',()=>clearInterval(timer));
  });

  app.post('/api/v56135/consultative/evaluate',auth,async(req,res)=>{
    try{
      const c=ctx(); const lead=(c.db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));
      if(!lead)return res.status(404).json({ok:false,error:'Lead/customer not found.'});
      const discovery=R.discoverNeeds({...(req.body?.discovery||{}),matrix:req.body?.needsMatrix||req.body?.discovery?.matrix||{}});
      const solution=R.composeSolution({catalog:c.catalog,needsMatrix:req.body?.needsMatrix||discovery.matrix,discoveryText:req.body?.discoveryText||req.body?.discovery?.text||'',customer:lead,intelligence:getIntelligence?.()});
      lead.consultativeNeeds={version:R.VERSION,discovery,updatedAt:now()};
      lead.consultativeSolution=solution;
      lead.pipelineStage=solution.status==='SOLUTION_COMPOSED'?'Solution Matched':'Discovery';
      lead.sbcConsultativeStatus=solution.status;
      lead.sbcConsultativeUpdatedAt=now();
      await saveData();
      audit?.({id:'system',name:'Kim Consultative Engine',role:'system'},'consultative_solution_composed',`Mapped SBC solution for ${lead.businessName||lead.contactName||lead.id}`,{customerId:lead.id,needs:solution.needs,items:solution.solutionProfile.map(x=>x.sku),upfrontSetup:solution.upfrontSetup,monthlyRecurring:solution.monthlyRecurring});
      res.json({ok:true,discovery,solution});
    }catch(e){res.status(400).json({ok:false,error:'Solution mapping failed.',details:String(e.message||'')});}
  });
  app.post('/api/v56135/consultative/checkout',auth,async(req,res)=>{
    try{const c=ctx();const lead=(c.db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));if(!lead)return res.status(404).json({ok:false,error:'Lead/customer not found.'});const out=await buildConsultativeCheckout({db:c.db,lead,solution:lead.consultativeSolution,createSquarePaymentLinkForOrder,saveData,audit,id,now});res.json({ok:true,status:'CHECKOUT_READY',...out});}
    catch(e){res.status(400).json({ok:false,error:'Consultative checkout could not be created.',details:String(e.message||'')});}
  });
  app.post('/api/v56135/consultative/dispatch',auth,ownerOnly,async(req,res)=>{try{const c=ctx();const lead=(c.db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));if(!lead)return res.status(404).json({ok:false,error:'Lead/customer not found.'});res.json({ok:true,status:'READY_FOR_EXISTING_REVENUE_RAIL',leadId:lead.id,solution:lead.consultativeSolution||null});}catch(e){res.status(400).json({ok:false,error:'Consultative dispatch unavailable.'});}});
}
register._engine=R; register.buildConsultativeCheckout=buildConsultativeCheckout; module.exports=register;
