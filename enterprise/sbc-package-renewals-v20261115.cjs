'use strict';
// SBC owner-approved package and renewal policy. No I/O, payment or notification side effects.
const MS_DAY=86400000;
const SECURITY_COST_CENTS=7188;
const OFFERS=Object.freeze({
 starter:Object.freeze({name:'SBC Business Starter',priceCents:19900,security:'optional',securityAnnualCents:12900,cards:0}),
 basic:Object.freeze({name:'SBC Business Basic',priceCents:49900,security:'optional',securityAnnualCents:7900,cards:100}),
 essentials:Object.freeze({name:'SBC Business Essentials',priceCents:79900,security:'first_year_included',securityAnnualCents:null,cards:500}),
 complete:Object.freeze({name:'SBC Complete Business Launch',priceCents:99900,security:'first_year_included',securityAnnualCents:null,cards:500})
});
const REMIND_DAYS=Object.freeze([90,60,30,14,7,1]);
const isClosed=status=>['PAID','CANCELLED','CANCELED','DECLINED','RENEWED','CLOSED'].includes(String(status||'').trim().toUpperCase());
const ymd=d=>new Date(d).toISOString().slice(0,10);
function parseDay(date){
 if(typeof date!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date))throw Error('VALID_ACTIVATION_DATE_REQUIRED');
 const d=new Date(date+'T12:00:00.000Z');
 if(!Number.isFinite(d.getTime())||ymd(d)!==date)throw Error('VALID_ACTIVATION_DATE_REQUIRED');
 return d;
}
function nextYear(date){
 const d=parseDay(date),year=d.getUTCFullYear()+1,month=d.getUTCMonth(),day=d.getUTCDate();
 const e=new Date(Date.UTC(year,month,day,12));if(e.getUTCMonth()!==month)e.setUTCDate(0);
 return ymd(e);
}
function offer(code){const key=String(code);return Object.hasOwn(OFFERS,key)?OFFERS[key]:null;}
function securityTerms(code,{selected=false}={}){
 const p=offer(code);if(!p)throw Error('UNKNOWN_PACKAGE');
 const included=p.security==='first_year_included';
 return Object.freeze({provided:included||selected===true,firstYearIncluded:included,
 addonFirstYearCents:included?0:(selected===true?p.securityAnnualCents:0),
 customerYearTwoSecurityCents:included?null:(selected===true?p.securityAnnualCents:null),
 renewalRequiresCustomerApproval:true,autoBilledBySbc:false});
}
function checkoutDisclosure(code,{securitySelected=false}={}){
 const p=offer(code),s=securityTerms(code,{selected:securitySelected});
 const website='Domain, hosting, SSL availability and any email subscriptions are subject to the services explicitly listed in your signed order. Website design is a one-time package; provider subscriptions renew separately.';
 const sec=s.firstYearIncluded?'Website Security Standard: first year included; any future price requires a separate owner-approved quote and customer approval.':
 s.provided?'Website Security Standard: $'+(s.addonFirstYearCents/100).toFixed(2)+' for the first year. Renewal is optional and needs customer approval; subsequent pricing is subject to notice.':
 'Website Security Standard: not included. Optional separate annual security service is available.';
 return p.name+': $'+(p.priceCents/100).toFixed(2)+' one-time package price. '+(p.cards?p.cards+' printed business cards included. ':'')+sec+' '+website+' SBC will contact you before any SBC-managed renewal; no automatic SBC charge is authorized by this purchase.';
}
function calcRenewal({tenantId,customerId,orderId,service,activatedOn,providerExpiresOn,packageCode,securitySelected=false,providerReference,paymentProofConfirmed=false,activationProofConfirmed=false,customerAcknowledgedTerms=false,ownerApproved=false}={}){
 if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<1)throw Error('TENANT_REQUIRED');
 if(!String(customerId||'').trim()||!String(orderId||'').trim())throw Error('LINKED_CUSTOMER_ORDER_REQUIRED');
 if([paymentProofConfirmed,activationProofConfirmed,customerAcknowledgedTerms,ownerApproved].some(value=>value!==true))throw Error('VERIFIED_PURCHASE_ACTIVATION_APPROVAL_REQUIRED');
 if(!String(providerReference||'').trim())throw Error('PROVIDER_REFERENCE_REQUIRED');
 const p=offer(packageCode),terms=securityTerms(packageCode,{selected:securitySelected});
 if(!p)throw Error('UNKNOWN_PACKAGE');
 const kind=String(service||'');
 if(!['domain','hosting','email','security'].includes(kind))throw Error('SERVICE_TYPE_INVALID');
 if(kind==='security'&&!terms.provided)throw Error('SECURITY_NOT_PURCHASED');
 parseDay(activatedOn);
 let dueDate;try{dueDate=ymd(parseDay(providerExpiresOn));}catch{throw Error('PROVIDER_EXPIRY_VERIFICATION_REQUIRED');}
 if(dueDate<=activatedOn)throw Error('PROVIDER_EXPIRY_VERIFICATION_REQUIRED');
 const renewalAmountCents=kind==='security'?terms.customerYearTwoSecurityCents:null;
 return Object.freeze({tenantId:Number(tenantId),customerId:String(customerId),orderId:String(orderId),service:kind,
 providerReference:String(providerReference),activatedOn,expiresOn:dueDate,packageCode,
 status:'UPCOMING_OWNER_REVIEW',renewalAmountCents,amountVerifiedForRenewal:false,
 customerRenewalAuthorized:false,automaticCharge:false,providerAutoRenewMustBeReconciled:true,
 reminderDays:[...REMIND_DAYS],source:'SBC_OWNER_VERIFIED_ACTIVATION'});
}
function dueStage(expiresOn,today){
 const delta=Math.round((parseDay(expiresOn)-parseDay(today))/MS_DAY);
 return Object.freeze({daysUntilDue:delta,stage:delta<0?'OVERDUE':delta===0?'DUE_TODAY':delta<=7?'URGENT':delta<=30?'DUE_30':delta<=60?'DUE_60':delta<=90?'DUE_90':'FUTURE',
 ownerReviewNeeded:delta<=90,customerContactNeedsReview:delta<=90,automaticallySent:false});
}
function reminders(expiresOn){const t=parseDay(expiresOn).getTime();return REMIND_DAYS.map(n=>Object.freeze({daysBefore:n,date:ymd(new Date(t-n*MS_DAY)),type:'OWNER_REVIEW_ONLY'}));}
function previewQueue(records,{today,tenantId}={}){
 parseDay(today);
 if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<1)throw Error('TENANT_REQUIRED');
 return (Array.isArray(records)?records:[]).filter(r=>r&&r.customerId&&Number(r.tenantId)===Number(tenantId)&&r.expiresOn&&!isClosed(r.status))
 .map(r=>({...r,due:dueStage(r.expiresOn,today)}))
 .filter(r=>r.due.ownerReviewNeeded).sort((a,b)=>a.due.daysUntilDue-b.due.daysUntilDue);
}
module.exports=Object.freeze({OFFERS,SECURITY_COST_CENTS,REMIND_DAYS,offer,securityTerms,checkoutDisclosure,nextYear,calcRenewal,dueStage,reminders,previewQueue,isClosed});
