'use strict';

const {CHANNELS,businessDate}=require('./sbc-marketing-readback.cjs');
const Revenue=require('./sbc-revenue-reporting-truth-v66142.cjs');
const {proofFields}=require('./v6640-payment-evidence.cjs');
const INTERVAL=4*3600000;
const ANCHOR=Date.parse('2026-11-27T18:39:00Z');
const channels=Object.keys(CHANNELS);
const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'});
const currentSlot=time=>ANCHOR+Math.floor((time-ANCHOR)/INTERVAL)*INTERVAL;
function daySlots(day){
  const slots=[];
  const midnight=Date.parse(day+'T00:00:00Z');
  for(let at=currentSlot(midnight);at<midnight+32*3600000;at+=INTERVAL){
    if(at>=ANCHOR&&businessDate(at)===day)slots.push({at,slot:hour.format(at),label:hour.format(at)+':39 ET'});
  }
  return slots;
}
// Exact image files previously authorized for the SBC Instagram feed.
const approvedImages=['website','branding','visibility','officebox'].map(topic=>'https://sbcmia.com/assets/social/SBC_'+topic+'_instagram_feed.jpg');
const evergreen=[
 ['website','Website design','Small businesses','en','Can someone visiting your website from their phone find your services, hours, and the next step? SBC builds websites around the questions customers ask first.'],
 ['branding','Print and branding','Local retailers','en','A business card can keep working after the conversation ends. Give customers one clear reason to keep it and one easy way to reach you. Ask SBC about cards for your business.'],
 ['visibility','Local search','Local service businesses','en','Search for your business the way a new customer would. Can they find the right hours, services, and contact details? SBC helps business owners review their Google presence.'],
 ['officebox','Office Box','Service businesses','en','Who needs a callback today? Keeping the customer, their request, and the next follow-up together makes that question easier to answer. Ask SBC about Office Box.'],
 ['website','Diseño web','Negocios locales','es','¿Tus clientes encuentran tus servicios y horarios desde su teléfono? SBC diseña sitios web para que puedan dar el siguiente paso. Cuéntanos qué necesita tu negocio.'],
 ['branding','Tarjetas de presentación','Comercios locales','es','Una tarjeta funciona mejor cuando deja claro qué ofreces y cómo contactarte. En SBC te ayudamos a preparar tarjetas para tu negocio.'],
 ['visibility','Business visibility','Independent shops','en','When did you last check the address and hours customers see online? A small correction can save someone a wasted trip. Ask SBC about a business profile review.'],
 ['officebox','Seguimiento de clientes','Empresas de servicios','es','¿Qué cliente espera una respuesta hoy? Conoce Office Box de SBC y organiza tus contactos y próximas llamadas en un solo lugar.'],
 ['website','Barbershop booking','Barbers and stylists','en','A client sees a cut they like on their phone. Can they find your booking link on the same screen? SBC helps barbers and stylists connect their websites to the booking service they use.'],
 ['visibility','Restaurant hours','Restaurant owners','en','Customers planning dinner look for the menu, hours, and address before they call. SBC can help you put those details together on your website and Google profile.'],
 ['officebox','Quote follow-up','Auto service businesses','en','A customer asked about a repair estimate on Tuesday. Can anyone at the shop find the conversation on Friday? Ask SBC how Office Box can help organize customer follow-ups.'],
 ['branding','Print that leads online','Retail shops and makers','en','What should happen after someone picks up your flyer? Start with one action: see a menu, request a quote, or visit the store. SBC can help with the flyer and its website destination.'],
 ['website','Sitios para talleres','Talleres de autos','es','Cuando alguien busca un taller desde el teléfono, quiere saber qué reparan, dónde están y cómo pedir una cotización. SBC puede ayudarte a mostrar esos datos en tu sitio.'],
 ['visibility','Horarios y ubicación','Restaurantes','es','Antes de salir a cenar, la gente busca el menú, la ubicación y el horario. ¿Son fáciles de encontrar? Pregunta a SBC cómo presentar esa información en línea.'],
 ['branding','Brand consistency','Independent businesses','en','Lay your business card beside your website on a phone. Do the name, colors, and contact details match? SBC works on print and websites together so customers can recognize you in both places.'],
 ['website','Business email','Owner-operated businesses','en','The address on your invoice should be easy to recognize when a customer replies. Ask SBC about setting up business email on your own domain.'],
 ['officebox','Organizar cotizaciones','Empresas de servicios','es','¿Quién pidió una cotización y cuándo toca dar seguimiento? Conoce cómo Office Box de SBC puede ayudarte a organizar esa información para tu equipo.'],
 ['branding','Local signage','Storefront owners','en','A sign has seconds to tell someone what your business is called. Tell SBC where it will go and what you want people to see. Ask about LED and neon-style sign options.'],
 ['visibility','Service area clarity','Mobile service businesses','en','Does your business travel to the customer? Make your service area clear before someone calls for a quote. SBC can help you explain where you work online.'],
 ['website','Getting online','New businesses','en','Starting a business in Texas, California, or New York? SBC can work with you remotely on a domain, website, and business email. Tell us what you are launching.'],
 ['branding','Materiales para tu tienda','Tiendas independientes','es','Compara tu tarjeta de presentación con tu página web. ¿Aparecen el mismo nombre y los mismos datos? SBC trabaja con impresión y diseño web para mantener tu marca reconocible.'],
 ['officebox','First appointments','Appointment-based businesses','en','When someone asks about an appointment, write down what they need and the day you promised to follow up. Ask SBC about keeping those conversations organized in Office Box.'],
 ['website','Una página clara','Negocios nuevos','es','Una página clara puede responder tres preguntas: qué vendes, dónde trabajas y cómo contactarte. Cuéntale a SBC qué quieres que hagan tus visitantes.'],
 ['visibility','Contact details','Miami businesses','en','If someone finds you after closing time, can they still see how to reach you tomorrow? SBC helps Miami businesses put useful contact information where customers look for it.']
].map(([topic,title,audience,locale,body],i)=>({id:'sbc-'+i,title,audience,market:'US',locale,body,image:approvedImages[['website','branding','visibility','officebox'].indexOf(topic)]}));
function validateCampaign(value){
 const fields={title:120,audience:120,market:80,body:1000};
 const result={};
 for(const [name,max] of Object.entries(fields)){
   const val=value?.[name];
   if(typeof val!=='string'||!val.trim()||val.trim().length>max)throw Error('INVALID_CAMPAIGN_'+name.toUpperCase());
   result[name]=val.trim();
 }
 if(!['en','es'].includes(value.locale))throw Error('INVALID_CAMPAIGN_LOCALE');
 if(!approvedImages.includes(value.image))throw Error('SELECT_APPROVED_FEED_ART');
 const selected=value.channels??channels;
 if(!Array.isArray(selected)||!selected.length||selected.some(p=>!channels.includes(p)))throw Error('INVALID_CAMPAIGN_CHANNELS');
 const date=value=>{
   if(!value)return null;
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('INVALID_CAMPAIGN_DATE');
   return value;
 };
 const start=date(value.start),end=date(value.end);
 if(start&&end&&start>end)throw Error('INVALID_CAMPAIGN_WINDOW');
 return {...result,locale:value.locale,image:value.image,channels:[...new Set(selected)],start,end};
}
function buildSlot(at,platform,catalog,trackingOrigin){
 const n=(at-ANCHOR)/INTERVAL, index=channels.indexOf(platform);
 if(!Number.isSafeInteger(n)||n<0||index<0||!catalog.length)throw Error('INVALID_CAMPAIGN_SLOT');
 const day=businessDate(at);
 const eligible=catalog.filter(c=>(!c.channels||c.channels.includes(platform))&&(!c.start||day>=c.start)&&(!c.end||day<=c.end));
 const scheduled=eligible.filter(c=>c.start||c.end);
 const rotation=scheduled.length?scheduled:eligible;
 if(!rotation.length)throw Error('NO_ELIGIBLE_CAMPAIGN');
 const c=rotation[(n+index)%rotation.length];
 const content='sbc-'+at.toString(36)+'-'+platform;
 const url=new URL('https://sbcmia.com/contact.php');
 url.search=new URLSearchParams({utm_source:platform,utm_medium:platform==='google'?'organic_gbp':'organic_social',utm_campaign:'super_sbc_growth',utm_content:content});
 const allowedOrigins=['https://tyvrqnjz57.c24.airoapp.ai','https://app-sbcmia.c24.airoapp.ai','https://sbcmia.com'];
 const link=allowedOrigins.includes(trackingOrigin)?trackingOrigin+'/m/c/'+content:url.href;
 return {at,platform,content,link,campaign:c.id,title:c.title,audience:c.audience,market:c.market,locale:c.locale,body:c.body,image:c.image,url:url.href};
}
// Last recorded matching inquiry before order creation, within 30 days. An
// accepted URL tag is an association; it does not establish incremental lift.
function measure(slots,db,tenant){
 if(!Array.isArray(db?.customers)||!Array.isArray(db?.orders))return null;
 const tags=new Map(slots.filter(s=>s.providerId&&['ACCEPTED','VERIFIED'].includes(s.state)).map(s=>[s.content,s]));
 const byCustomer=new Map(),metrics=new Map();
 for(const s of tags.values()){
   if(!metrics.has(s.campaign))metrics.set(s.campaign,{campaign:s.campaign,trackedVisits:null,inquiries:0,orders:0,grossCapturedCents:0});
   if(s.link&&s.link!==s.url){const m=metrics.get(s.campaign);m.trackedVisits=(m.trackedVisits||0)+s.visits;}
 }
 for(const c of db.customers){
   if(Number(c.tenantId)!==tenant||c._recoveryProjection||['Deleted','Duplicate','Archived'].includes(c.status)||Revenue.isQaCustomer(c))continue;
   const touches=[];
   for(const inquiry of c.leadIntelligence?.customerJourney?.inquiries||[]){
     let u;try{u=new URL(inquiry.sourcePage)}catch{continue}
     const slot=tags.get(u.searchParams.get('utm_content')),at=Date.parse(inquiry.at);
     if(!slot||u.origin!=='https://sbcmia.com'||!Number.isFinite(at)||at<slot.acceptedAt)continue;
     const expected=new URL(slot.url);
     if(['utm_source','utm_medium','utm_campaign','utm_content'].some(k=>u.searchParams.getAll(k).length!==1||u.searchParams.get(k)!==expected.searchParams.get(k)))continue;
     metrics.get(slot.campaign).inquiries++;touches.push({at,campaign:slot.campaign});
   }
   if(touches.length)byCustomer.set(String(c.id),touches.sort((a,b)=>b.at-a.at));
 }
 const paid=Revenue.paidSummary(db.orders,db.customers,{tenantId:tenant});
 for(const order of paid.orders){
   if(order.testMode||order.sbcTest||/refund|charge.?back|void/i.test(order.status||'')||Revenue.parseNotes(order).sbcLaunchQa)continue;
   const created=Date.parse(order.createdAt),captured=Date.parse(proofFields(order).completedAt);
   if(!Number.isFinite(created)||captured<created)continue;
   const touch=byCustomer.get(String(order.customerId))?.find(x=>x.at<=created&&created-x.at<=30*86400000);
   if(touch){const m=metrics.get(touch.campaign);m.orders++;m.grossCapturedCents+=Math.round(Number(order.price??order.total)*100);}
 }
 return [...metrics.values()];
}
module.exports={ANCHOR,INTERVAL,channels,approvedImages,evergreen,currentSlot,daySlots,buildSlot,validateCampaign,measure};
