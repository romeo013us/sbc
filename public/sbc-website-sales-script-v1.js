/* Shared SBC website prospect conversation. One pure, zero-API script for
   the owner Website Production modal and the authenticated sales call desk.
   Read the lines conversationally; pauses are cues, not literal speech. */
(function(factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(typeof window==='object')window.SBC_WEBSITE_SALES_SCRIPT=api;
})(function(){
 'use strict';
 function clean(value,fallback){
  const text=String(value??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
  return text||fallback;
 }
 function build({businessName='your business',googleVerified=false,websitePresence='not_checked',approved=false}={}){
  const business=clean(businessName,'your business');
  const observed=(googleVerified===true&&websitePresence==='not_found')
   ? 'I was looking at your Google Business Profile, and I didn\'t see a website linked there. Do you already have a website?'
   : googleVerified===true
    ? 'I was checking out your Google Business Profile, and I wanted to ask—do you already have a website?'
    : websitePresence==='not_found'
     ? 'I came across your business online and couldn\'t find a website in the information I checked. Do you already have one?'
     : 'I was looking up your business online and wanted to ask—do you already have a website?';
  const no=approved
   ? 'No worries. I went ahead and built a working example of a website for '+business+'. It has real pages you can click through, with example photos and a professional layout. It isn\'t live yet, and the final business details are personalized if you decide to move forward.'
   : 'No worries. I can prepare a website example for '+business+' for you to review once the owner has approved it. Nothing has been published or sent yet.';
  const yes=approved
   ? 'Oh, got it—that\'s good! I also put together an alternative website concept for '+business+'. If you\'re happy with your current site, no pressure at all. Would a quick comparison be useful?'
   : 'That\'s good to hear. Is there anything you wish your current website did better? I can put together a comparison if it would be useful.';
  return [
   'OPEN — keep it friendly and natural',
   'Hey, is this the owner of '+business+'? [PAUSE — let them answer]',
   'Hey, this is [your first name] with Successful By Choice. Have I caught you at a bad time? [PAUSE]',
   '',
   'WHAT I NOTICED — only use the Google line when the research actually verified that profile',
   observed+' [PAUSE — let them answer]',
   '',
   '[IF NO]',
   no,
   '',
   '[IF YES]',
   yes,
   '',
   approved
    ? 'CLOSE — Would you have about 10 minutes for a quick Zoom call later today or tomorrow? I can show you the actual website I made. Which works better for you? [PAUSE — let them choose]'
    : 'NEXT STEP — If you\'re interested, can we arrange a 10-minute Zoom once a website example has been reviewed and approved? [PAUSE]',
   '',
   'IF THEY ASK THE PRICE — The one-page Business Starter is $199, and the four-page Business Basic is $349. We\'d review the exact scope, domain, and hosting before you buy anything.',
   'IF THEY ARE BUSY — All good. Is there a better time for a quick 10-minute look? [PAUSE]',
   'IF THEY SAY NO / DO NOT CALL — No problem. Thanks for your time. Record their preference and stop outreach.',
   '',
   'CALLER REMINDER — Use only verified research observations. Never imply stock photos show the real business, that a website is already live, or that the prospect agreed to be contacted. Only book a meeting after they confirm.'
  ].join('\n');
 }
 return Object.freeze({build});
});
