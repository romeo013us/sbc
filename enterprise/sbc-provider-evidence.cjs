'use strict';

const GATEWAY_DEFINITIONS = [
  {id:'square',name:'Square Payments',category:'Payments',env:['SQUARE_ACCESS_TOKEN','SQUARE_LOCATION_ID'],url:'https://developer.squareup.com/',critical:true},
  {id:'twilio',name:'Twilio Voice & SMS',category:'Communications',env:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE_NUMBER'],url:'https://www.twilio.com/docs',critical:true},
  {id:'godaddy',name:'GoDaddy Domains & Hosting',category:'Domains / Hosting',env:['GODADDY_PAT'],url:'https://developer.godaddy.com/',critical:true},
  {id:'four_over_four',name:'4OVER4 Print',category:'Fulfillment',env:['FOUROVER4_API_URL','FOUROVER4_API_KEY'],url:'https://www.4over4.com/',critical:false},
  {id:'vistaprint',name:'VistaPrint Print',category:'Fulfillment',env:['VISTAPRINT_API_URL','VISTAPRINT_API_KEY'],url:'https://www.vistaprint.com/',critical:false},
  {id:'openai',name:'OpenAI AI',category:'AI / Kim',env:['OPENAI_API_KEY'],url:'https://platform.openai.com/',critical:true},
  {id:'stripe',name:'Stripe Subscriptions',category:'Payments',env:['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'],url:'https://docs.stripe.com/billing',critical:false},
  {id:'google',name:'Google Business Profile',category:'Marketing',env:['GOOGLE_BUSINESS_PROFILE_CLIENT_ID','GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET','GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN','GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID','GOOGLE_BUSINESS_PROFILE_LOCATION_ID'],url:'https://developers.google.com/my-business',critical:false},
  {id:'windsor',name:'Windsor.ai',category:'Marketing',env:['SBC_WINDSOR_API_KEY'],url:'https://windsor.ai/api-documentation/',critical:false},
  {id:'email',name:'Email',category:'Communications',env:['SBC_SMTP_HOST','SBC_SMTP_USER','SBC_SMTP_PASS'],url:'',critical:true},
  {id:'github',name:'GitHub Actions',category:'Releases',env:[],external:true,url:'https://github.com/romeo013us/sbc/actions',critical:true},
  {id:'microsoft365',name:'Microsoft 365',category:'Email / Productivity',env:['MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_TENANT_ID'],url:'https://learn.microsoft.com/graph/',critical:false},
  {id:'redis',name:'Redis',category:'Sessions / Cache',env:['REDIS_URL'],url:'https://redis.io/',critical:false},
  {id:'auth0',name:'Auth0 / OIDC',category:'Identity',env:['SBC_OIDC_ISSUER','SBC_OIDC_CLIENT_ID'],url:'https://auth0.com/',critical:false},
  {id:'temporal',name:'Temporal',category:'Durable Workflows',env:['TEMPORAL_ADDRESS','TEMPORAL_NAMESPACE'],url:'https://temporal.io/',critical:false},
  {id:'amqp',name:'RabbitMQ / AMQP',category:'Event Bus',env:['AMQP_URL'],url:'https://www.rabbitmq.com/',critical:false},
  {id:'otel',name:'OpenTelemetry',category:'Observability',env:['OTEL_EXPORTER_OTLP_ENDPOINT'],url:'https://opentelemetry.io/',critical:false}
];

const ALIASES = {
  FOUROVER4_API_KEY: ['FOUR_OVER_FOUR_API_KEY'], FOUROVER4_API_URL: ['FOUR_OVER_FOUR_API_URL'],
  VISTAPRINT_API_KEY: ['VISTAPRINT_PROSHOP_API_KEY'], TWILIO_ACCOUNT_SID: ['SBC_TWILIO_ACCOUNT_SID'],
  TWILIO_AUTH_TOKEN: ['SBC_TWILIO_AUTH_TOKEN'], TWILIO_PHONE_NUMBER: ['SBC_TWILIO_FROM'],
  REDIS_URL: ['SBC_REDIS_URL'], SBC_SMTP_HOST: ['SMTP_HOST'], SBC_SMTP_USER: ['SMTP_USER'],
  SBC_SMTP_PASS: ['SMTP_PASS']
};

function configuration(gateway, present) {
  const has = key => [key, ...(ALIASES[key] || [])].some(present);
  let requirements = gateway.env;
  if (gateway.id === 'godaddy' && !has('GODADDY_PAT') && (has('GODADDY_API_KEY') || has('GODADDY_API_SECRET'))) {
    requirements = ['GODADDY_API_KEY', 'GODADDY_API_SECRET'];
  }
  const missing = requirements.filter(key => !has(key));
  const complete = requirements.length > 0 && missing.length === 0;
  const configured = requirements.length > missing.length;
  const status = gateway.external ? 'EXTERNAL' : complete ? 'CONFIGURED' : configured ? 'PARTIAL' : 'STANDBY';
  const details = {
    CONFIGURED: 'Settings are present. Account access and completed transactions require separate evidence.',
    PARTIAL: 'Some required settings are missing.',
    STANDBY: 'Required settings have not been found in this runtime.',
    EXTERNAL: 'GitHub Actions records release evidence in its workflow runs.'
  };
  const {id, name, category, critical, url} = gateway;
  return {id, name, category, critical, url, configured, complete, status, missing, verified:false, detail:details[status]};
}

function summarizeGateways(gateways) {
  const count = status => gateways.filter(row => row.status === status).length;
  return { ready:gateways.filter(row => row.verified).length, configured:count('CONFIGURED'),
    partial:count('PARTIAL'), standby:count('STANDBY'), external:count('EXTERNAL') };
}

async function readTwilioAccount(sid, token, request = fetch) {
  const response = await request('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '.json', {
    method:'GET', redirect:'error', signal:AbortSignal.timeout(5000),
    headers:{ Authorization:'Basic ' + Buffer.from(sid + ':' + token).toString('base64') }
  });
  if (!response.ok) throw Error('TWILIO_ACCOUNT_READ_FAILED');
  return response.json();
}

async function checkRevenueAccounts({locationId, squareRead, squareEnvironment, sid, twilioRead}) {
  async function check(provider, scope, configured, read, matches, environment) {
    const evidence = {provider, scope, environment, status:'UNCONFIGURED'};
    if (!configured) return evidence;
    try {
      const response = await read();
      evidence.status = matches(response) ? 'VERIFIED' : 'UNVERIFIED';
    } catch {
      evidence.status = 'UNAVAILABLE';
    }
    return evidence;
  }
  return Promise.all([
    check('Square', 'Active merchant location', locationId && squareRead,
      () => squareRead('/v2/locations/' + encodeURIComponent(locationId)),
      result => result?.location?.id === locationId && result.location.status === 'ACTIVE', squareEnvironment),
    check('Twilio', 'Active account', sid && twilioRead, twilioRead,
      result => result?.sid === sid && result.status === 'active', 'account')
  ]);
}
module.exports = {GATEWAY_DEFINITIONS, configuration, summarizeGateways, readTwilioAccount, checkRevenueAccounts};
