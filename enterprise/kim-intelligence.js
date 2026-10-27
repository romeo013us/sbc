const crypto=require('crypto');
const CAPABILITIES={
 autonomousRuntime:'autonomous-agentic-runtime',
 trustLayer:'localized-context-trust-layer',
 predictiveScoring:'predictive-conversion-churn-scoring',
 conversationRevenue:'conversation-revenue-intelligence',
 brandAssets:'autonomous-brand-identity-assets',
 forecasting:'data-driven-forecasting',
 semanticQueries:'semantic-natural-language-querying',
 contextualOutreach:'contextual-generative-outreach',
 noCodeAgents:'no-code-agent-workflow-builder',
 enrichment:'automated-data-enrichment',
 anomalyDetection:'realtime-telemetry-anomaly-detection',
 dedupe:'automated-database-sanitization',
 intentRouting:'omnichannel-intent-routing',
 knowledgeDrafting:'proactive-knowledge-drafting',
 humanHandoff:'ai-to-human-operational-handoff',
 serverDrivenUI:'server-driven-ai-interface',
 intentAnticipation:'intent-anticipation',
 scheduling:'smart-scheduling-optimization',
 semanticGraph:'semantic-data-graph-linking',
 selfCorrectingWorkflows:'self-correcting-long-running-workflows'
};
const EXTERNAL={
 autonomousRuntime:()=>Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY),
 predictiveScoring:()=>Boolean(process.env.SBC_ML_PROVIDER_URL),
 conversationRevenue:()=>Boolean(process.env.SBC_TRANSCRIPT_PROVIDER_URL||process.env.TWILIO_ACCOUNT_SID),
 brandAssets:()=>Boolean(process.env.SBC_BRAND_PROVIDER_URL),
 forecasting:()=>Boolean(process.env.SBC_FORECAST_PROVIDER_URL),
 semanticQueries:()=>Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY),
 contextualOutreach:()=>Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY),
 noCodeAgents:()=>true,
 enrichment:()=>Boolean(process.env.SBC_ENRICHMENT_PROVIDER_URL),
 anomalyDetection:()=>true,
 dedupe:()=>true,
 intentRouting:()=>Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY),
 knowledgeDrafting:()=>Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY),
 humanHandoff:()=>true,
 serverDrivenUI:()=>true,
 intentAnticipation:()=>Boolean(process.env.SBC_ML_PROVIDER_URL),
 scheduling:()=>Boolean(process.env.SBC_CALENDAR_PROVIDER_URL),
 semanticGraph:()=>true,
 selfCorrectingWorkflows:()=>true
};
function readiness(){
 const status={};
 for(const key of Object.keys(CAPABILITIES)) status[key]=Boolean(EXTERNAL[key]?.() ?? true);
 return {featureCount:Object.keys(CAPABILITIES).length,capabilities:CAPABILITIES,status,trustLayer:true,ownerBoundary:true,providerConfigured:Boolean(process.env.SBC_AI_PROVIDER_KEY||process.env.OPENAI_API_KEY)};
}
function maskPII(text=''){
 let s=String(text);
 s=s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]');
 s=s.replace(/\+?\d[\d\s().-]{7,}\d/g,'[PHONE]');
 s=s.replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[SSN]');
 return s;
}
function safeAgentPlan(request='',ctx={}){
 const q=String(request||'').trim();
 const lower=q.toLowerCase();
 const actions=[];
 if(/login|auth|request failed|error|health|broken|crash/.test(lower))actions.push({action:'diagnose_system_health',risk:'low'});
 if(/lead|sales|call|prospect/.test(lower))actions.push({action:'inspect_sales_queue_and_prepare_next_action',risk:'low'});
 if(/customer|account|portal/.test(lower))actions.push({action:'inspect_customer_context_without_exposing_pii',risk:'low'});
 if(/fulfillment|print|tracking|order/.test(lower))actions.push({action:'inspect_fulfillment_state_and_reconcile_provider_status',risk:'low'});
 if(!actions.length)actions.push({action:'inspect_relevant_command_center_context',risk:'low'});
 const protectedIntent=/refund|delete|credential|password|secret|owner|charge|payment status|irreversible/i.test(q);
 return {intent:q?maskPII(q):'general_operations',proposedActions:actions,requiresHuman:protectedIntent,protectedReason:protectedIntent?'Owner-controlled or irreversible action detected.':'No protected action proposed.',tenantId:String(ctx.tenantId||'sbc-default'),createdAt:new Date().toISOString(),planId:crypto.createHash('sha256').update(JSON.stringify({q,ctx})).digest('hex').slice(0,32)};
}
module.exports={CAPABILITIES,readiness,maskPII,safeAgentPlan};
