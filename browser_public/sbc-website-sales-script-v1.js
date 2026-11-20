/* SBC Website-First Owner Sales Script — no API calls or outreach.
 * A verified Google observation and a genuinely approved demo are required
 * before the matching statements are included. Works in production/call desk.
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
  ownerVerified=false,googleVerified=false,websitePresence='not_checked',approved=false}={}){
  const business=clean(businessName,'your business');
  const caller=clean(callerName,'John');
  const contact=clean(contactName);
  const opening='Hi, my name is '+caller+' calling from SBC. '+(contact?'Is this '+contact+'?':'Am I speaking with the owner?')+' [PAUSE]';
  const ownerQuestion=ownerVerified
   ? 'Hey, I was wondering if I could get a little help. You still own '+business+', right? [PAUSE]'
   : 'Hey, I was wondering if you could help me out real quick. Are you the person who owns '+business+'? [PAUSE]';
  const observed=googleVerified===true&&websitePresence==='not_found'
   ? "Well, I was looking at your Google Business Profile, and I didn't see a website linked there. Do you already have a website? [PAUSE]"
   : googleVerified===true
    ? 'Well, I was looking up '+business+' on Google, and I wanted to ask—do you already have a website? [PAUSE]'
    : websitePresence==='not_found'
     ? "I was looking up your business online and couldn't find a website in the information I checked. Do you already have a website? [PAUSE]"
     : 'I was looking up your business online and wanted to ask—do you already have a website? [PAUSE]';
  const hook=approved===true
   ? "Well, here's the thing—I built one! I put together a private website concept for "+business+
     ". It's a working example, not your live website. Any sample photos or services need your confirmation before publishing."
   : "That's actually why I called. I've got an idea for a website for "+business+
     "—and I can have a concept ready to show you on Zoom. I think you'll like what we can put together.";
  const already=approved===true
   ? "Oh, that's good! I also built a separate website concept for your business. If you're happy with your current site, no pressure. Would a quick comparison be useful?"
   : "That's good to hear! Is there anything you wish your current website did better? If it's useful, I can prepare an alternative concept.";
  const close=approved===true
   ? "Look, I'm not trying to take up your whole day. Do you have about 10 minutes today or tomorrow? I can schedule a call and show you what I built. Which works better? [PAUSE]"
   : "If you have about 10 minutes today or tomorrow, we can jump on Zoom and I can show you a concept. Which works better? [PAUSE]";
  return [
   'SBC SMART CALLING · FRIENDLY, HONEST WEBSITE-FIRST PITCH',
   '',
   '01 · OPEN — ask for the owner',
   opening,ownerQuestion,'',
   '02 · ASK — only mention what research actually verified',observed,'',
   '03 · IF NO WEBSITE — THE HOOK',hook,'',
   'IF THEY ALREADY HAVE A WEBSITE',already,'',
   '04 · ASK FOR 10 MINUTES',close,'',
   'IF INTERESTED — Great! What works better, later today or tomorrow? Confirm the appointment before logging it.',
   'IF THEY ASK PRICE — Our one-page Starter starts at $199. Other packages depend on your needs; we confirm exactly what is included before any purchase.',
   "IF THEY ARE BUSY — No worries, I know you're working. Would another time work better for a quick look? [PAUSE]",
   "IF THEY ASK TO SEE THE LINK — Happy to show the private, owner-approved preview. Confirm where you want it sent before sending anything.",
   'IF THEY HAVE FACEBOOK — That is great. A website can complement Facebook with a clear place for your services, contact details and inquiries.',
   'IF THEY ASK WHY THEY NEED A WEBSITE — GET FOUND: Have a clear place for customers to discover your verified services and location.',
   'BUILD TRUST: Show accurate business information and a professional design. No rankings or sales are guaranteed.',
   'GENERATE INQUIRIES: Make it easier for interested customers to call, request a quote or book when those features are enabled.',
   'IF THEY ASK ABOUT OPTIONAL CARE — An optional 79/month management idea is being considered, not an approved live package. Confirm all scope, recurrence and cancellation terms with SBC before selling it.',
   'IF THEY SAY NO — Understood, thanks for your time. Log the refusal accurately. Honor any do-not-contact request.',
   '',
   'AFTER THE CALL — Log the actual outcome and notes. If they agree, book the 10-minute appointment or record the requested follow-up date.',
   'SAFETY — Do not claim a website is built unless an approved live preview exists in SBC. Do not assume a missing website or known owner. Do not dial a restricted or suppressed number.'
  ].join('\n');
 }
 return Object.freeze({build});
});
