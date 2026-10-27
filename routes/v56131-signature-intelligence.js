'use strict';

const OWNER_ROLES = new Set(['owner','manager']);
const HOT = 80;
const WARM = 60;

function s(v,n=500){return String(v ?? '').trim().slice(0,n)}
function money(n){return Math.max(0,Number(n)||0)}
function now(){return new Date().toISOString()}
function daysSince(v){if(!v)return 999;const t=new Date(v).getTime();if(!Number.isFinite(t))return 999;return Math.max(0,Math.floor((Date.now()-t)/86400000))}
function norm(v){return s(v).toLowerCase()}
function scoreLead(c){
  const gaps=[];
  if(!s(c.website))gaps.push('NO_WEBSITE');
  if(!s(c.email))gaps.push('NO_BUSINESS_EMAIL');
  if(!s(c.phone))gaps.push('NO_PHONE');
  if(s(c.website)&&/^(facebook|instagram|yelp|linktrglobal.__SBC_REQUIRE_TENANT(req).ee|googleglobal.__SBC_REQUIRE_TENANT(req).)/i.test(s(c.website)))gaps.push('SOCIAL_ONLY_PRESENCE');
  if(!s(c.address))gaps.push('NO_ADDRESS');
  const contact=(s(c.phone)?18:0)+(s(c.email)?14:0)+(s(c.contactName)?8:0);
  const digital=(gaps.includes('NO_WEBSITE')?28:0)+(gaps.includes('NO_BUSINESS_EMAIL')?18:0)+(gaps.includes('SOCIAL_ONLY_PRESENCE')?12:0);
  const context=(s(c.industry)?7:0)+(s(c.address)?5:0);
  const urgency=c.followUp&&daysSince(c.followUp)>0?10:0;
  const total=Math.min(100,digital+contact+context+urgency+15);
  const priority=total>=HOT?'HOT':total>=WARM?'WARM':'NURTURE';
  const packageRec=total>=75?'Business Essentials':total>=55?'Business Starter':'Business Starter';
  const opening=gaps.includes('NO_WEBSITE')?'owned web presence + lead capture':gaps.includes('NO_BUSINESS_EMAIL')?'professional business email + trust':gaps.includes('SOCIAL_ONLY_PRESENCE')?'owned presence + conversion path':gaps.includes('NO_PHONE')?'contactability + local conversion':'infrastructure + growth';
  return {score:total,priority,gaps,recommendedPackage:packageRec,openingAngle:opening};
}
function nextMove(c,x){
  if(c.status==='Customer')return 'Review expansion opportunity';
  if(c.followUp&&daysSince(c.followUp)>0)return 'Work overdue follow-up now';
  if(x.priority==='HOT')return 'Revenue PLAY: verify and contact';
  if(x.priority==='WARM')return 'Research one missing proof point, then contact';
  return 'Nurture or improve lead data before outreach';
}
function health(c,orders,quotes){
  const q=quotes.filter(x=>String(x.customer_id||x.customerId)===String(c.id));
  const o=orders.filter(x=>String(x.customer_id||x.customerId)===String(c.id));
  const paid=o.filter(x=>['Paid','Completed','Fulfilled','Won'].includes(String(x.status))).reduce((a,x)=>a+money(x.price||x.total),0);
  const parts={presence:s(c.website)?100:35,email:s(c.email)?100:45,contactability:(s(c.phone)?60:0)+(s(c.contactName)?40:0),leadCapture:/(booking|calendar|form|shop)/i.test(`${c.website||''} ${c.notes||''}`)?90:(s(c.website)?55:30),security:/https:/i.test(s(c.website))?95:45,growth:paid>0?80:(q.length?65:35)};
  const score=Math.round(Object.values(parts).reduce((a,v)=>a+v,0)/Object.keys(parts).length);
  const weakest=Object.entries(parts).sort((a,b)=>a[1]-b[1])[0][0];
  return {score,parts,weakest,paidRevenue:paid,quotes:q.length,orders:o.length};
}
function commandBrief(db){
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const quotes=Array.isArray(db?.quotes)?db.quotes:[];
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const active=customers.filter(c=>!['Customer','Lost'].includes(c.status));
  const opps=active.map(c=>{const x=scoreLead(c);return {...c,intelligence:x,nextMove:nextMove(c,x)}}).sort((a,b)=>b.intelligence.score-a.intelligence.score);
  const overdue=active.filter(c=>c.followUp&&daysSince(c.followUp)>0).length;
  const pipeline=active.reduce((a,c)=>a+money(c.dealValue||c.leadIntelligence?.estimatedDealValue),0);
  const won=quotes.filter(q=>['Won','Paid'].includes(String(q.status))).reduce((a,q)=>a+money(q.total),0)+orders.filter(o=>['Paid','Completed','Fulfilled','Won'].includes(String(o.status))).reduce((a,o)=>a+money(o.price||o.total),0);
  const hot=opps.filter(x=>x.intelligence.priority==='HOT').length;
  const warm=opps.filter(x=>x.intelligence.priority==='WARM').length;
  const top=opps.slice(0,7).map(c=>({id:c.id,businessName:c.businessName||c.contactName||'Unnamed',industry:c.industry||'',score:c.intelligence.score,priority:c.intelligence.priority,gaps:c.intelligence.gaps,recommendedPackage:c.intelligence.recommendedPackage,openingAngle:c.intelligence.openingAngle,nextMove:c.nextMove,dealValue:money(c.dealValue||c.leadIntelligence?.estimatedDealValue),followUp:c.followUp||''}));
  const focus=top[0]||null;
  const recommendation=focus?`Work ${focus.businessName} first: ${focus.nextMove.toLowerCase()}.`:'Import or enrich real prospects so the revenue intelligence loop has live opportunities.';
  return {generatedAt:now(),metrics:{totalLeads:customers.length,activeOpportunities:active.length,pipeline,wonRevenue:won,hot,warm,overdue},focus,recommendation,top};
}

module.exports=function registerSignatureIntelligence(app,{auth,getContext}){
  function guard(req,res){if(!OWNER_ROLES.has(req.user?.role)){res.status(403).json({ok:false,error:'Owner or manager access required.'});return false}return true}
  app.get('/api/v56131/signature/command-brief',auth,(req,res)=>{if(!guard(req,res))return;try{res.json({ok:true,version:'56.13.1',data:commandBrief(getContext().db)})}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.get('/api/v56131/signature/opportunities',auth,(req,res)=>{if(!guard(req,res))return;try{const ctx=getContext();const customers=Array.isArray(ctx.db?.customers)?ctx.db.customers:[];const quotes=Array.isArray(ctx.db?.quotes)?ctx.db.quotes:[];const orders=Array.isArray(ctx.db?.orders)?ctx.db.orders:[];const rows=customers.map(c=>{const intelligence=scoreLead(c);const h=health(c,quotes,orders);return {id:c.id,businessName:c.businessName||c.contactName||'Unnamed',contactName:c.contactName||'',industry:c.industry||'',phone:c.phone||'',email:c.email||'',website:c.website||'',status:c.status||'Lead',dealValue:money(c.dealValue||c.leadIntelligence?.estimatedDealValue),intelligence,nextMove:nextMove(c,intelligence),health:h}}).sort((a,b)=>(b.intelligence.score+b.health.score*.35)-(a.intelligence.score+a.health.score*.35));res.json({ok:true,generatedAt:now(),total:rows.length,rows:rows.slice(0,100)})}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.get('/api/v56131/signature/customer/:id',auth,(req,res)=>{if(!guard(req,res))return;try{const ctx=getContext();const c=(ctx.db?.customers||[]).find(x=>String(x.id)===String(req.params.id));if(!c)return res.status(404).json({ok:false,error:'Customer not found.'});const quotes=(ctx.db?.quotes||[]).filter(x=>String(x.customerId||x.customer_id)===String(c.id));const orders=(ctx.db?.orders||[]).filter(x=>String(x.customerId||x.customer_id)===String(c.id));const intelligence=scoreLead(c);const h=health(c,ctx.db?.orders||[],ctx.db?.quotes||[]);res.json({ok:true,data:{customer:c,intelligence,health:h,nextMove:nextMove(c,intelligence),quotes,orders}})}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.get('/api/v56131/signature/deal-autopsy',auth,(req,res)=>{if(!guard(req,res))return;try{const c=getContext().db?.customers||[];const groups={won:0,lost:0,price:0,timing:0,trust:0,fit:0,followup:0,unknown:0};c.forEach(x=>{const status=norm(x.status);if(['customer','won'].includes(status))groups.won++;if(status==='lost'){groups.lost++;const text=norm(`${x.notes||''} ${x.lossReason||x.leadIntelligence?.lossReason||''}`);if(/price|expensive|budget|cost/.test(text))groups.price++;else if(/timing|later|not ready/.test(text))groups.timing++;else if(/trust|competitor|agency/.test(text))groups.trust++;else if(/fit|need/.test(text))groups.fit++;else if(/follow|response|ghost/.test(text))groups.followup++;else groups.unknown++;}});const denominator=Math.max(1,groups.lost);res.json({ok:true,generatedAt:now(),data:{...groups,topLossReasons:Object.entries({price:groups.price,timing:groups.timing,trust:groups.trust,fit:groups.fit,followup:groups.followup,unknown:groups.unknown}).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count,pct:Math.round(count/denominator*100)}))}})}catch(e){res.status(500).json({ok:false,error:e.message})}});
};
