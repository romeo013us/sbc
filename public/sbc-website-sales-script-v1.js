/* SBC owner-approved conversational website-first calling script.
 * Manual sales wording is owner-controlled. Data-backed claims about Google
 * and customer details are kept separate from conversational coaching.
 * This module never makes calls, builds websites, or sends outreach.
 */
(function(factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(typeof window==='object')window.SBC_WEBSITE_SALES_SCRIPT=api;
})(function(){
 'use strict';
 function clean(v,fallback=''){
  return String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120)||fallback;
 }
 function build({businessName='your business',contactName='',callerName='John',
  googleVerified=false,websitePresence='not_checked',approved=false}={}){
  const business=clean(businessName,'your business');
  const caller=clean(callerName,'John');
  const contact=clean(contactName);
  const intro='Hey, how you doing? My name is '+caller+', calling from SBC. '+
   (contact?'Is this '+contact+'?':'Am I speaking with the owner?')+' [PAUSE]';
  const askOwner='Hey man, I was calling to see if I could get a little help. '+
   'You still own '+business+', right? [PAUSE]';
  const websiteQuestion=googleVerified===true&&websitePresence==='not_found'
   ?"Well, I was looking up your business on Google, and I couldn't find your website. I was trying to see, do you have one? [PAUSE]"
   :'Well, I was looking up your business online. I was trying to see, do you have a website? [PAUSE]';
  return [
   "SBC SMART CALLING · JOHN'S OWNER-APPROVED CONVERSATIONAL SCRIPT",
   '',
   '01 · OPEN — FRIENDLY OWNER CHECK',intro,askOwner,'',
   '02 · ASK — WEBSITE QUESTION',websiteQuestion,'',
   '03 · IF THEY DO NOT HAVE A WEBSITE — THE HOOK',
   approved===true?'WELL, THE THING IS, I BUILT YOU ONE!':'Well, I can prepare a private website concept for you.','',
   'IF THEY ALREADY HAVE A WEBSITE',
   "Oh, that's good! Is there anything you wish your current website did better? I can show you what I had in mind.",'',
   '04 · ASK FOR 10 MINUTES',
   approved===true?'If you have about 10 minutes today or tomorrow, we can jump on a quick Zoom and I can show you what I put together. [PAUSE]':'If you have about 10 minutes today or tomorrow, we can jump on a quick Zoom and discuss a website concept. [PAUSE]',
   'Which works better for you, today or tomorrow? [PAUSE]','',
   'IF INTERESTED — Great! What works better, later today or tomorrow? Confirm the appointment and prepare the actual private concept before the presentation.',
   'IF PRICE COMES UP — Our one-page Starter starts at $199. I can show you the idea and we can see which package fits.',
   "IF BUSY — No worries, I know you're working. Is later today or tomorrow better? [PAUSE]",
   "IF THEY WANT THE LINK — Absolutely. I'll get the private preview ready for you to see during our Zoom.",
   'IF THEY ALREADY USE FACEBOOK — A website can give customers a clear place to see your services and contact you, right alongside Facebook.',
   'IF THEY ASK WHY A WEBSITE HELPS — GET FOUND: Give customers one clear place to discover your verified business and services.',
   'BUILD TRUST: Show accurate contact details, hours and professional design.',
   'GENERATE INQUIRIES: Help visitors call or ask a question when the contact tools are active.',
   'IF THEY ASK ABOUT MONTHLY CARE — An optional 79/month website-care idea is under review, not a live approved package. Verify terms before offering it.',
   'IF THEY SAY NO — Understood. Appreciate your time. Honor any do-not-contact request.',
   '',
   'AFTER THE CALL — Record the real outcome. If interested, create and review the ZIP concept, book the 10-minute Zoom and have the actual preview ready.',
   'CALLING SAFETY — Verify the right business and contact. Follow suppression, consent, and Do Not Call rules. Do not send unreviewed concepts or imply customer authorization.'
  ].join('\n');
 }
 return Object.freeze({build});
});