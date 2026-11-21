'use strict';
// Exact public SBCMIA V4.4 offers. These do not reprice the older internal catalog.
// Square/economic preflights still apply, including owner-verified product costs.
const OFFERS=Object.freeze({
 starter:Object.freeze({id:'starter',name:'Business Starter',price:199,category:'Package',journeyPackage:'starter',serviceSlug:'website-design',features:['One responsive website page','Confirmed business details, services and contact section','Domain and hosting subject to written first-year terms','SSL available as a separately priced add-on']}),
 'website-custom':Object.freeze({id:'website-custom',name:'Business Custom',price:499,category:'Package',journeyPackage:'custom',serviceSlug:'website-design',features:['Multiple responsive website pages','Editable delivered source','100 matching business cards','SSL available as a separately priced add-on']}),
 quickstart:Object.freeze({id:'quickstart',name:'Business Visibility',price:99,category:'Package',journeyPackage:'visibility',serviceSlug:'google-business-visibility',features:['Google Business Profile setup or cleanup','Up to two social profiles','100 standard business cards per agreed scope','No website included']})
});
function offer(id){return Object.hasOwn(OFFERS,id)?OFFERS[id]:null}
function amountMatches(item,expected){return !!item&&Number.isSafeInteger(expected)&&expected===Math.round(item.price*100)}
module.exports={offer,amountMatches};
