'use strict';
/* SBC signed mailbox bridge. Connect via a server-side automation that reads
 * the existing info@sbcmia.com inbox; never change its MX or expose the secret.
 * The bridge reviews incoming replies; it does NOT send email or auto-book.
 */
const crypto=require('node:crypto');
const LEDGER=require('./sbc-outreach-consent-ledger.cjs');
const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
const tenant=v=>Number(v?.tenantId??v?.tenant_id);
const email=v=>clean(v,254).toLowerCase();
const validEmail=v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
function verify(raw,headers,env=process.env,now=Date.now()){
 const secret=String(env.SBC_MAIL_RELAY_SECRET||'');
 if(secret.length<32||!Buffer.isBuffer(raw)||raw.length===0||raw.length>128*1024)return false;
 const ts=clean(headers?.timestamp,24);
 const sig=clean(headers?.signature,90).replace(/^sha256=/i,'');
 if(!/^\d{10}$/.test(ts)||!/^[0-9a-f]{64}$/i.test(sig))return false;
 if(Math.abs(Number(ts)*1000-now)>300000)return false;
 const mac=crypto.createHmac('sha256',secret).update(ts).update('.').update(raw).digest();
 const candidate=Buffer.from(sig,'hex');
 return candidate.length===mac.length&&crypto.timingSafeEqual(candidate,mac);
}
function classify(text){
 const v=clean(text,2500).replace(/\s+/g,' ').toLowerCase();
 if(/^(unsubscribe|stop|remove me|stop emailing me|no more emails)[.! ]*$/.test(v))return 'UNSUBSCRIBE';
 if(/\b(appointment|schedule|meeting|book a call|call me at|can we talk|demo|show me|show us)\b/.test(v))
  return 'POSSIBLE_APPOINTMENT';
 if(/\b(interested|tell me more|send (me|us) (the )?(link|details)|how much|pricing|quote|estimate)\b/.test(v))
  return 'POSSIBLE_INTEREST';
 return 'REVIEW_REPLY';
}
function apply(db,payload,{now=()=>new Date().toISOString(),makeId=()=>crypto.randomUUID()}={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(Error('MAIL_EVENT_REQUIRED'),{status:422});
 const t=Number(payload.tenantId),from=email(payload.fromAddress),to=email(payload.toAddress);
 const msg=clean(payload.messageId,190),subject=clean(payload.subject,190),
       body=clean(payload.text,2400);
 if(!Number.isSafeInteger(t)||t<1||!validEmail(from)||!validEmail(to)||
    to!=='info@sbcmia.com'||!msg||!body||from===to)
  throw Object.assign(Error('INVALID_VERIFIED_INBOUND_FIELDS'),{status:422});
 const contacts=(db.customers||[]).filter(c=>tenant(c)===t&&email(c.email)===from);
 if(contacts.length!==1)throw Object.assign(Error('INBOUND_CONTACT_NOT_UNIQUE'),{status:409});
 const c=contacts[0];
 const candidates=(db.tasks||[]).filter(x=>tenant(x)===t&&x.type==='SBC Next-Day Call'&&
   String(x.customerId)===String(c.id)&&x.outboundEmailStatus&&
   !/^SUBMISSION_UNCONFIRMED|^SUBMISSION_IN_PROGRESS/.test(String(x.outboundEmailStatus)));
 if(!candidates.length)throw Object.assign(Error('NO_PREVIOUS_CONFIRMED_OUTBOUND_EMAIL'),{status:422});
 const task=candidates.sort((a,b)=>
  Date.parse(b.outboundEmailAcceptedAt||b.createdAt||0)-Date.parse(a.outboundEmailAcceptedAt||a.createdAt||0))[0];
 if((task.inboundReplyIds||[]).includes(msg))return {ok:true,duplicate:true,customerId:c.id,changed:false};
 const date=now(),kind=classify(body),oldLi=LEDGER.snapshot(c);
 const oldTask={replyStatus:task.replyStatus,replyAt:task.replyAt,replyNotes:task.replyNotes,
  inboundReplyIds:task.inboundReplyIds,inboundReplyMessageId:task.inboundReplyMessageId};
 const dueTask={id:makeId('task'),tenantId:t,customerId:String(c.id),
  customerName:clean(c.businessName||c.contactName,140),
  title:kind==='POSSIBLE_APPOINTMENT'?'Review incoming appointment inquiry':'Review incoming email reply',
  dueAt:date,type:'SBC Inbound Reply Review',priority:'High',status:'Open',
  notes:'Authenticated mailbox relay, sender identity unverified. From: '+from+'\nSubject: '+subject+
   '\nExcerpt: '+body.slice(0,500)+'\nClassification: '+kind+
   '\nConfirm the customer’s intent/time before booking. No automated reply was sent.',
  assignedTo:'',assignedToName:'Owner',createdBy:'signed-mailbox-relay',
  createdAt:date,updatedAt:date};
 task.inboundReplyIds=[...(task.inboundReplyIds||[]),msg].slice(-50);
 task.inboundReplyMessageId=msg;task.replyStatus=kind==='UNSUBSCRIBE'?'UNSUBSCRIBE':'RECEIVED_REVIEW_REQUIRED';
 task.replyAt=date;task.replyNotes=body.slice(0,600);
 LEDGER.mutate(c,{lastInboundAt:date,lastInboundKind:kind});
 if(kind==='UNSUBSCRIBE')LEDGER.suppress(c,{reason:'SIGNED_MAILBOX_OPT_OUT',at:date});
 if(!Array.isArray(db.tasks))db.tasks=[];
 db.tasks.unshift(dueTask);
 return {ok:true,duplicate:false,changed:true,kind,customerId:c.id,reviewTaskId:dueTask.id,
  undo:()=>{const idx=db.tasks.indexOf(dueTask);if(idx>=0)db.tasks.splice(idx,1);
   Object.assign(task,oldTask);LEDGER.restore(c,oldLi)}};
}
module.exports={verify,classify,apply};
