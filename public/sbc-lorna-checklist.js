/* SBC Lorna Research Brief V1: source-aware visual checklist, no AI or auto verification. */
(function(){
'use strict';
var $=id=>document.getElementById(id), f=()=>document.getElementById('lead-form');
var get=(form,key)=>String(form?.elements?.namedItem(key)?.value||'').trim();
var ph=s=>{var d=String(s||'').replace(/\D/g,'');return d.length===10||(d.length===11&&d[0]==='1')};
var em=s=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s||'');
var web=s=>{try{var u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);return /^https?:$/.test(u.protocol)&&!!u.hostname.includes('.')}catch{return false}};
var pres=s=>['found','not_found','not_checked'].includes(s)?s:'not_checked';
var safe=(s,max)=>String(s||'').trim().slice(0,max);
function collect(form){
 if(!form)return {};
 var website=safe(get(form,'website'),300),websitePresence=pres(get(form,'websitePresence'));
 var google=safe(get(form,'googleBusinessUrl'),500),googlePresence=pres(get(form,'googleBusinessPresence'));
 if(website&&web(website))websitePresence='found';
 if(google&&web(google))googlePresence='found';
 return {
   version:1,
   websitePresence,googleBusinessPresence:googlePresence,googleBusinessUrl:google,
   streetAddressVerification:['verified','not_public','conflict'].includes(get(form,'streetAddressVerification'))?get(form,'streetAddressVerification'):'not_checked',
   streetAddressEvidenceUrl:safe(get(form,'streetAddressEvidenceUrl'),1200),
   googleListingAddress:safe(get(form,'googleListingAddress'),350),
   googleAddressVerification:['matches','different','not_published','listing_not_found'].includes(get(form,'googleAddressVerification'))?get(form,'googleAddressVerification'):'not_checked',
   googleAddressEvidenceUrl:safe(get(form,'googleAddressEvidenceUrl'),1200),
   nextFollowupNote:safe(get(form,'nextFollowupNote'),260),
   yearsInBusiness:safe(get(form,'yearsInBusiness'),65)||'Not verified',
   businessHistory:safe(get(form,'businessHistory'),500),
   specificServices:safe(get(form,'specificServices'),500),
   servicesVerified:get(form,'servicesVerified')==='verified',
   likelyCustomerTypes:safe(get(form,'likelyCustomers'),500),
   likelyCustomerTypesStatus:get(form,'likelyCustomersStatus')==='source_verified'?'source_verified':'industry_estimate',
   suggestedSbcOffer:safe(get(form,'suggestedOffer'),180),
   offerCondition:safe(get(form,'offerCondition'),260),
   openingQuestion:safe(get(form,'openingQuestion'),350),
   researchEvidenceUrl:safe(get(form,'researchEvidenceUrl'),1200),
   originalBrief:safe(get(form,'originalResearchBrief'),3500),
   ownerContactVerified:get(form,'ownerContactVerified')==='yes',
   claimedBusinessFactsVerified:false,
   submittedFrom:'researcher_checklist'
 };
}
function score(form){
 var good=[],needed=[],opportunities=[],uncertain=[];
 const name=get(form,'businessName'),contact=get(form,'contactName'),phone=get(form,'phone'),email=get(form,'email'),
 website=get(form,'website'),industry=get(form,'industry'),address=get(form,'address'),source=get(form,'verificationSource');
 const d=collect(form);
 if(name)good.push('Business name recorded');else needed.push('Business name');
 if(contact)good.push('Contact name recorded'+(d.ownerContactVerified?' (researcher checked source)':' (not independently verified)'));
 else needed.push('Decision-maker/contact name, if available');
 if(ph(phone))good.push('Valid phone number format');else needed.push('Usable phone number for calling');
 if(email&&em(email))good.push('Email address format supplied');else if(email)needed.push('Correct email format');else uncertain.push('No email found (calls can still be prepared)');
 if(industry)good.push('Business category recorded');else needed.push('Business category');
 if(address)good.push('Candidate street/business address recorded (not verified until a source is checked)');else uncertain.push('Street address not recorded; research public location or service-area status');
 if(!['verified','not_public'].includes(d.streetAddressVerification))needed.push('Street address verification: verify source, resolve conflict, or document service-area-only status');
 if(d.streetAddressVerification==='verified'&&!address)needed.push('Cannot verify a missing street address');
 if(d.streetAddressVerification==='not_public'&&address)uncertain.push('Service-area business: do not advertise the supplied street address as a storefront');
 else if(!d.streetAddressEvidenceUrl||!web(d.streetAddressEvidenceUrl))needed.push('Street address source: add a reliable public evidence URL');
 else good.push('Street address source and research status recorded');
 if(d.googleBusinessUrl&&!d.googleListingAddress&&d.googleAddressVerification==='not_published')good.push('Google listing is reported as service-area only');
 else if(d.googleBusinessUrl&&!d.googleListingAddress)uncertain.push('Google-listed street address not checked; inspect the actual Maps listing');
 if(!['matches','not_published','listing_not_found'].includes(d.googleAddressVerification))needed.push('Google-listed street address: verify against Maps and flag conflicting addresses');
 if(d.googleAddressVerification==='matches'&&(!d.googleListingAddress||!address))needed.push('To mark a Google address match, record both the street and exact Google-listed address');
 else if(!d.googleAddressEvidenceUrl||!web(d.googleAddressEvidenceUrl))needed.push('Google address evidence: add the actual listing/search source URL');
 else good.push('Google-listed street address status and evidence recorded');
 var sourceIsReal=!!source&&!/^(lead research(?:\s*-\s*bulk import)?|bulk import|csv import|unknown|not verified)$/i.test(source);
 if(sourceIsReal)good.push('Real research source recorded');else needed.push('Actual public research evidence source, not the CSV import channel');
 if(website&&!web(website))needed.push('Check website URL format');
 if(d.websitePresence==='found')good.push('Website found (researcher-reported)');
 else if(d.websitePresence==='not_found')opportunities.push('Website not found after checking: possible website opportunity');
 else uncertain.push('Website not checked; do not claim the business lacks one');
 if(d.googleBusinessPresence==='found')good.push('Google Business Profile found (researcher-reported)');
 else if(d.googleBusinessPresence==='not_found')opportunities.push('Google profile not found after checking: possible visibility opportunity');
 else uncertain.push('Google Business Profile not checked');
 if(d.googleBusinessPresence==='found'&&!d.googleBusinessUrl)uncertain.push('Add the Google profile link when possible');
 if(d.googleBusinessUrl&&!web(d.googleBusinessUrl))needed.push('Fix Google profile link format');
 if(d.yearsInBusiness==='Not verified')uncertain.push('Years in business not verified');
 if(!d.servicesVerified)uncertain.push('Specific services and history not independently verified');
 if(d.suggestedSbcOffer)uncertain.push('Suggested SBC offer is conditional until business needs are confirmed');
 return {good,needed,opportunities,uncertain,complete:!!name&&ph(phone)&&sourceIsReal,fullResearchReady:!!name&&ph(phone)&&sourceIsReal&&needed.length===0,
   safeToCall:false,noMarketingPermissionImplied:true};
}
function render(form){
 var host=$('sbc-research-quality');if(!host||!form)return;
 var r=score(form);
 host.replaceChildren();
 var heading=document.createElement('strong');
 heading.textContent=r.fullResearchReady?'Full research checklist complete — independent SBC review still required':r.complete?'Research intake basics recorded — address / Google research still incomplete':'URGENT · Full research checklist needs attention';
 host.append(heading);
 function group(label,items,cls){
  if(!items.length)return;
  var head=document.createElement('p');head.className='sbc-quality-heading';head.textContent=label+' ('+items.length+')';host.append(head);
  var ul=document.createElement('ul');ul.className='sbc-quality-list '+cls;
  items.forEach(s=>{var li=document.createElement('li');li.textContent=s;ul.append(li)});
  host.append(ul);
 }
 group('Recorded / looks good',r.good,'sbc-positive');
 var progress=document.createElement('p');progress.className='sbc-quality-heading';progress.textContent='Full research checklist · '+r.needed.length+' required gaps · '+r.uncertain.length+' items to confirm';host.append(progress);
 group('Needs attention',r.needed,'sbc-negative');
 group('Possible business opportunities',r.opportunities,'sbc-opportunity');
 group('Unknown / confirm',r.uncertain,'sbc-unknown');
}
function parseBrief(raw,form){
 var txt=String(raw||'').replace(/\r/g,'').replace(/\*\*/g,'').trim();
 var lines=txt.split('\n'),parts={},last='';
 const fields=/^(Owner|Phone|Email|Status|Website|Years in business|Likely customer types|Suggested SBC offer|Suggested opening question|CRM category|Notes|Specific services|Business history|Contact person)$/i;
 for(var i=0;i<lines.length;i++){
  var line=lines[i].trim().replace(/^[-*]\s+/,'');
  if(!line)continue;
  var withColon=/^([^:]{2,45})\s*:\s*(.*)$/.exec(line);
  if(withColon&&fields.test(withColon[1].trim())){
   var key=withColon[1].trim().toLowerCase(),value=withColon[2].trim();
   if(key==='crm category')value=value.replace(/\.\s*(?:Specific services|Business history).*$/i,'').trim();
   parts[key]=value;last=value?'':key;continue;
  }
  if(fields.test(line)){last=line.toLowerCase();parts[last]='';continue;}
  if(last&&line.length<600){parts[last]=line;last='';}
 }
 // Descriptive uncertainty is not verification: keep the supplied caveat.
 if(/specific services and business history have not been independently checked/i.test(txt)&&
    !parts['business history'])parts['business history']='Specific services and business history have not been independently checked.';

 const set=(field,value)=>{var inp=form.elements.namedItem(field);if(inp&&value&&!get(form,field))inp.value=value.slice(0,inp.maxLength>0?inp.maxLength:500)};
 set('contactName',parts.owner||parts['contact person']);
 // Extended CRM brief labels; missing fields are never invented or auto-verified.
 var pairs=[['Business name','businessName'],['Decision maker','contactName'],['Primary phone','phone'],['Street / city / state / ZIP','address'],['Google Business Profile','googleBusinessUrl'],['Google-listed street address','googleListingAddress'],['Google address','googleListingAddress'],['Address research','streetAddressEvidenceUrl'],['Industry / business type','industry'],['Research source','verificationSource'],['Next follow-up','nextFollowupNote']];
 pairs.forEach(function(pair){
  var label=pair[0],hit=txt.match(new RegExp('(?:^|\\n)\\s*'+label+'\\s*[:—-]?\\s*([^\\n]+)','i'));
  if(hit){var v=hit[1].trim();if(!/^(not recorded|none|—|not verified)$/i.test(v)&&!/^\[/.test(v))set(pair[1],v);}
 });
 var mapsLink=txt.match(/https:\/\/(?:maps\.app\.goo\.gl|www\.google\.com\/maps|maps\.google\.com)\/[^\s)\]>]+/i);
 if(mapsLink)set('googleBusinessUrl',mapsLink[0].replace(/[.,]+$/,''));
 set('phone',parts.phone);
 if(parts.email&&!/^(—|none|not recorded)$/i.test(parts.email))set('email',parts.email);
 set('industry',parts['crm category']);
 set('likelyCustomers',parts['likely customer types']);
 set('yearsInBusiness',parts['years in business']);
 set('suggestedOffer',parts['suggested sbc offer']);
 set('openingQuestion',parts['suggested opening question']);
 set('specificServices',parts['specific services']);
 set('businessHistory',parts['business history']);
 if(parts.website&&/^https?:\/\/\S+/i.test(parts.website))set('website',parts.website);
 if(parts.website&&/not recorded|not verified/i.test(parts.website))
  form.elements.namedItem('websitePresence').value='not_checked';
 var link=txt.match(/https?:\/\/[^\s)\]>]+/i);
 if(link)set('researchEvidenceUrl',link[0].replace(/[.,]+$/,''));
 if(parts.notes)set('notes',parts.notes);
 render(form);
}
function init(){
 var form=f();if(!form||!$('sbc-research-quality'))return;
 form.addEventListener('input',()=>render(form));
 form.addEventListener('change',()=>render(form));
 form.addEventListener('reset',()=>setTimeout(()=>render(form),0));
 $('sbc-brief-paste-apply')?.addEventListener('click',()=>parseBrief(get(form,'originalResearchBrief'),form));
 render(form);
}
window.SBCResearchBriefV1={collect,score,render,parseBrief};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();