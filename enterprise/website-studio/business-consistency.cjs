'use strict';
// Advisory, deterministic, no-write review of customer-provided information.
// Does not overwrite verified facts or infer services from research snippets.
const clean=value=>typeof value==='string'?value.trim().slice(0,140):'';
const autoCategory=/\b(auto|automotive|car(?:s)?|vehicle|tint(?:ing)?|body shop|detail(?:ing)?)\b/i;
const tradeCategory=/\b(handyman|handyperson|home services|house repair|plumb|electric|hvac|landscap|roof|remodel|construction)\b/i;
const salonCategory=/\b(barber|beauty|salon|nail|lash|spa)\b/i;
const foodCategory=/\b(restaurant|cafe|coffee shop|bakery|cater|pizza|food)\b/i;
const autoService=/\b(car|auto|automotive|vehicle|window tint(?:ing)?|tire|brake|transmission|detail(?:ing)?)\b/i;
const tradeService=/\b(handyman|handyperson|home repairs?|plumb|wiring|roof|remodel|drywall|landscap|flooring)\b/i;
const salonService=/\b(hair|beard|nails?|lash|facial|waxing|barber|makeup)\b/i;
const foodService=/\b(breakfast|lunch|dinner|cater|pizza|coffee|pastry|baking)\b/i;
const issue=(code,message)=>Object.freeze({code,level:'review',message});
function reviewBusinessConsistency(profile,{ownerApproved=false}={}){
 const business=profile?.business||{}, category=clean(business.category);
 const services=Array.isArray(profile?.services)?profile.services.slice(0,12):[];
 const issues=[];
 if(!clean(business.city))issues.push(issue('MISSING_CITY','Confirm the business city before presenting a local website.'));
 if(!clean(business.region))issues.push(issue('MISSING_REGION','Confirm the state or region before presenting a local website.'));
 if(!category)issues.push(issue('MISSING_CATEGORY','Confirm the business category with the owner.'));
 if(!services.length)issues.push(issue('MISSING_SERVICES','Confirm at least one real service with the business.'));
 if(ownerApproved!==true)issues.push(issue('FACTS_NOT_OWNER_APPROVED','CRM research is a suggestion, not owner-approved website content.'));
 for(const service of services){
  const name=clean(typeof service==='string'?service:service?.name);
  if(!name)continue;
  // A possible cross-industry service is a prompt for human verification,
  // NEVER proof of a wrong category or automatic service deletion.
  const looksAutomotive=autoService.test(name);
  const looksTrade=tradeService.test(name);
  const looksSalon=salonService.test(name);
  const looksFood=foodService.test(name);
  const matched=(autoCategory.test(category)&&looksAutomotive)||
     (tradeCategory.test(category)&&looksTrade)||
     (salonCategory.test(category)&&looksSalon)||
     (foodCategory.test(category)&&looksFood);
  const recognizable=autoCategory.test(category)||tradeCategory.test(category)||salonCategory.test(category)||foodCategory.test(category);
  const crossHint=(tradeCategory.test(category)&&looksAutomotive&&!looksTrade)||
    (autoCategory.test(category)&&(looksSalon||looksFood)&&!looksAutomotive)||
    (salonCategory.test(category)&&(looksAutomotive||looksTrade||looksFood)&&!looksSalon)||
    (foodCategory.test(category)&&(looksAutomotive||looksTrade||looksSalon)&&!looksFood);
  if(recognizable&&!matched&&crossHint){
   issues.push(issue('POSSIBLE_CATEGORY_SERVICE_MISMATCH','Review whether "'+name+'" belongs under "'+category+'". It may be a legitimate service; confirm with the business.'));
  }
 }
 return Object.freeze({status:issues.length?'needs_review':'ready_for_private_review',
   requiresHumanReview:issues.length>0,issues:Object.freeze(issues)});
}
module.exports={reviewBusinessConsistency};
