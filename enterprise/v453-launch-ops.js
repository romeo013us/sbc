'use strict';
const crypto=require('crypto');
const VERSION='45.3.8';
const FEATURES=[
  'follow-up-sla-radar','call-note-template','lead-quality-gate','duplicate-intent-guard',
  'customer-context-card','activity-pulse','training-readiness','daily-sales-brief','quick-action-router'
];
function safe(v,n=240){return String(v??'').trim().slice(0,n)}
function leadQuality(c){let score=0;if(c?.businessName)score+=2;if(c?.contactName)score+=2;if(c?.phone)score+=2;if(c?.email)score+=2;if(c?.website)score+=1;if(c?.industry)score+=1;return {score,max:10,label:score>=8?'Sales Ready':score>=5?'Needs Review':'Needs Research'};}
function followUpSla(c,now=Date.now()){if(!c?.followUp)return {status:'unscheduled',days:null};const d=new Date(`${c.followUp}T23:59:59`);const days=Math.ceil((d.getTime()-now)/86400000);return {status:days<0?'overdue':days===0?'due_today':days<=2?'due_soon':'scheduled',days};}
function noteTemplate({outcome='',need='',objection='',packageDiscussed='',nextAction='',followUp=''}){return [`OUTCOME: ${safe(outcome)}`,'NEED: '+safe(need),'OBJECTION: '+safe(objection),'PACKAGE DISCUSSED: '+safe(packageDiscussed),'NEXT ACTION: '+safe(nextAction),'FOLLOW-UP: '+safe(followUp)].join('\n');}
function duplicateFingerprint(c){return crypto.createHash('sha256').update([safe(c?.businessName,160).toLowerCase(),safe(c?.phone,60).replace(/\D/g,''),safe(c?.email,160).toLowerCase()].join('|')).digest('hex');}
function dailyBrief({leads=[],quotes=[],orders=[],callReports=[]}){const today=new Date().toISOString().slice(0,10);return {dueToday:leads.filter(x=>x.followUp===today).length,overdue:leads.filter(x=>followUpSla(x).status==='overdue').length,openQuotes:quotes.filter(x=>!['Won','Paid','Lost'].includes(String(x.status||''))).length,paidOrders:orders.filter(x=>String(x.status||'').toLowerCase()==='paid').length,pendingCalls:callReports.filter(x=>x.status==='Pending').length};}
function trainingReadiness(user,progress={}){const mods=Object.values(progress.modules||{});const completed=mods.filter(x=>x.status==='completed').length;return {username:user?.username||'',role:user?.role||'',completed,started:mods.filter(x=>x.status&&x.status!=='not_started').length,ready:Boolean(user?.certified||completed>=3)};}
function activityPulse(activities=[],userId){const rows=activities.filter(a=>!userId||a.userId===userId||a.meta?.userId===userId);return {last:rows[0]?.createdAt||null,count24h:rows.filter(a=>Date.now()-new Date(a.createdAt).getTime()<86400000).length};}
function quickActions(role){const base=['open-call-center','new-call-note','schedule-follow-up','open-lead','ask-kim'];return role==='owner'?[...base,'open-fulfillment','open-workforce']:base;}
module.exports={VERSION,FEATURES,leadQuality,followUpSla,noteTemplate,duplicateFingerprint,dailyBrief,trainingReadiness,activityPulse,quickActions};
