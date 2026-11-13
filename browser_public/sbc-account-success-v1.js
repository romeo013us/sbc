/* SBC ACCOUNT SUCCESS: evidence-led relationship plan shared by owner and account managers.
 * Pure presentation logic only. No mutations, outreach, charges, provisioning or new permissions.
 */
(function(root){
'use strict';
if(root.SBC_ACCOUNT_SUCCESS)return;
function clean(value,max){return String(value==null?'':value).trim().slice(0,max||300);}
function intel(c){
 var raw=c.leadIntelligence||c.lead_intelligence_json||{};
 if(typeof raw==='string'){try{raw=JSON.parse(raw);}catch(_){raw={};}}
 return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
}
function plan(customer,context){
 var c=customer&&typeof customer==='object'?customer:{},ctx=context&&typeof context==='object'?context:{};
 var status=clean(c.status||'Lead',70);
 var stage=/^(customer|active customer)$/i.test(status)?'Existing customer':
   /^(qualified|interested|appointment set|proposal|quoted)$/i.test(status)?'Qualified opportunity':'Prospect';
 var held=Boolean(c.doNotContact||c.doNotCall||c.salesSuppressed||c.isSuppressed||
   /^(do not call|do not contact|dnc|opt out|unsubscribe|lost)$/i.test(status));
 var quotes=Array.isArray(ctx.quotes)?ctx.quotes.filter(x=>x&&typeof x==='object'):[];
 var tickets=Array.isArray(ctx.openTickets)?ctx.openTickets.filter(x=>x&&typeof x==='object'&&!/^(closed|resolved|completed|cancelled)$/i.test(clean(x.status,80))):[];
 var website=clean(c.website||'',300);
 var hasWebsite=/^https?:\/\/[^\s]+/i.test(website);
 var research=c.researchBrief||intel(c).researchBrief||{};
 if(!research||typeof research!=='object'||Array.isArray(research))research={};
 var verifiedServices=research.servicesVerified===true&&
   ['Verified','Sales Ready'].includes(clean(c.verificationStatus,40))&&c.researchRejected!==true;
 var services=clean(research.specificServices||'',500);
 var followUp=clean(c.followUpAt||c.followUp||c.follow_up||'',90);
 var next=held?'Do not contact. Owner review of suppression and the account record is required.':
   tickets.length?'Resolve the recorded support request before proposing additional services.':
   stage==='Existing customer'?'Check current service delivery, support needs and the next agreed account review.':
   quotes.length?'Review the recorded quote and confirm the customer’s requested next step.':
   !hasWebsite?'Confirm the business’s website need and offer an owner-approved private website concept.':
   'Ask about the business’s goals, current online presence and any requested improvements.';
 var checks=[];
 if(!clean(c.businessName||c.business_name,200))checks.push('Confirm the legal or trading business name.');
 if(!services||!verifiedServices)checks.push('Confirm actual services, prices and business claims with the customer.');
 if(!clean(c.phone,80)&&!clean(c.email,250))checks.push('Confirm at least one authorized contact channel.');
 checks.push('Verify approved photos, rights, and website copy before launch.');
 checks.push('Confirm domain ownership, DNS/SSL access and the chosen hosting product.');
 checks.push('Verify payment and fulfillment authorization before customer-domain publishing.');
 return Object.freeze({
  stage:stage,status:status,contactBlocked:held,
  accountManager:clean(c.assignedTo||c.assigned_to||'',100)||'Not assigned',
  nextTouchpoint:followUp||'Not scheduled',
  nextAction:next,recordedQuotes:quotes.length,recordedOpenTickets:tickets.length,
  relationshipNote:'CRM status and locally loaded history are not payment proof, service completion or consent to contact.',
  siteBrief:Object.freeze({
   businessName:clean(c.businessName||c.business_name||c.contactName||'',180)||'Business name needs confirmation',
   industry:clean(c.industry||c.category||c.businessCategory||'',150)||'Business category needs confirmation',
   location:clean(c.address||c.city||'',500)||'Location needs confirmation',
   phone:clean(c.phone||'',80),
   email:clean(c.email||'',250),
   existingWebsite:website,
   services:services,
   servicesVerified:verifiedServices
  }),
  launchChecks:Object.freeze(checks)
 });
}
root.SBC_ACCOUNT_SUCCESS=Object.freeze({plan:plan});
})(typeof window!=='undefined'?window:globalThis);
