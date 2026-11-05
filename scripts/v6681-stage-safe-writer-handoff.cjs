'use strict';
/* V66.81: stage ONLY inside the verified CI candidate before identity and
 * inventory are rehashed. Never edit the pinned master server.js in-place.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6681_SAFE_WRITER_HANDOFF';
const leaseBefore="const [rows]=await leaseCandidate.query('SELECT GET_LOCK(?, 0) AS acquired, CONNECTION_ID() AS connectionId',[SBC_RUNTIME_WRITER_LOCK_NAME]);";
const leaseAfter="const rows=await require('./enterprise/v6681-safe-writer-handoff.cjs').waitForWriterLease(leaseCandidate,SBC_RUNTIME_WRITER_LOCK_NAME,{shouldAbort:()=>sbcShutdownStarted,logger:console});";
const readyBefore="  const ready=!fatalRuntimeFault && (mysqlOk || !configured);";
const readyAfter="  // SBC_V6681_SAFE_WRITER_HANDOFF: liveness is NOT database-write readiness.\n  // Preview may read once its own recovery census succeeds; Published must also\n  // prove exclusive lock ownership and completed authoritative recovery.\n  const operational= !configured || (MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && (SBC_RUNTIME_READ_ONLY || sbcWriterLeaseReady));\n  const ready=!fatalRuntimeFault && (mysqlOk || !configured) && operational;";
const healthBefore="app.get('/api/health',(req,res)=>res.json({ok:true,app:'SBC Business Command Center',version:BUILD_VERSION,storage:storageMode,database:storageMode.startsWith('mysql')?'connected':'fallback'}));";
const healthAfter="app.get('/api/health',(req,res)=>res.json({ok:true,app:'SBC Business Command Center',version:BUILD_VERSION,storage:storageMode,database:storageMode.startsWith('mysql')?'connected':'fallback',productionReady:!fatalRuntimeFault&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&(SBC_RUNTIME_READ_ONLY||sbcWriterLeaseReady),writerLeaseReady:!SBC_RUNTIME_READ_ONLY&&sbcWriterLeaseReady,recoveryEvaluated:Boolean(MYSQL_RECOVERY_EVALUATED),recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED)}));";
function replaceExactlyOnce(source,from,to){
 if(source.split(from).length!==2)throw Error('[SBC V66.81] source anchor mismatch: '+from.slice(0,100));
 return source.replace(from,to);
}
function patchSource(src){
 if(src.includes(MARK)){
  if(!src.includes(leaseAfter)||!src.includes("const operational= !configured ||")||!src.includes('writerLeaseReady:!SBC_RUNTIME_READ_ONLY&&sbcWriterLeaseReady'))
    throw Error('[SBC V66.81] partial writer handoff staging forbidden');
  return src;
 }
 let out=replaceExactlyOnce(src,leaseBefore,leaseAfter);
 out=replaceExactlyOnce(out,readyBefore,readyAfter);
 out=replaceExactlyOnce(out,healthBefore,healthAfter);
 if(!out.includes(MARK)||out.includes(leaseBefore))
  throw Error('[SBC V66.81] safe lease patch incomplete');
 return out;
}
function apply(root){
 const file=path.join(root,'server.js'),before=fs.readFileSync(file,'utf8'),after=patchSource(before);
 if(before!==after)fs.writeFileSync(file,after);
 return {mark:MARK,applied:before!==after,bytes:after.length};
}
if(require.main===module){
 if(process.argv[2]!=='--apply')throw Error('Refusing direct mutation: --apply only within isolated release CI.');
 console.log('[SBC V66.81 WRITER HANDOFF] '+JSON.stringify(apply(path.resolve(__dirname,'..'))));
}
module.exports={MARK,patchSource,apply};
