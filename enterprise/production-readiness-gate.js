'use strict';
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [/^sk_live_/i, /^rk_live_/i, /^whsec_/i, /password|secret|token|api[_-]?key/i];
const REQUIRED = [
  'NODE_ENV','SBC_PUBLIC_URL','SBC_SESSION_SECRET','SBC_WEBHOOK_SECRET',
  'DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'
];

function present(name){ return Boolean(String(process.env[name] || '').trim()); }
function placeholder(value){
  const s=String(value||'').trim().toLowerCase();
  return !s || ['replace','replace_me','replace_with_long_random_secret','your_actual','your-actual','example','changeme'].some(x=>s.includes(x));
}
function check(name){
  const value=process.env[name];
  if(!present(name)) return {name,status:'BLOCKED',detail:'Missing'};
  if(placeholder(value)) return {name,status:'BLOCKED',detail:'Placeholder value'};
  return {name,status:'PASS'};
}
function scanRepoForPrivateEnv(){
  const envPath=path.join(process.cwd(),'.env');
  if(!fs.existsSync(envPath)) return {present:false,status:'PASS',detail:'No local .env file found; server environment may be used.'};
  const stat=fs.statSync(envPath);
  if(process.platform!=='win32' && (stat.mode & 0o077)!==0) return {present:true,status:'BLOCKED',detail:'Private .env permissions are broader than 0600.'};
  return {present:true,status:'PASS',detail:'Private .env exists with restrictive permissions.'};
}
function providerStatus(){
  const stripe = present('STRIPE_SECRET_KEY') && !placeholder(process.env.STRIPE_SECRET_KEY);
  const stripeWebhook = present('STRIPE_WEBHOOK_SECRET') && !placeholder(process.env.STRIPE_WEBHOOK_SECRET);
  const square = present('SQUARE_ACCESS_TOKEN') && present('SQUARE_LOCATION_ID');
  const office = present('SBC_OFFICE_BOX_URL') && present('SBC_WEBHOOK_SECRET');
  const wp = present('WORDPRESS_PROVISIONER_URL') && present('WORDPRESS_PROVISIONER_SECRET');
  const ai = present('OPENAI_API_KEY') && !placeholder(process.env.OPENAI_API_KEY);
  return {stripe,square,officeBox:office,wordpressProvisioner:wp,openai:ai,stripeWebhook};
}
function run(){
  const checks=REQUIRED.map(check);
  const providers=providerStatus();
  const envFile=scanRepoForPrivateEnv();
  const paymentReady=(providers.stripe&&providers.stripeWebhook)||providers.square;
  const critical=[...checks, {name:'payment rail',status:paymentReady?'PASS':'BLOCKED',detail:paymentReady?'A production payment rail and webhook configuration are present.':'Configure Stripe + webhook secret or Square production credentials.'}, {name:'office box',status:providers.officeBox?'PASS':'BLOCKED',detail:providers.officeBox?'Execution bridge configured.':'Office Box URL/shared webhook secret missing.'}];
  const blockers=critical.filter(x=>x.status==='BLOCKED');
  return {ok:blockers.length===0,generatedAt:new Date().toISOString(),environment:process.env.NODE_ENV||'unset',checks:critical,providers,envFile,blockers};
}

if(require.main===module){
  const out=run();
  console.log(JSON.stringify({...out, note:'No secret values are printed.'},null,2));
  process.exit(out.ok?0:1);
}
module.exports={run};
