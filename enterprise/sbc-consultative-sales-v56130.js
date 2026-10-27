'use strict';
const MATRIX=[
 {key:'BUSY',match:t=>/\b(busy|don't have time|do not have time|can't talk|cannot talk)\b/i.test(t),strategy:'INTERRUPTION_BYPASS',goal:'earn a short permission-based continuation',pivot:'Acknowledge the constraint, ask for a 20-second summary or permission to send information; do not pressure.'},
 {key:'ALREADY_HAVE_WEBSITE',match:t=>/already have (a )?website|already have a site/i.test(t),strategy:'CHALLENGER_PIVOT',goal:'diagnose gaps rather than sell another website',pivot:'Ask who handles business email, backups, domain/security and lead acquisition; only recommend a change if a measurable gap exists.'},
 {key:'PRICE',match:t=>/no money|too expensive|can't afford|cannot afford|price|cost/i.test(t),strategy:'VALUE_DIAGNOSIS',goal:'protect fit and avoid unnecessary downgrade',pivot:'Clarify the business constraint and desired outcome before presenting the lowest appropriate offer; never fabricate savings or urgency.'},
 {key:'SEND_INFO',match:t=>/send (me )?(it|something|info|information)|email me/i.test(t),strategy:'MICRO_COMMITMENT',goal:'turn information request into a qualified next step',pivot:'Agree to send the requested information, then ask one concise fit question and establish a follow-up permission.'},
 {key:'PARTNER',match:t=>/need to (ask|talk to|check with) (my )?(partner|owner|spouse|boss)/i.test(t),strategy:'STAKEHOLDER_DISCOVERY',goal:'identify decision criteria and next step',pivot:'Ask what the decision-maker will need to know and secure a specific follow-up rather than pushing the close.'}
];
function evaluateLiveFriction(transcript='',painMarkers=[]){const text=String(transcript||'').trim();const row=MATRIX.find(x=>x.match(text));return row?{...row,matched:true,painMarkers:Array.isArray(painMarkers)?painMarkers.slice(0,12):[]}:{key:'NONE',matched:false,strategy:'CONSULTATIVE_DISCOVERY',goal:'diagnose current acquisition and operational pain',pivot:'Ask one open question about how new customers currently discover and contact the business.'};}
function promptMatrix(){return MATRIX.map(x=>`${x.key}: ${x.goal}. ${x.pivot}`).join('\n');}
module.exports={VERSION:'56.13.0',MATRIX,evaluateLiveFriction,promptMatrix};
