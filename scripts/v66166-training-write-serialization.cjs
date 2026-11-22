'use strict';
const MARK='SBC_V66166_TRAINING_SERIALIZATION';
function patchServer(raw){
 let s=String(raw||'');if(s.includes('// '+MARK))return s;
 const anchor="app.get('/api/training',auth,async(req,res)=>{";
 if(s.split(anchor).length!==2)throw Error('ACADEMY_TRAINING_SERIALIZATION_ANCHOR_DRIFT');
 const helpers=[
  '// '+MARK+' · Legacy and Academy training operations share one state lock.',
  "app.use('/api/training',(req,res,next)=>{",
  ' TRAINING_SYSTEM.withWriteLock(db,()=>new Promise((resolve,reject)=>{',
  '  if(res.destroyed||res.writableEnded)return resolve();',
  "  const done=()=>{res.removeListener('finish',done);res.removeListener('close',done);resolve()};",
  "  res.once('finish',done);res.once('close',done);",
  "  try{next()}catch(e){res.removeListener('finish',done);res.removeListener('close',done);reject(e)}",
  " })).catch(e=>{if(!res.headersSent)res.status(e.status||500).json({ok:false,error:'TRAINING_WRITE_NOT_CONFIRMED'})});",
  '});',
  ''
 ].join('\n');
 s=s.replace(anchor,helpers+anchor);
 return s;
}
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../server.js'),before=fs.readFileSync(file,'utf8'),after=patchServer(before);if(process.argv.includes('--apply')){if(process.env.SBC_V66166_ISOLATED_STAGE!=='YES')throw Error('ACADEMY_V2_DISPOSABLE_STAGE_ONLY');fs.writeFileSync(file,after);}if(process.argv.includes('--verify-staged')&&after!==before)throw Error('ACADEMY_TRAINING_SERIALIZATION_NOT_STAGED');console.log('SBC Academy training serialization '+(before===after?'VERIFIED':'READY'));}
module.exports={MARK,patchServer};
