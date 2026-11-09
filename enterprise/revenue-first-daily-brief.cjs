'use strict';
/* SBC Revenue First: owner-only, read-side daily sales brief.
 * No outreach, payments, CRM writes, paid AI, or marketing spend.
 */
const {scopeRevenueDb,requireTenant}=require('./v6648-revenue-tenant.cjs');
const {cleanPhone,isSuppressed}=require('./sales-caller-workspace-v6697.cjs');
const {providerCapturedSquare}=require('./v6640-payment-evidence.cjs');
const {isLab}=require('./v66129-owner-checkout-lab.cjs');
const VERSION='1.0.0';
const ZONE='America/New_York';
function dayKey(value){
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function money(n){return Math.round(n*100)/100;}
function goodNumber(value){const n=Number(value);return Number.isFinite(n)&&n>=0&&n<10000000?n:null;}
function verified(c){return c?.verified===true||['verified','sales ready'].includes(String(c?.verificationStatus||'').trim().toLowerCase());}
function isHumanCallCandidate(c){
 const status=String(c?.status||'lead').trim().toLowerCase();
 return c&&verified(c)&&!isSuppressed(c)&&!['customer','active_customer','closed','duplicate','lost','not qualified'].includes(status)&&Boolean(cleanPhone(c.phone));
}
function isQA(o){
 if(!o||o.testOnly===true||o.isTest===true||o.qaMode===true||isLab(o))return true;
 const value=[o.status,o.product,o.customerName,o.source,o.notes].map(x=>String(x??'')).join(' ');
 return /SBC SYSTEM TEST|SBC Launch QA|DO NOT SERVICE|owner checkout lab|QA - NO VENDOR|\binternal[ -]?test\b|\btest checkout\b/i.test(value);
}
function squareSettledAt(o){const p=o?.parsed||{},m=o?.metadata||{};let notes={};try{notes=JSON.parse(String(o?.notes||'{}'))}catch{}
 return o?.squarePaymentCompletedAt||p.squarePaymentCompletedAt||m.squarePaymentCompletedAt||notes.squarePaymentCompletedAt||null;
}
function rankLead(c,today){
 const followAt=c.followUpAt||c.followUp||null;
 const due=followAt&&Number.isFinite(Date.parse(followAt))&&dayKey(followAt)<=today;
 const temp=String(c.leadTemperature||'').toLowerCase();
 const score=(due?50:0)+(temp==='hot'?20:temp==='warm'?10:0)+(c.email?5:0)+(c.website?2:0);
 return {score,due:Boolean(due)};
}
function brief(db,{tenantId,now=new Date().toISOString(),callTarget=20,monthlyExisting=500,aiCap=25,marketingCap=75}={}){
 const t=requireTenant(tenantId),scoped=scopeRevenueDb(db,t),date=dayKey(now);
 if(!date)throw Error('VALID_NOW_REQUIRED');
 const cap=Math.max(1,Math.min(30,Math.trunc(Number(callTarget)||20)));
 const candidates=(scoped.customers||[]).filter(isHumanCallCandidate)
  .map(c=>({...rankLead(c,date),id:String(c.id||''),businessName:String(c.businessName||'').slice(0,180),
     contactName:String(c.contactName||'').slice(0,100),phone:cleanPhone(c.phone),
     businessCategory:String(c.industry||c.businessCategory||'').slice(0,100),
     lastStatus:String(c.status||'Lead').slice(0,80),followUpAt:String(c.followUpAt||c.followUp||'').slice(0,40),
     nextAction:String(c.nextAction||'').slice(0,240),
     note:'Human must independently confirm business identity, contact permission, local calling rules and relevant business need.'}))
  .sort((a,b)=>b.score-a.score||String(a.businessName).localeCompare(String(b.businessName)));
 const events=(scoped.revenueContactEvents||[]).filter(e=>dayKey(e.createdAt||e.at||e.timestamp)===date);
 const seenEvents=new Set();
 const counts={attempts:0,connections:0,conversations:0,quotes:0,appointments:0};
 for(const e of events){
  const id=String(e.id||e.eventId||e.providerEventId||'');
  if(id&&seenEvents.has(id))continue;if(id)seenEvents.add(id);
  const key=String(e.eventType||'').toUpperCase();
  if(['CALL_ATTEMPT','CONTACT_ATTEMPT'].includes(key))counts.attempts++;
  if(['CALL_CONNECTED'].includes(key))counts.connections++;
  if(key==='CONVERSATION')counts.conversations++;
  if(['QUOTE_SENT','OFFER_EXTENDED'].includes(key))counts.quotes++;
  if(['APPOINTMENT','APPOINTMENT_SET'].includes(key))counts.appointments++;
 }
 const paid=(scoped.orders||[]).filter(o=>providerCapturedSquare(o)&&!isQA(o));
 const evidenceRevenue=money(paid.reduce((n,o)=>n+(goodNumber(o.price??o.total??o.amount)||0),0));
 const paidToday=paid.filter(o=>dayKey(squareSettledAt(o))===date);
 const dailyRevenue=money(paidToday.reduce((n,o)=>n+(goodNumber(o.price??o.total??o.amount)||0),0));
 const actualCostKnown=paid.every(o=>goodNumber(o.actualFulfillmentCost)!==null);
 const costs=actualCostKnown?money(paid.reduce((n,o)=>n+Number(o.actualFulfillmentCost),0)):null;
 return {version:VERSION,date,tenantId:t,
   mission:'Human-led, verified, consent-aware outreach; turn CRM opportunities into paid, profitable orders.',
   calling:{target:cap,eligibleCount:candidates.length,queue:candidates.slice(0,cap),
     records:counts,remainingAttempts:Math.max(0,cap-counts.attempts),
     caution:'Contact eligibility is not legal consent or DNC clearance; no automatic calling or texting.'},
   commerce:{squareEvidencedCustomerOrders:paid.length,squareEvidencedCustomerRevenue:evidenceRevenue,
     squareEvidencedToday:paidToday.length,squareEvidencedRevenueToday:dailyRevenue,
     observedFulfillmentCost:costs,contributionAfterObservedCost:costs===null?null:money(evidenceRevenue-costs),
     caveat:'Square settlement metadata in SBC records, not independent Square or bank verification. Synthetic/QA orders excluded; missing costs are not guessed.'},
   budget:{existingExpenseEstimate:monthlyExisting,openaiMonthlyCeiling:aiCap,marketingMonthlyCeiling:marketingCap,
     maximumIllustrativeOutlay:monthlyExisting+aiCap+marketingCap,
     marketingAutoSpendAuthorized:false,openaiAutoSpendAuthorized:false},
   priorities:['Review verified call queue','Make manual calls and log actual outcomes','Follow up on existing quotations','Send accurate proposals and checkout links when requested','Reconcile actual payments and fulfillment cost','Use paid ads only after contribution-per-sale is measured']};
}
module.exports={VERSION,brief,isHumanCallCandidate,isQA,verified,dayKey};
