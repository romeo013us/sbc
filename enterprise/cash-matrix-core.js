'use strict';
const crypto=require('crypto');
const fs=require('fs');const path=require('path');
function id(p){return `${p}_${crypto.randomBytes(8).toString('hex')}`}
class CashMatrixCore{
 constructor(config={}){this.config=config;this.confidenceThreshold=Number(config.confidenceThreshold||process.env.SBC_CASH_CONFIDENCE||0.85);this.targetsPath=config.targetsPath||path.join(__dirname,'../config/lead-mesh-targets.json')}
 loadTargets(){try{return JSON.parse(fs.readFileSync(this.targetsPath,'utf8'))}catch{return {highValueSectors:[]}}}
 async extractHighValueTargets(){const out=[];for(const t of this.loadTargets().highValueSectors||[]){for(let i=0;i<Math.min(Number(t.velocityLimit||1),50);i++){const intent=Number((0.7+Math.random()*0.3).toFixed(2));if(intent>=this.confidenceThreshold)out.push({leadId:id('LED'),sector:t.sector,geo:t.geo,valueBracket:t.targetValueBracket,intentScore:intent,source:'CONFIGURED_TARGET_VECTOR',status:'DISCOVERY_CANDIDATE'});}}return out}
 async initiateAutonomousSalesCycle(lead,merchant,context={}){if(!lead?.leadId)throw new Error('LEAD_REQUIRED');return merchant.createCheckoutSession({lead,amount:lead.valueBracket==='enterprise_premium'?149900:49900,context})}
}
module.exports=CashMatrixCore;
