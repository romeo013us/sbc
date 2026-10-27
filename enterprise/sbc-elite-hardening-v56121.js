// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto = require('crypto');
const EventEmitter = require('events');

const VERSION = '56.12.2';
const bus = new EventEmitter();
bus.setMaxListeners(500);
const activeSessions = new Map();
const frozenLeads = new Set();
const lastTelemetry = new Map();
const memoryCache = new Map();
const objectionPatterns = [
  ['NO_BUDGET', /\b(no budget|can't afford|cannot afford|too expensive|not in the budget|don't have the money)\b/i],
  ['SEND_ME_SOMETHING', /\b(send (me|us) (an?|the) (email|info|information|details|quote)|email me|send it over)\b/i],
  ['TOO_BUSY', /\b(too busy|busy right now|bad time|can't talk|cannot talk)\b/i],
  ['ALREADY_HAVE_WEBSITE', /\b(already have (a |an )?website|we have a website)\b/i],
  ['ALREADY_HAVE_PROVIDER', /\b(already have (a |an )?(provider|company|agency)|someone handles (our|my) (website|marketing|hosting))\b/i],
  ['NEED_TO_THINK', /\b(need to think|let me think|think about it|sleep on it)\b/i],
  ['NEED_PARTNER', /\b(talk to my (partner|husband|wife|owner|boss)|need (my )?(partner|owner|boss) to approve)\b/i],
  ['NOT_INTERESTED', /\b(not interested|don't call me|do not call me|stop calling|remove me)\b/i]
];

const STATE = Object.freeze({CONNECTING:'CONNECTING',RINGING:'RINGING',CONNECTED:'CONNECTED',LISTENING:'LISTENING',SPEAKING:'SPEAKING',INTERRUPTED:'INTERRUPTED',OBJECTION:'OBJECTION',HANDOFF:'HANDOFF',ENDED:'ENDED',BLOCKED:'BLOCKED'});
const DISCOVERY = Object.freeze({
  DEFAULT:[
    {id:'presence',question:'How are customers currently finding and contacting you online?',signals:['website','google','phone','facebook','instagram']},
    {id:'missed_calls',question:'When someone calls and nobody answers, what happens next?',signals:['missed','voicemail','callback','lost']},
    {id:'profile',question:'How confident are you that your Google Business Profile accurately represents the business today?',signals:['google','profile','reviews','hours','photos']},
    {id:'conversion',question:'What usually stops a person who finds you online from becoming a customer?',signals:['booking','quote','contact','follow up','conversion']},
    {id:'systems',question:'What part of your current business technology gives you the most headaches?',signals:['email','hosting','security','backup','website']}
  ],
  LOCAL_SERVICE:[
    {id:'lead_flow',question:'When a new customer searches for you, what do you want them to do first?',signals:['call','book','quote','message']},
    {id:'missed_calls',question:'How often do good calls come in when nobody is available to answer?',signals:['missed','after hours','voicemail']},
    {id:'local_presence',question:'Is your Google profile bringing you the kind of customers you actually want?',signals:['google','maps','reviews','photos']},
    {id:'followup',question:'Once someone asks for a quote, how quickly does your business follow up?',signals:['quote','follow up','speed','response']}
  ],
  PROFESSIONAL:[
    {id:'trust',question:'What does a new prospect need to see before they trust your firm enough to contact you?',signals:['trust','credibility','reviews','authority']},
    {id:'intake',question:'Where does your intake process lose the most potential clients?',signals:['intake','phone','form','email','follow up']},
    {id:'capacity',question:'If demand increased tomorrow, which part of your process would break first?',signals:['capacity','staff','calls','appointments']}
  ],
  RETAIL:[
    {id:'discovery',question:'What is the easiest way for a new customer to find out what you sell and come in?',signals:['google','store','hours','products']},
    {id:'conversion',question:'What usually makes someone look but not buy?',signals:['price','selection','trust','online']},
    {id:'retention',question:'What do you do today to bring a first-time buyer back?',signals:['repeat','review','loyalty','follow up']}
  ]
});

function now(){return new Date().toISOString();}
function id(p){return `${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;}
function clean(v,n=4000){return String(v??'').trim().slice(0,n);}
function bool(v){return v===true||String(v||'').toLowerCase()==='true'||String(v||'')==='1';}
function sqlDate(v=now()){return new Date(v).toISOString().slice(0,19).replace('T',' ');}
function parse(v,f={}){try{return typeof v==='string'?JSON.parse(v||''):v??f}catch{return f;}}
function hash(prev,payload){return crypto.createHash('sha256').update(`${prev||''}|${JSON.stringify(payload)}`).digest('hex');}

function timezoneForCustomer(c={}){
  if(c.timeZone||c.timezone)return String(c.timeZone||c.timezone);
  const state=String(c.state||c.province||'').toUpperCase();
  const map={FL:'America/New_York',NY:'America/New_York',GA:'America/New_York',NC:'America/New_York',SC:'America/New_York',VA:'America/New_York',OH:'America/New_York',PA:'America/New_York',NJ:'America/New_York',MA:'America/New_York',TX:'America/Chicago',IL:'America/Chicago',LA:'America/Chicago',MS:'America/Chicago',AL:'America/Chicago',TN:'America/Chicago',OK:'America/Chicago',AR:'America/Chicago',MN:'America/Chicago',MO:'America/Chicago',WI:'America/Chicago',CO:'America/Denver',NM:'America/Denver',UT:'America/Denver',AZ:'America/Phoenix',CA:'America/Los_Angeles',WA:'America/Los_Angeles',OR:'America/Los_Angeles',NV:'America/Los_Angeles'};
  return map[state]||'America/New_York';
}
function callWindowGate(customer={},date=new Date()){
  const tz=timezoneForCustomer(customer);
  let hour=Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hour12:false,timeZone:tz}).format(date));
  let minute=Number(new Intl.DateTimeFormat('en-US',{minute:'2-digit',hour12:false,timeZone:tz}).format(date));
  const localMinutes=hour*60+minute;
  const start=8*60,end=21*60;
  const allowed=localMinutes>=start&&localMinutes<end;
  return {allowed,timeZone:tz,localTime:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,window:'08:00-21:00 local',reason:allowed?'WITHIN_LOCAL_CALLING_WINDOW':'OUTSIDE_LOCAL_CALLING_WINDOW'};
}
function isolateObjection(text=''){
  const s=clean(text,3000);
  for(const [key,re] of objectionPatterns)if(re.test(s))return {key,matched:true,source:s.slice(0,500)};
  return {key:'',matched:false,source:''};
}
function discoveryTree(customer={},profile={},history=[]){
  const key=String(profile.industryKey||'DEFAULT');
  const tree=DISCOVERY[key]||DISCOVERY.DEFAULT;
  const text=history.map(x=>String(x.transcript||'')).join(' ').toLowerCase();
  const visited=new Set(history.flatMap(x=>Array.isArray(x.discoveryIds)?x.discoveryIds:[]));
  const next=tree.find(n=>!visited.has(n.id)&&!n.signals.some(s=>text.includes(s)))||tree.find(n=>!visited.has(n.id))||tree[0];
  const uncovered=tree.filter(n=>!visited.has(n.id)).map(n=>n.id);
  return {industryKey:key,nextNode:next,uncoveredNodes:uncovered,nonLinear:true,rule:'Ask only the next highest-value unanswered question; branch from the prospect\'s answer.'};
}

class EliteHardening {
  constructor({db,mysqlPool,saveData,sendSms,sendEmail}={}){this.db=db||{};this.pool=mysqlPool;this.saveData=saveData||(()=>Promise.resolve());this.sendSms=sendSms;this.sendEmail=sendEmail;}
  async ensureTables(){
    if(!this.pool)return;
    const q=[
      `CREATE TABLE IF NOT EXISTS sbc_closer_memory_v56121(id VARCHAR(90) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,summary LONGTEXT,objections_json LONGTEXT,owner_details_json LONGTEXT,last_stage VARCHAR(40),intent_score INT NOT NULL DEFAULT 0,updated_at DATETIME NOT NULL,created_at DATETIME NOT NULL,INDEX idx_mem_lead(tenant_id,lead_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_closer_telemetry_v56121(id VARCHAR(90) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,channel VARCHAR(20) NOT NULL,state VARCHAR(40) NOT NULL,stage VARCHAR(40) NOT NULL,intent_score INT NOT NULL DEFAULT 0,objection_key VARCHAR(80) NOT NULL DEFAULT '',meta_json LONGTEXT,created_at DATETIME NOT NULL,INDEX idx_tel_live(tenant_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_closer_handshakes_v56121(id VARCHAR(90) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,trigger_status VARCHAR(40) NOT NULL,channel VARCHAR(20) NOT NULL,consent_verified TINYINT(1) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',payload_json LONGTEXT,created_at DATETIME NOT NULL,processed_at DATETIME NULL,INDEX idx_hs(tenant_id,status,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_closer_experiment_hooks_v56121(id VARCHAR(90) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,name VARCHAR(160) NOT NULL,variant VARCHAR(100) NOT NULL,hook_text LONGTEXT NOT NULL,impressions INT NOT NULL DEFAULT 0,conversations INT NOT NULL DEFAULT 0,offers INT NOT NULL DEFAULT 0,sales INT NOT NULL DEFAULT 0,revenue DECIMAL(12,2) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_hook(tenant_id,name,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_p2p_expense_ledger_v56121(id VARCHAR(90) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,expense_date DATETIME NOT NULL,category VARCHAR(80) NOT NULL,description VARCHAR(500) NOT NULL,amount DECIMAL(12,2) NOT NULL,submitted_by VARCHAR(120) NOT NULL,prev_hash CHAR(64) NOT NULL,entry_hash CHAR(64) NOT NULL,created_at DATETIME NOT NULL,INDEX idx_expense(tenant_id,expense_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for(const x of q)await this.pool.query(x);
  }
  publish(evt={}){const e={id:id('tel'),version:VERSION,at:now(),...evt};lastTelemetry.set(String(e.leadId||e.sessionId||e.id),e);bus.emit('telemetry',e);if(this.pool)this.pool.query('INSERT INTO sbc_closer_telemetry_v56121(id,tenant_id,lead_id,channel,state,stage,intent_score,objection_key,meta_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[e.id,Number(__sbcRequireTenantId(e.tenantId)),String(e.leadId||''),String(e.channel||'PHONE'),String(e.state||'CONNECTED'),String(e.stage||'DISCOVERY'),Number(e.intentScore||0),String(e.objectionKey||''),JSON.stringify(e.meta||{}),sqlDate(e.at)]).catch(()=>{});return e;}
  snapshot(){return {version:VERSION,activeSessions:[...activeSessions.values()],frozenLeads:[...frozenLeads],recent:[...lastTelemetry.values()].slice(-100)};}
  sessionStart(x={}){const s={sessionId:x.sessionId||id('sess'),leadId:String(x.leadId||''),tenantId:Number(__sbcRequireTenantId(x.tenantId)),channel:x.channel||'PHONE',state:STATE.CONNECTING,stage:x.stage||'ATTENTION',intentScore:Number(x.intentScore||0),startedAt:now(),lastEventAt:now()};activeSessions.set(s.sessionId,s);this.publish(s);return s;}
  sessionUpdate(sessionId,patch={}){const s=activeSessions.get(sessionId)||{sessionId};Object.assign(s,patch,{sessionId,lastEventAt:now()});activeSessions.set(sessionId,s);this.publish(s);return s;}
  sessionEnd(sessionId,outcome='ENDED'){const s=activeSessions.get(sessionId);if(!s)return null;s.state=outcome==='HANDOFF'?STATE.HANDOFF:STATE.ENDED;s.lastEventAt=now();this.publish(s);activeSessions.delete(sessionId);return s;}
  freezeLead(leadId,reason='HOT_LEAD_HANDOFF'){frozenLeads.add(String(leadId));this.publish({leadId:String(leadId),state:STATE.HANDOFF,stage:'HANDOFF',meta:{frozen:true,reason}});return {frozen:true,leadId:String(leadId),reason};}
  isFrozen(leadId){return frozenLeads.has(String(leadId));}
  async persistMemory(customer={},data={}){const leadId=String(customer.id||data.leadId||'');const row={id:id('mem'),tenantId:Number(customer.tenantId||__sbcRequireTenantId(data.tenantId)),leadId,summary:clean(data.summary||'',10000),objections:Array.isArray(data.objections)?data.objections:[],ownerDetails:data.ownerDetails||{contactName:customer.contactName||'',businessName:customer.businessName||'',phone:customer.phone||'',email:customer.email||''},lastStage:String(data.stage||'DISCOVERY'),intentScore:Number(data.intentScore||0),updatedAt:now(),createdAt:now()};memoryCache.set(leadId,row);if(this.pool)await this.pool.query(`INSERT INTO sbc_closer_memory_v56121(id,tenant_id,lead_id,summary,objections_json,owner_details_json,last_stage,intent_score,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE summary=VALUES(summary),objections_json=VALUES(objections_json),owner_details_json=VALUES(owner_details_json),last_stage=VALUES(last_stage),intent_score=VALUES(intent_score),updated_at=VALUES(updated_at)`,[row.id,row.tenantId,row.leadId,row.summary,JSON.stringify(row.objections),JSON.stringify(row.ownerDetails),row.lastStage,row.intentScore,sqlDate(row.updatedAt),sqlDate(row.createdAt)]);return row;}
  async memory(leadId,tenantId=1){const c=memoryCache.get(String(leadId));if(c)return c;if(this.pool){const [r]=await this.pool.query('SELECT * FROM sbc_closer_memory_v56121 WHERE tenant_id=? AND lead_id=? ORDER BY updated_at DESC LIMIT 1',[tenantId,String(leadId)]);if(r[0])return {...r[0],objections:parse(r[0].objections_json,[]),ownerDetails:parse(r[0].owner_details_json,{})};}return null;}
  async queueHandshake(customer={},status='NO_ANSWER',metadata={}){const smsConsent=bool(customer.smsOptIn)||bool(customer.smsConsent)||bool(customer.consentToSms);const emailReady=Boolean(customer.email);const channel=smsConsent?'SMS':emailReady?'EMAIL':'';if(!channel)return {queued:false,reason:'NO_CONSENTED_ASYNC_CHANNEL'};const row={id:id('hs'),tenantId:Number(__sbcRequireTenantId(customer.tenantId)),leadId:String(customer.id||''),triggerStatus:String(status),channel,consentVerified:true,status:'QUEUED',payload:{businessName:customer.businessName||'',email:customer.email||'',phone:customer.phone||'',metadata},createdAt:now()};if(this.pool)await this.pool.query('INSERT INTO sbc_closer_handshakes_v56121(id,tenant_id,lead_id,trigger_status,channel,consent_verified,status,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[row.id,row.tenantId,row.leadId,row.triggerStatus,row.channel,1,row.status,JSON.stringify(row.payload),sqlDate(row.createdAt)]);return row;}
  async processHandshake(row,customer){if(!row||row.status==='SENT')return row;try{let result=null;if(row.channel==='SMS'&&this.sendSms)result=await this.sendSms(customer,`Hi, this is Kim with SBC. I just tried to reach you about ${customer.businessName||'your business'}. Reply here if text is easier and we can continue from where the call left off.`);else if(row.channel==='EMAIL'&&this.sendEmail)result=await this.sendEmail(customer,`Quick follow-up from SBC`, `Hi ${customer.contactName||''},\n\nI just tried to reach you about ${customer.businessName||'your business'}. If email is easier, reply here and we can continue from where the call left off.\n\n— SBC`);else return {...row,status:'WAITING_PROVIDER'};row.status='SENT';row.processedAt=now();row.result=result||null;if(this.pool)await this.pool.query('UPDATE sbc_closer_handshakes_v56121 SET status=?,processed_at=?,payload_json=? WHERE id=?',['SENT',sqlDate(row.processedAt),JSON.stringify({...row.payload,result}),row.id]);return row;}catch(e){row.status='FAILED';row.error=e.message;return row;}}
  ledgerMetrics({interactions=[],calls=[],revenueEvents=[]}={}){const conv=interactions.filter(x=>/CONVERSATION|CONNECTED|CALL_CONNECTED/.test(String(x.outcome||'')));const sales=interactions.filter(x=>/SALE|WON|CLOSED/.test(String(x.outcome||'')));const revenue=sales.reduce((n,x)=>n+Number(x.revenue||0),0);const seconds=calls.reduce((n,x)=>n+Number(x.durationSeconds||0),0);return {aiHours:seconds/3600,revenue,revenuePerAIHour:seconds?revenue/(seconds/3600):0,conversations:conv.length,sales:sales.length,closeRate:sales.length/Math.max(1,conv.length),averageOrderValue:sales.length?revenue/sales.length:0};}
  async createHook({tenantId=1,name,variant,hookText}={}){
    if(!name||!variant||!hookText)throw new Error('name, variant and hookText are required.');
    const row={id:id('hook'),tenantId:Number(tenantId),name:clean(name,160),variant:clean(variant,100),hookText:clean(hookText,3000),impressions:0,conversations:0,offers:0,sales:0,revenue:0,status:'ACTIVE',createdAt:now(),updatedAt:now()};
    if(this.pool)await this.pool.query('INSERT INTO sbc_closer_experiment_hooks_v56121(id,tenant_id,name,variant,hook_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',[row.id,row.tenantId,row.name,row.variant,row.hookText,sqlDate(row.createdAt),sqlDate(row.updatedAt)]);
    return row;
  }
  async recordHookOutcome({tenantId=1,name,variant,type,revenue=0}={}){
    const field={IMPRESSION:'impressions',CONVERSATION:'conversations',OFFER:'offers',SALE:'sales'}[String(type||'').toUpperCase()];
    if(!field)throw new Error('Unsupported hook outcome.');
    if(this.pool)await this.pool.query(`UPDATE sbc_closer_experiment_hooks_v56121 SET ${field}=${field}+1,revenue=revenue+?,updated_at=? WHERE tenant_id=? AND name=? AND variant=?`,[Number(revenue||0),sqlDate(),tenantId,String(name),String(variant)]);
    return {ok:true};
  }
  async chooseHook({tenantId=1,name}={}){
    if(!this.pool)return null;
    const [rows]=await this.pool.query("SELECT * FROM sbc_closer_experiment_hooks_v56121 WHERE tenant_id=? AND name=? AND status IN ('ACTIVE','LEADING') ORDER BY status DESC,impressions ASC",[tenantId,String(name)]);
    if(!rows.length)return null;
    const leading=rows.find(r=>r.status==='LEADING');
    const exploration=Math.random()<0.2;
    return exploration||!leading?rows[Math.floor(Math.random()*rows.length)]:leading;
  }
  async runExperimentWorker(tenantId=1){
    if(!this.pool)return {ok:false,reason:'MYSQL_REQUIRED'};
    const [rows]=await this.pool.query("SELECT * FROM sbc_closer_experiment_hooks_v56121 WHERE tenant_id=? AND status IN ('ACTIVE','LEADING')",[tenantId]);
    const groups={};for(const r of rows){groups[r.name]=groups[r.name]||[];groups[r.name].push(r);}
    const winners=[];for(const [name,variants] of Object.entries(groups)){const eligible=variants.filter(v=>Number(v.impressions)>=30);if(!eligible.length)continue;eligible.sort((a,b)=>(Number(b.sales)/Math.max(1,Number(b.impressions)))-(Number(a.sales)/Math.max(1,Number(a.impressions)))||Number(b.revenue)-Number(a.revenue));const w=eligible[0];await this.pool.query("UPDATE sbc_closer_experiment_hooks_v56121 SET status=CASE WHEN variant=? THEN 'LEADING' ELSE 'ACTIVE' END,updated_at=? WHERE tenant_id=? AND name=?",[w.variant,sqlDate(),tenantId,name]);winners.push({name,variant:w.variant,impressions:Number(w.impressions),sales:Number(w.sales),closeRate:Number(w.sales)/Math.max(1,Number(w.impressions))});}
    return {ok:true,experiments:Object.keys(groups).length,winners};
  }
  async addExpense({tenantId=1,date=now(),category,description,amount,submittedBy='owner'}={}){const n=Number(amount);if(!category||!description||!Number.isFinite(n)||n<=0)throw new Error('Valid category, description and positive amount are required.');let prev='';if(this.pool){const [r]=await this.pool.query('SELECT entry_hash FROM sbc_p2p_expense_ledger_v56121 WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1',[tenantId]);prev=r[0]?.entry_hash||'';}const payload={tenantId:Number(tenantId),expenseDate:date,category:clean(category,80),description:clean(description,500),amount:n,submittedBy:clean(submittedBy,120)};const entryHash=hash(prev,payload);const row={id:id('exp'),...payload,prevHash:prev,entryHash,createdAt:now()};if(this.pool)await this.pool.query('INSERT INTO sbc_p2p_expense_ledger_v56121(id,tenant_id,expense_date,category,description,amount,submitted_by,prev_hash,entry_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[row.id,row.tenantId,sqlDate(row.expenseDate),row.category,row.description,row.amount,row.submittedBy,row.prevHash,row.entryHash,sqlDate(row.createdAt)]);return row;}
  async verifyExpenseChain(tenantId=1){if(!this.pool)return {verified:false,reason:'MYSQL_REQUIRED'};const [rows]=await this.pool.query('SELECT * FROM sbc_p2p_expense_ledger_v56121 WHERE tenant_id=? ORDER BY created_at ASC',[tenantId]);let prev='';for(const r of rows){const payload={tenantId:Number(r.tenant_id),expenseDate:sqlDate(r.expense_date),category:r.category,description:r.description,amount:Number(r.amount),submittedBy:r.submitted_by};const expected=hash(prev,payload);if(expected!==r.entry_hash||r.prev_hash!==prev)return {verified:false,brokenId:r.id};prev=r.entry_hash;}return {verified:true,count:rows.length,headHash:prev};}
}
module.exports={VERSION,STATE,DISCOVERY,callWindowGate,isolateObjection,discoveryTree,EliteHardening,bus};
