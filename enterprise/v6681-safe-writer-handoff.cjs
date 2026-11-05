'use strict';
/**
 * V66.81: safe rolling-deploy writer handoff.
 * Repeatedly tries to acquire the EXISTING named MySQL writer lease, on the
 * SAME candidate connection. Does not release foreign locks, mutate records,
 * bypass recovery, or start workers. The caller still performs every existing
 * writer-lease, MySQL census, and recovery gate before proceeding.
 *
 * A GoDaddy rolling deploy may run the replacement before the previous writer
 * has exited. The old one-shot GET_LOCK(?,0) converted temporary overlap into
 * an indefinite, unhealthy, non-writing process; this waits for a lawful handoff.
 */
const SQL='SELECT GET_LOCK(?, 0) AS acquired, CONNECTION_ID() AS connectionId';

async function waitForWriterLease(connection, lockName, options={}){
  if(!connection||typeof connection.query!=='function')
    throw Object.assign(new Error('SBC_WRITER_HANDOFF_CONNECTION_REQUIRED'),{code:'SBC_WRITER_HANDOFF_CONNECTION_REQUIRED'});
  if(typeof lockName!=='string'||!lockName.startsWith('sbc:runtime:writer:'))
    throw Object.assign(new Error('SBC_WRITER_HANDOFF_LOCK_NAME_INVALID'),{code:'SBC_WRITER_HANDOFF_LOCK_NAME_INVALID'});
  const sleep=options.sleep||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
  const time=options.now||Date.now;
  const shouldAbort=options.shouldAbort||(()=>false);
  const logger=options.logger||console;
  const delay=Math.max(250,Math.min(30000,Number(options.delayMs)||5000));
  const logEvery=Math.max(1000,Math.min(300000,Number(options.logEveryMs)||60000));
  const started=time();
  let attempts=0,nextLog=started;
  while(true){
    if(shouldAbort())throw Object.assign(new Error('SBC_WRITER_HANDOFF_CANCELLED'),{code:'SBC_WRITER_HANDOFF_CANCELLED'});
    // This call is read-only except for the MySQL advisory lock itself.
    // It can acquire only when no existing session owns the named lock.
    const [rows]=await connection.query(SQL,[lockName]);
    const status=Number(rows?.[0]?.acquired);
    if(status===1){
      const connectionId=Number(rows?.[0]?.connectionId);
      if(!Number.isSafeInteger(connectionId)||connectionId<=0)
        throw Object.assign(new Error('SBC_WRITER_HANDOFF_SESSION_UNVERIFIED'),{code:'SBC_WRITER_HANDOFF_SESSION_UNVERIFIED'});
      if(attempts>0)logger.warn?.('[SBC V66.81 WRITER HANDOFF] lease acquired after previous owner released it; attempts='+attempts+' waitedMs='+Math.max(0,time()-started)+'; authoritative MySQL recovery is still required.');
      return rows;
    }
    if(status!==0)
      throw Object.assign(new Error('SBC_WRITER_HANDOFF_LOCK_RESULT_UNKNOWN'),{code:'SBC_WRITER_HANDOFF_LOCK_RESULT_UNKNOWN'});
    attempts++;
    if(time()>=nextLog){
      logger.warn?.('[SBC V66.81 WRITER HANDOFF] existing process still owns MySQL writer lease; this process remains non-writing; attempts='+attempts+'; waiting for lawful release.');
      nextLog=time()+logEvery;
    }
    await sleep(delay);
  }
}
module.exports={waitForWriterLease,SQL};
