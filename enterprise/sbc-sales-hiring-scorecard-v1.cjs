'use strict';
/* SBC Sales Hiring V1. Advisory-only; no autonomous hiring, rejection or worker classification.
 * Scores are structured observations, not a predictor of legal eligibility or protected traits.
 */
const RUBRIC=Object.freeze({
 verifiedClosingHistory:20,englishRoleplay:15,spanishRoleplay:20,
 objectionClosing:20,crmFluency:10,accountOwnership:10,reliability:5
});
const EVIDENCE=Object.freeze(['referenceVerified','salesEvidenceVerified','englishLive','spanishLive','closingSimulationPassed']);
function integer(v,code='INVALID_SCORE'){
 if(!Number.isSafeInteger(v)||v<0)throw Error(code);
 return v;
}
function evaluate(scores={},evidence={}){
 let total=0;
 const criteria={};
 for(const [name,max] of Object.entries(RUBRIC)){
  const score=integer(scores[name]);
  if(score>max)throw Error('INVALID_SCORE');
  criteria[name]={score,max};
  total+=score;
 }
 const missing=EVIDENCE.filter(k=>evidence[k]!==true).map(k=>({
 referenceVerified:'REFERENCES_REQUIRED',salesEvidenceVerified:'VERIFIED_SALES_RESULTS_REQUIRED',
 englishLive:'LIVE_ENGLISH_REQUIRED',spanishLive:'LIVE_SPANISH_REQUIRED',
 closingSimulationPassed:'CLOSING_SIMULATION_REQUIRED'
 })[k]);
 const passedScore=total>=85;
 const demonstratedSkills=scores.spanishRoleplay>=15&&scores.englishRoleplay>=10&&scores.objectionClosing>=15;
 return {score:total,maxScore:100,criteria,passedScore,missing,
  decision:missing.length?'HOLD_FOR_VERIFICATION':passedScore&&demonstratedSkills?'SHORTLIST':'DO_NOT_ADVANCE',
  ownerInterviewRequired:true,automaticHiring:false,
  notice:'Job-related performance criteria only; human review required. No protected traits considered.'};
}
function probation({weeklyCollectedCents=[],weeklyQuotaCents=60000,
 verifiedSales=false,attendanceReviewed=false,ownerApproval=false}={}){
 const quota=integer(weeklyQuotaCents,'INVALID_QUOTA');
 if(quota<1)throw Error('INVALID_QUOTA');
 if(!Array.isArray(weeklyCollectedCents)||weeklyCollectedCents.length!==4)
  throw Error('FOUR_WEEKS_REQUIRED');
 const amounts=weeklyCollectedCents.map(v=>integer(v,'INVALID_WEEKLY_REVENUE'));
 const metWeeks=amounts.filter(v=>v>=quota).length;
 const totalCollectedCents=amounts.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(totalCollectedCents))throw Error('REVENUE_OVERFLOW');
 let recommendation='OWNER_DECISION_REQUIRED';
 if(metWeeks<3)recommendation='BELOW_PERFORMANCE_GATE';
 if(!verifiedSales||!attendanceReviewed)recommendation='REVIEW_INCOMPLETE';
 return {weeklyQuotaCents:quota,weeklyCollectedCents:amounts,metWeeks,
  totalCollectedCents,recommendation,ownerApprovalRecorded:ownerApproval===true,
  automaticTermination:false,automaticPromotion:false,
  note:'Advisory production review. Owner must consider lead quality, compliance, opportunity volume, attendance and signed agreement.'};
}
function forecast({monthlyRevenueCents,productGrossMarginBps,standardManagers=0,seniorManagers=0,
 hoursPerWeek=30,weeksPerMonth=52/12,fixedOverheadCents=0}={}){
 const revenue=integer(monthlyRevenueCents,'INVALID_FORECAST_INPUT'),
 margin=integer(productGrossMarginBps,'INVALID_FORECAST_INPUT');
 const std=integer(standardManagers,'INVALID_FORECAST_INPUT'),sen=integer(seniorManagers,'INVALID_FORECAST_INPUT');
 const overhead=integer(fixedOverheadCents,'INVALID_FORECAST_INPUT');
 if(margin>10000||std+sen>100||!Number.isFinite(hoursPerWeek)||hoursPerWeek<0||hoursPerWeek>168||
 !Number.isFinite(weeksPerMonth)||weeksPerMonth<0||weeksPerMonth>5)
  throw Error('INVALID_FORECAST_INPUT');
 const grossProfit=Math.round(revenue*margin/10000);
 const monthlyBasePay=Math.round((std*500+sen*600)*hoursPerWeek*weeksPerMonth);
 // Conservative planning assumes everyone reaches quota and shares collected revenue equally.
 const managers=std+sen;
 const perManager=managers?revenue/managers:0;
 const profitPerManager=managers?grossProfit/managers:0;
 const commission=Math.round(
 (perManager>=260000?std*profitPerManager*0.10:0)+
 (perManager>=433300?sen*profitPerManager*0.15:0));
 const contribution=grossProfit-monthlyBasePay-commission-overhead;
 return {monthlyRevenueCents:revenue,productGrossMarginBps:margin,
  monthlyGrossProfitCents:grossProfit,monthlyBasePayCents:monthlyBasePay,
  monthlyCommissionCents:commission,fixedOverheadCents:overhead,
  estimatedOperatingContributionCents:contribution,
  isForecast:true,assumptions:'Equal revenue split; no taxes, owner labor, refunds or other unlisted costs; not actual financial results.'};
}
module.exports={RUBRIC,EVIDENCE,evaluate,probation,forecast};
