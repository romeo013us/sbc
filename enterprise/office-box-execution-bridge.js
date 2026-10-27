'use strict';
const crypto=require('crypto');
class OfficeBoxExecutionBridge{
 constructor(){this.url=String(process.env.SBC_OFFICE_BOX_URL||process.env.SBC_OFFICE_BOX_PUBLIC_URL||'').replace(/\/$/,'');this.secret=process.env.SBC_WEBHOOK_SECRET||process.env.OFFICE_BOX_WEBHOOK_SECRET||''}
 configured(){return Boolean(this.url&&this.secret)}
 async dispatch(event){if(!this.configured())return {sent:false,status:'NOT_CONFIGURED'};const raw=JSON.stringify(event);const sig=crypto.createHmac('sha256',this.secret).update(raw).digest('hex');const r=await fetch(`${this.url}/api/integrations/sbc/autonomous-event`,{method:'POST',headers:{'content-type':'application/json','x-sbc-autonomy-signature':sig},body:raw,signal:AbortSignal.timeout(10000)});const body=await r.json().catch(()=>({}));return {sent:r.ok,status:r.status,response:body}}
}
module.exports=OfficeBoxExecutionBridge;
