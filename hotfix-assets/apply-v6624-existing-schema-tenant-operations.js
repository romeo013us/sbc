'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6624_EXISTING_SCHEMA_TENANT_AUTONOMY';
function once(s,needle,replacement,label){const n=s.split(needle).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(needle,replacement)}
function apply(root){
 const serverFile=path.join(root,'server.js');
 const brainFile=path.join(root,'enterprise/v56134-ten-brain.js');
 const kimFile=path.join(root,'enterprise/v56135-kim-mission-controller.js');
 let server=fs.readFileSync(serverFile,'utf8'),brain=fs.readFileSync(brainFile,'utf8'),kim=fs.readFileSync(kimFile,'utf8');
 if(server.includes(MARKER)||brain.includes(MARKER)||kim.includes(MARKER))throw Error(MARKER+': duplicate patch');
 // An intelligence evaluation never makes an order or Square checkout. Only an expressly dispatched,
 // consented purchase can reach the existing checkout pathway.
 brain=once(brain,
  "  if(action==='CREATE_CHECKOUT'){\n    try{",
  "  if(action==='CREATE_CHECKOUT' && mode!=='dispatch'){action='CHECKOUT_REVIEW_REQUIRED';nodes.push({brain:'CONTROLLER_BRAIN',state:'HUMAN_PURCHASE_CONFIRMATION_REQUIRED'});}\n  if(action==='CREATE_CHECKOUT'){\n    try{",
  'brain checkout intent versus dispatch');
 // Tenant scope is explicit for scheduled missions. Manual owner actions remain separately authenticated.
 kim=once(kim,
  "  async function cycle({limit=MAX_BATCH,reason='scheduled'}={}){",
  "  async function cycle({limit=MAX_BATCH,reason='scheduled',tenantId=null}={}){",
  'Kim mission tenant argument');
 kim=once(kim,
  "      const candidates=(db?.customers||[]).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);",
  "      const selectedTenant=Number(tenantId);if(!Number.isSafeInteger(selectedTenant)||selectedTenant<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});\n      const candidates=(db?.customers||[]).filter(c=>Number(c?.tenantId)===selectedTenant).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);",
  'Kim mission candidate scope');
 kim=once(kim,
  "      const fulfillment=await reconcilePaidOrders(cap);",
  "      const fulfillment=await reconcilePaidOrders(cap,selectedTenant);",
  'Kim paid-order scope');
 kim=once(kim,
  "  async function reconcilePaidOrders(limit=MAX_BATCH){",
  "  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){",
  'Kim reconcile argument');
 kim=once(kim,
  "    const paid=(db?.orders||[]).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||''))",
  "    const paid=(db?.orders||[]).filter(o=>tenantId===null||Number(o?.tenantId)===Number(tenantId)).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||''))",
  'Kim paid order tenant filter');
 // Safe single-tenant advisory startup uses only existing tables and runtime state. It never
 // runs migrations, enables DDL, sends outreach, or creates a checkout.
 const anchor="initMysql().then(async()=>{";
 const functionSource=String.raw