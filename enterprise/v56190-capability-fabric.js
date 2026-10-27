'use strict';
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const crypto=require('crypto');
const FACADE=require('./facade');
const ENT=require('./v56180-god-tier-scale');
const AUTO=require('./v56150-revenue-autopilot');
const VERSION='56.19.0';
const DROPZONE_ROOT=path.resolve(process.env.SBC_DROPZONE_ROOT||path.join(__dirname,'..','data','dropzone'));
const WATCH_INTERVAL_MS=Math.max(1000,Math.min(300000,Number(process.env.SBC_SFTP_WATCH_INTERVAL_MS||15000)));
const MAX_FILES=Math.max(1,Math.min(50,Number(process.env.SBC_SFTP_WATCH_BATCH||10)));
let ctx=null,timer=null,running=false,lastScanAt=null,lastResult=null;
function clean(v,n=240){return String(v??'').trim().slice(0,n);}
function sha(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function ensureDirs(){return Promise.all([fsp.mkdir(DROPZONE_ROOT,{recursive:true}),fsp.mkdir(path.join(DROPZONE_ROOT,'processed'),{recursive:true}),fsp.mkdir(path.join(DROPZONE_ROOT,'failed'),{recursive:true})]);}
function status(){return {version:VERSION,watchMode:'mounted-sftp-directory',dropzoneRoot:DROPZONE_ROOT,watcher:Boolean(timer),running,lastScanAt,lastResult,intervalMs:WATCH_INTERVAL_MS,maxFiles:MAX_FILES,capabilities:FACADE.list(),featureBits:FACADE.FEATURE_BITS};}
async function scan(){if(running)return {ok:true,skipped:true,reason:'scan_in_progress'};running=true;try{await ensureDirs();const out=await AUTO.scanDropzone();lastScanAt=new Date().toISOString();lastResult=out;return {ok:true,watcher:'sftp-mounted-dropzone',...out};}finally{running=false;}}
function start(){if(timer)return status();ensureDirs().catch(()=>{});scan().catch(()=>{});timer=setInterval(()=>scan().catch(()=>{}),WATCH_INTERVAL_MS);timer.unref?.();return status();}
function stop(){if(timer)clearInterval(timer);timer=null;return status();}
function configure(input={}){ctx=input;return status();}
function resolveCapability(name,tenant={}){const plan=tenant.plan||ctx?.db?.settings?.subscriptionPlan||'starter';return FACADE.resolve(name,{featureEngine:ENT,plan,overrides:tenant.overrides||{}});}
async function dispatchCapability(name,payload,tenant={}){const plan=tenant.plan||ctx?.db?.settings?.subscriptionPlan||'starter';return FACADE.dispatch(name,payload,{featureEngine:ENT,plan,overrides:tenant.overrides||{},requestId:payload?.requestId});}
module.exports={VERSION,DROPZONE_ROOT,configure,start,stop,status,scan,resolveCapability,dispatchCapability,facade:FACADE};
