'use strict';
/**
 * SBC V56.13.5 — Consultative Revenue Engine
 * Turns the canonical SBC catalog into a needs-driven Solution Graph.
 * No hard-coded selling price is used; all monetary values come from the
 * authorized catalog supplied by the running Command Center.
 */
const VERSION='56.13.5-CONSULTATIVE';
const MAX_BUNDLE_ITEMS=8;
const BRAINS=Object.freeze([
  'PROSPECT_BRAIN','CONTEXT_BRAIN','OPENING_BRAIN','DISCOVERY_BRAIN','SOLUTION_BRAIN',
  'CLOSING_BRAIN','FULFILLMENT_BRAIN','ACCOUNT_MANAGER_BRAIN','RECOVERY_CONTROLLER_BRAIN','TELEMETRY_BRAIN'
]);
const CATEGORY_ALIASES={
  digitalpresence:['Digital','Package','E-Commerce'],communications:['Email','Support'],security:['Security'],
  marketing:['Visibility','Branding','Print','Signage'],ecommerce:['E-Commerce'],branding:['Branding','Print','Signage'],
  print:['Print','Signage'],support:['Support'],visibility:['Visibility'],email:['Email']
};
const NEED_RULES={
  WEAK_SITE:{terms:['website','site','web presence','web page','online presence','outdated website','broken website'],categories:['Digital','Package'],prefer:['website','redesign','landing','webpage','launch','googleweb']},
  NO_WEBSITE:{terms:['no website','without a website','need a website','need website'],categories:['Digital','Package'],prefer:['website','landing','googleweb','starter']},
  SEO_GAP:{terms:['seo','search ranking','google ranking','not found on google','search visibility'],categories:['Digital','Visibility'],prefer:['seo_advanced','seo_basic','localseo','localseomonth']},
  GOOGLE_VISIBILITY:{terms:['google business','google profile','maps','local search','google visibility'],categories:['Visibility'],prefer:['googleopt','googleweb','google','localseo','directories']},
  MISSED_CALLS:{terms:['missed calls','missed call','phone calls','answer calls','phone automation','receptionist'],categories:['Support','Email'],prefer:['consult','support']},
  EMAIL_GAP:{terms:['business email','professional email','email address','email setup','microsoft 365'],categories:['Email'],prefer:['m365setup','emailuser','emailsetup','signature']},
  SECURITY_GAP:{terms:['ssl','security','hack','secure','backup','protection'],categories:['Security','Digital'],prefer:['security','ssl','backup','domainprotection']},
  BRANDING_GAP:{terms:['branding','brand','logo','identity','look professional'],categories:['Branding'],prefer:['brandingkit','logo','logorefresh','carddesign']},
  PRINT_NEED:{terms:['business cards','cards','flyers','print','printing','brochure','door hangers'],categories:['Print','Branding'],prefer:['cards500','cards1000','flyers500','brochure','doors250']},
  SIGNAGE_NEED:{terms:['sign','signage','banner','yard sign','neon','led','a-frame'],categories:['Signage'],prefer:['led','customsign','banner3x6','aframe']},
  SOCIAL_GAP:{terms:['social media','instagram','facebook','social profile'],categories:['Visibility','Branding'],prefer:['socialstarter','socialboth','socialopt','social']},
  ECOMMERCE_NEED:{terms:['online store','ecommerce','e-commerce','sell online','shop online','products online'],categories:['E-Commerce'],prefer:['ecommercecomplete','storepro','storestarter','product10','gateway']},
  BOOKING_NEED:{terms:['booking','appointments','schedule online','reservations'],categories:['Digital'],prefer:['booking','form','maps']},
  CONTENT_NEED:{terms:['copywriting','content','website copy','content creation'],categories:['Digital','Branding'],prefer:['content','images']},
  WEBSITE_CARE:{terms:['maintenance','updates','manage website','website care','ongoing website support'],categories:['Digital','Support'],prefer:['care','maintenance','support']},
  DOMAIN_NEED:{terms:['domain','domain name','url','website address'],categories:['Digital'],prefer:['domain','domainprotection','domaintransfer']},
  HOSTING_NEED:{terms:['hosting','managed wordpress','wordpress hosting','server'],categories:['Digital'],prefer:['wp','premiumhosting','hosting']},
  LAUNCH_NEED:{terms:['launch','new business','startup','new business setup','business launch'],categories:['Package','Support','Digital'],prefer:['professional','growth','onlinebusiness','digitalsetup','launchconsult']},
  SUPPORT_NEED:{terms:['support','help with technology','technical help','site updates'],categories:['Support'],prefer:['support','consult','launchconsult']},
  WORKSPACE_NEED:{terms:['office box','workspace','business workspace','team workspace','manage the business','tasks','customers','operations'],categories:['Office Box'],prefer:['officebox_business','officebox_professional','officebox_team','officebox_starter']}
};
function now(){return new Date().toISOString();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function flattenCatalog(catalog){
  const packages=Array.isArray(catalog?.packages)?catalog.packages:[];
  const services=Array.isArray(catalog?.services)?catalog.services:[];
  return [...packages.map(x=>({...x,_catalogType:'package'})),...services.map(x=>({...x,_catalogType:'service'}))]
    .filter(x=>x && x.testOnly!==true && num(x.price)>=0);
}
function catalogItem(item){
  const unit=String(item.unit||'').toLowerCase();
  const recurring=unit==='month'||unit==='monthly';
  return {sku:String(item.id||''),name:String(item.name||''),category:String(item.category||''),unit:String(item.unit||''),setupFee:recurring?0:num(item.price),recurringFee:recurring?num(item.price):0,price:num(item.price),description:String(item.description||''),features:Array.isArray(item.features)?item.features.map(String):[],paymentUrl:String(item.paymentUrl||''),catalogType:item._catalogType||'service',officeBoxEntitlement:item.officeBoxEntitlement||''};
}
function catalogIndex(catalog){return flattenCatalog(catalog).map(catalogItem).filter(x=>x.sku&&x.name);}
function normalizeTokens(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);}
function discoverNeeds(input={}){
  const rawParts=[];
  for(const key of ['text','message','notes','researchNotes','websiteStatus','painPoints','signals']){
    const v=input[key]; if(Array.isArray(v))rawParts.push(v.join(' ')); else if(v)rawParts.push(String(v));
  }
  const raw=rawParts.join(' ').toLowerCase();
  const found=[];
  for(const [code,rule] of Object.entries(NEED_RULES)){
    const hits=rule.terms.filter(t=>raw.includes(t));
    if(hits.length)found.push({code,hits,confidence:Math.min(.99,.62+hits.length*.1),categories:rule.categories});
  }
  const explicit=input.matrix&&typeof input.matrix==='object'?input.matrix:{};
  for(const [key,val] of Object.entries(explicit)){
    const values=Array.isArray(val)?val:[val];
    for(const value of values){
      const code=String(value).trim().toUpperCase();
      if(NEED_RULES[code]&&!found.some(x=>x.code===code))found.push({code,hits:['explicit'],confidence:.98,categories:NEED_RULES[code].categories});
    }
  }
  const matrix={};
  for(const x of found){matrix[x.code]=x.hits;}
  return {version:VERSION,raw:clean(raw,3000),needs:found,matrix,needsCount:found.length};
}
function normalizeMatrix(needsMatrix){
  if(!needsMatrix||typeof needsMatrix!=='object')return [];
  const out=[];
  for(const [key,val] of Object.entries(needsMatrix)){
    if(Array.isArray(val))out.push(...val.map(x=>String(x).trim().toUpperCase()));
    else if(val)out.push(String(val).trim().toUpperCase());
    if(NEED_RULES[String(key).toUpperCase()])out.push(String(key).toUpperCase());
  }
  return [...new Set(out.filter(Boolean))];
}
function scoreItem(item,needCode,context=''){
  const rule=NEED_RULES[needCode]||{terms:[],categories:[],prefer:[]};
  const hay=[item.name,item.category,item.description,...item.features].join(' ').toLowerCase();
  let score=0;
  if(rule.categories.some(c=>String(item.category).toLowerCase()===c.toLowerCase()))score+=30;
  if(rule.prefer.includes(item.sku))score+=70;
  for(const term of rule.terms){if(hay.includes(term.toLowerCase()))score+=8;}
  for(const token of normalizeTokens(context)){if(token.length>3&&hay.includes(token))score+=1;}
  if(item.catalogType==='package')score+=4;
  if(item.paymentUrl)score+=2;
  return score;
}
function needCodesForIntel(needsMatrix){
  return normalizeMatrix(needsMatrix);
}
function composeSolution({catalog,needsMatrix,discoveryText='',customer={},intelligence=null}={}){
  const items=catalogIndex(catalog);
  const codes=normalizeMatrix(needsMatrix);
  const discovered=discoverNeeds({text:discoveryText,matrix:Object.fromEntries(codes.map(x=>[x,true]))});
  const needCodes=codes.length?codes:discovered.needs.map(x=>x.code);
  const selected=new Map(); const evidence=[];
  for(const code of needCodes){
    const rule=NEED_RULES[code]; if(!rule)continue;
    const historicalScores=new Map();
    try{
      const intel=intelligence?.recommend?.({customer,needs:needCodesForIntel(needsMatrix),text:discoveryText,catalog});
      for(const rec of (intel?.recommended||[]))historicalScores.set(String(rec.sku),Number(rec.score||0));
    }catch(e){}
    const ranked=items.map(item=>{
      const base=scoreItem(item,code,discoveryText);
      const historic=historicalScores.get(String(item.sku))||0;
      return {item,score:base+Math.min(20,historic*.15),historicalScore:historic};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.item.price-b.item.price);
    const picks=ranked.slice(0,2);
    for(const pick of picks){
      if(selected.has(pick.item.sku))continue;
      if(selected.size>=MAX_BUNDLE_ITEMS)break;
      selected.set(pick.item.sku,pick.item);
      evidence.push({need:code,sku:pick.item.sku,score:pick.score,reason:`Matched ${code} to ${pick.item.name}.`});
    }
  }
  if(!selected.size){
    const fallback=items.find(x=>x.sku==='starter')||items.find(x=>x.sku==='quickstart')||items.find(x=>x.catalogType==='package');
    if(fallback){selected.set(fallback.sku,fallback);evidence.push({need:'FALLBACK',sku:fallback.sku,score:1,reason:'No explicit need matched; selected the first authorized core package.'});}
  }
  const solution=[...selected.values()];
  const upfront=solution.reduce((n,x)=>n+x.setupFee,0);
  const recurring=solution.reduce((n,x)=>n+x.recurringFee,0);
  const total=upfront;
  return {
    version:VERSION,customerId:String(customer.id||''),company:String(customer.businessName||customer.companyName||customer.contactName||''),
    needs:needCodes,solutionProfile:solution.map(x=>({sku:x.sku,name:x.name,category:x.category,unit:x.unit,setupFee:x.setupFee,recurringFee:x.recurringFee,paymentUrl:x.paymentUrl,checkoutReady:Boolean(x.paymentUrl||x.catalogType==='package')})),
    evidence,upfrontSetup:Number(upfront.toFixed(2)),monthlyRecurring:Number(recurring.toFixed(2)),
    customerPayableNow:Number(total.toFixed(2)),grossContractValue:Number((upfront+recurring).toFixed(2)),
    maxBundleItems:MAX_BUNDLE_ITEMS,status:solution.length?'SOLUTION_COMPOSED':'NO_MATCH',truth:'Catalog values observed from the running SBC canonical catalog; no synthetic prices.'
  };
}
function catalogSummary(catalog){
  const items=catalogIndex(catalog);
  const byCategory={}; for(const x of items)byCategory[x.category]=(byCategory[x.category]||0)+1;
  return {version:VERSION,count:items.length,packages:items.filter(x=>x.catalogType==='package').length,services:items.filter(x=>x.catalogType==='service').length,byCategory,source:'SBC canonical CATALOG in server.js',truth:'Observed catalog only.'};
}
function snapshot({db,catalog}={}){
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const solutions=customers.filter(x=>x.consultativeSolution?.solutionProfile);
  const paid=(Array.isArray(db?.orders)?db.orders:[]).filter(o=>/PAID|COMPLETED|FULFILLED/i.test(String(o.paymentStatus||o.status||'')));
  const revenue=paid.reduce((n,o)=>n+num(o.price??o.total),0);
  const recentSolutions=solutions.slice(0,6).map(x=>({customerId:String(x.id||''),company:String(x.businessName||x.contactName||'Account'),items:(x.consultativeSolution.solutionProfile||[]).slice(0,8).map(i=>({sku:i.sku,name:i.name})),upfrontSetup:num(x.consultativeSolution.upfrontSetup),monthlyRecurring:num(x.consultativeSolution.monthlyRecurring),updatedAt:x.consultativeSolution?.version?x.sbcConsultativeUpdatedAt||x.updatedAt||'':''}));
  const needCounts={}; for(const c of solutions){for(const n of (c.consultativeSolution.needs||[]))needCounts[n]=(needCounts[n]||0)+1;}
  return {version:VERSION,catalog:catalogSummary(catalog),metrics:{prospects:customers.length,solutionsComposed:solutions.length,paidOrders:paid.length,recognizedRevenue:Number(revenue.toFixed(2)),revenuePer1000:Number((revenue/Math.max(1,num(process.env.SBC_REVENUE_PROSPECT_DENOMINATOR||1000))).toFixed(2))},needCounts,recentSolutions,truth:'Observed SBC state only; no synthetic sales or revenue.'};
}
module.exports={VERSION,BRAINS,MAX_BUNDLE_ITEMS,NEED_RULES,flattenCatalog,catalogIndex,discoverNeeds,composeSolution,catalogSummary,snapshot};
