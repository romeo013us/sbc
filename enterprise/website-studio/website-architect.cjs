'use strict';
const {verifiedProfile}=require('./contracts.cjs');
function architectSite(profile,options={}){
 verifiedProfile(profile);
 // Research signals intentionally ignored even if passed in options.
 const {name,category,city}=profile.business,services=profile.services;
 const where=city?` in ${city}`:'';
 const sections=[
  {type:'hero',title:name,description:services.length?`Explore ${services[0].name.toLowerCase()} and other confirmed services${where}. Discover your options and get in touch.`:`Explore ${category.toLowerCase()}${where}. Details are finalized with the business before public launch.`},
 ];
 if(services.length){sections.push({type:'services',title:services.length>=4?'Services tailored to your needs':'Explore our services',description:'Only business-approved offerings are shown.',layout:services.length>=4?'bento':'grid',items:services.map(s=>({title:s.name,description:s.description||'Contact the business for current details.'}))});}
 const approvedReviews=profile.reviews.filter(r=>r.approved===true);
 if(approvedReviews.length)sections.push({type:'socialProof',title:'Customer experiences',description:'Approved customer feedback.',layout:'grid',items:approvedReviews.map(r=>({title:r.quote,attribution:r.attribution}))});
 if(options.quoteEstimatorEnabled===true&&services.length>=2){sections.push({type:'quoteRequest',title:'Plan your service request',description:'Select the confirmed services you would like to discuss. This private concept does not transmit any information.',items:services.map(s=>({title:s.name,description:s.description||''}))});}
 sections.push({type:'contact',title:'Ready to connect?',description:'Use verified contact details. Booking and lead forms require an authorized live integration.'});
 return Object.freeze({schemaVersion:1,kind:'SBCStaticSite',sections});
}
module.exports={architectSite};
