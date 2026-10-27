'use strict';
const crypto=require('crypto');
const VERSION='56.13.1';
const TERMINAL=new Set(['lost','closed lost','do not call','do not contact','duplicate','not qualified','closed']);
const PAID=new Set(['paid','completed','fulfilled','won']);
const UNPAID=new Set(['pending','unpaid','payment failed','failed','past due','new']);
function id(prefix='ra'){return `${prefix}_${crypto.randomUUID()}`;}
function money(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0;}
function lower(v){return String(v??'').trim().toLowerCase();}
function active(c){return c&&!TERMINAL.has(lower(c.status));}
function customerRevenue(c,orders){return orders.filter(o=>String(o.customerId)===String(c.id)&&PAID.has(lower(o.status))).reduce((n,o)=>n+money(o.total||o.price||o.amount),0);}
function daysSince(v){const t=Date.parse(v||0);return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):Infinity;}
function recentActivity(db,c){return (db.activities||[]).filter(a=>String(a.meta?.customerId||'')===String(c.id)).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0];}
function churnRisk(c,db){
  if(lower(c.status)!=='customer')return {score:0,level:'NONE',reasons:[]};
  let score=0,reasons=[];const act=recentActivity(db,c);const inactive=daysSince(act?.createdAt||c.updatedAt);
  if(inactive>90){score+=35;reasons.push('No recent activity >90 days');} else if(inactive>45){score+=20;reasons.push('No recent activity >45 days');}
  if(c.followUp&&Date.parse(c.followUp)<Date.now()){score+=20;reasons.push('Follow-up overdue');}
  const unpaid=(db.orders||[]).some(o=>String(o.customerId)===String(c.id)&&UNPAID.has(lower(o.status)));
  if(unpaid){score+=30;reasons.push('Unpaid/past-due order');}
  if(Number(c.satisfactionScore)>0&&Number(c.satisfactionScore)<7){score+=25;reasons.push('Low satisfaction score');}
  const level=score>=70?'HIGH':score>=40?'MEDIUM':score>=20?'LOW':'HEALTHY';
  return {score:Math.min(100,score),level,reasons};
}
function expansion(c,db){
  if(lower(c.status)!=='customer')return null;
  const orders=(db.orders||[]).filter(o=>String(o.customerId)===String(c.id)&&PAID.has(lower(o.status)));
  const text=`${c.notes||''} ${c.industry||''} ${c.website||''}`.toLowerCase();
  const gaps=[]; if(!c.website)gaps.push('website'); if(!c.email)gaps.push('business email'); if(!c.websiteStatus||/missing|unknown/i.test(String(c.websiteStatus)))gaps.push('website management');
  const revenue=customerRevenue(c,db.orders||[]);
  if(!gaps.length && revenue<=0 && !orders.length)return null;
  const score=Math.min(100,40+(orders.length?20:0)+(revenue>0?20:0)+Math.min(20,gaps.length*7));
  return {type:'EXPANSION',score,reason:gaps.length?`Customer has identifiable service gaps: ${gaps.join(', ')}`:'Existing customer with purchase history and expansion potential',nextAction:'REVIEW_UPSELL',gaps,revenue};
}
function referral(c,db){
  if(lower(c.status)!=='customer')return null;
  const positive=Number(c.satisfactionScore)>=8 || /satisfied|happy|great|excellent|love/i.test(String(c.notes||''));
  const paid=(db.orders||[]).some(o=>String(o.customerId)===String(c.id)&&PAID.has(lower(o.status)));
  if(!positive&&!paid)return null;
  return {type:'REFERRAL',score:positive?90:70,reason:positive?'Positive customer signal':'Customer has completed a paid order',nextAction:'REQUEST_REFERRAL'};
}
function abandonedSale(c,db){
  const quotes=(db.quotes||[]).filter(q=>String(q.customerId)===String(c.id)&&['sent','open','pending','quoted'].includes(lower(q.status)));
  const unpaid=(db.orders||[]).filter(o=>String(o.customerId)===String(c.id)&&UNPAID.has(lower(o.status)));
  if(!quotes.length&&!unpaid.length)return null;
  const latest=[...quotes,...unpaid].sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0))[0];
  const age=daysSince(latest?.updatedAt||latest?.createdAt);
  if(age<1)return null;
  return {type:'ABANDONED_SALE',score:Math.min(100,70+Math.min(25,Math.floor(age/2))),reason:unpaid.length?'Unpaid order detected':'Open quote has not converted',nextAction:'RECOVER_SALE',quoteId:latest?.id||'',ageDays:Math.round(age*10)/10};
}
function renewalRadar(c,db){
  const now=Date.now();const rows=(db.renewals||[]).filter(r=>String(r.customerId)===String(c.id)&&!['renewed','paid','cancelled'].includes(lower(r.status)));
  if(!rows.length)return null;
  const r=rows.sort((a,b)=>Date.parse(a.dueDate||0)-Date.parse(b.dueDate||0))[0];const due=Date.parse(r.dueDate||0);if(!Number.isFinite(due))return null;
  const days=Math.ceil((due-now)/86400000);if(days>120)return null;
  return {type:'RENEWAL',score:days<=14?100:days<=30?90:75,reason:days<0?`Renewal overdue by ${Math.abs(days)} days`:`Renewal due in ${days} days`,nextAction:'RENEWAL_RECOVERY',renewalId:r.id,amount:money(r.amount),daysUntil:days};
}
function failedPayment(c,db){
  const orders=(db.orders||[]).filter(o=>String(o.customerId)===String(c.id)&&['payment failed','failed','past due','unpaid'].includes(lower(o.status)));
  if(!orders.length)return null;
  const o=orders.sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0))[0];
  return {type:'PAYMENT_RECOVERY',score:99,reason:'Payment problem requires recovery',nextAction:'RECOVER_PAYMENT',orderId:o.id,amount:money(o.total||o.price||o.amount)};
}
function nextBestRevenueAction(c,db){
  if(!active(c))return {type:'SUPPRESSED',score:0,nextAction:'NONE',reasons:['Terminal status']};
  const candidates=[abandonedSale(c,db),failedPayment(c,db),renewalRadar(c,db),expansion(c,db),referral(c,db)].filter(Boolean);
  const risk=churnRisk(c,db);if(risk.level==='HIGH')candidates.push({type:'CHURN_RISK',score:Math.min(100,90+risk.score/10),reason:risk.reasons.join('; '),nextAction:'RETENTION_REVIEW'});
  if(!candidates.length){
    const temp=lower(c.leadTemperature); if(['hot','warm'].includes(temp))return {type:'NEW_SALE',score:Math.max(60,Number(c.leadScore||0)),reason:'Warm/Hot prospect without higher-priority recovery event',nextAction:'VERIFY_AND_REVENUE_PLAY'};
    return {type:'NURTURE',score:20,reason:'No immediate revenue event detected',nextAction:'NURTURE'};
  }
  return candidates.sort((a,b)=>b.score-a.score)[0];
}
function financials(db){
  const orders=db.orders||[];const paid=orders.filter(o=>PAID.has(lower(o.status)));const revenue=paid.reduce((n,o)=>n+money(o.total||o.price||o.amount),0);
  const renewals=(db.renewals||[]).filter(r=>!['cancelled','paid','renewed'].includes(lower(r.status)));
  const renewalRunRate=renewals.reduce((n,r)=>n+money(r.amount),0);
  const annualRecurring=renewalRunRate;const estimatedMrr=money(annualRecurring/12);
  const pending=orders.filter(o=>UNPAID.has(lower(o.status))).reduce((n,o)=>n+money(o.total||o.price||o.amount),0);
  return {recognizedRevenue:revenue,paidOrders:paid.length,renewalPipeline:renewalRunRate,estimatedMrr,estimatedArr:annualRecurring,unpaidExposure:pending,basis:'Estimated MRR/ARR uses scheduled renewal value divided/annualized; replace with provider-confirmed subscription ledger when available.'};
}
function buildCycle(db,{limit=200}={}){
  const customers=(db.customers||[]).filter(active).slice(0,Math.max(1,Math.min(1000,limit)));const actions=[];const counts={ABANDONED_SALE:0,PAYMENT_RECOVERY:0,RENEWAL:0,EXPANSION:0,REFERRAL:0,CHURN_RISK:0,NEW_SALE:0,NURTURE:0};
  for(const c of customers){const n=nextBestRevenueAction(c,db);counts[n.type]=(counts[n.type]||0)+1;actions.push({id:id('nba'),customerId:c.id,businessName:c.businessName||c.contactName||'Customer',...n,createdAt:new Date().toISOString()});}
  actions.sort((a,b)=>b.score-a.score);
  return {ok:true,version:VERSION,generatedAt:new Date().toISOString(),counts,financials:financials(db),actions:actions.slice(0,100),customersEvaluated:customers.length};
}
function referralAttribution(referrer,referee,db){
  return {id:id('ref'),referrerCustomerId:String(referrer),referredCustomerId:String(referee),status:'ATTRIBUTED',createdAt:new Date().toISOString(),source:'sbc-revenue-autopilot'};
}
module.exports={VERSION,buildCycle,nextBestRevenueAction,churnRisk,expansion,referral,abandonedSale,renewalRadar,failedPayment,financials,referralAttribution};
