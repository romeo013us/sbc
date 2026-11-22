'use strict';
/* Public discovery metadata only. No private routes, agent tools or customer data. */
const path=require('node:path');
const PUBLIC_MANIFEST=path.resolve(__dirname,'../public/.well-known/ard.json');
function register(app){
 if(!app||typeof app.get!=='function')throw Error('DISCOVERY_HTTP_APP_REQUIRED');
 app.get('/.well-known/ard.json',(_req,res)=>{
  res.setHeader('Cache-Control','public, max-age=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.type('application/ard+json').sendFile(PUBLIC_MANIFEST);
 });
 return {registered:true,privateApisExposed:false};
}
module.exports={register};
