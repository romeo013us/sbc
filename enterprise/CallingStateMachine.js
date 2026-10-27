'use strict';

/** SBC Money Machine 2.0 — deterministic outbound state machine.
 * AI may recommend transitions; only this module commits valid transitions.
 */
const STATES = Object.freeze({
  READY:['CALLING','FROZEN'],
  CALLING:['CONVERSATION','NO_ANSWER','BUSY','FAILED'],
  CONVERSATION:['QUALIFIED','LOST','CALLBACK_QUEUED'],
  NO_ANSWER:['FOLLOW_UP_QUEUED','LOST'],
  BUSY:['FOLLOW_UP_QUEUED','LOST'],
  FAILED:['FOLLOW_UP_QUEUED','LOST'],
  CALLBACK_QUEUED:['CALLING','FROZEN'],
  FOLLOW_UP_QUEUED:['CALLING','FROZEN'],
  QUALIFIED:['CALLBACK_QUEUED','FROZEN'],
  LOST:['READY'],
  FROZEN:[]
});
function assertTransition(from,to){
  const f=String(from||'').toUpperCase(), t=String(to||'').toUpperCase();
  if(!STATES[f]) throw new Error(`UNKNOWN_CALL_STATE:${f}`);
  if(!STATES[f].includes(t)) throw new Error(`INVALID_CALL_TRANSITION:${f}->${t}`);
  return true;
}
class CallingStateMachine{
  constructor(poolProvider){this.poolProvider=poolProvider;this.validTransitions=STATES;}
  async transition({eventId,currentState,nextState,context={}}={}){
    assertTransition(currentState,nextState);
    const pool=this.poolProvider?.();
    if(!pool) return {ok:true,persisted:false,eventId,nextState:String(nextState).toUpperCase()};
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [rows]=await conn.execute('SELECT status FROM sbc_agent_event_bus WHERE id = ? FOR UPDATE',[eventId]);
      if(!rows.length) throw new Error('TARGET_EVENT_RECORD_NOT_FOUND');
      await conn.execute('UPDATE sbc_agent_event_bus SET status=?, payload=JSON_MERGE_PATCH(COALESCE(payload, JSON_OBJECT()), ?), processed_at=UTC_TIMESTAMP() WHERE id=?',[String(nextState).toLowerCase(),JSON.stringify({call_telemetry:context}),eventId]);
      await conn.commit();
      return {ok:true,persisted:true,eventId,nextState:String(nextState).toUpperCase()};
    }catch(e){await conn.rollback();throw e;}finally{conn.release();}
  }
}
module.exports={CallingStateMachine,STATES,assertTransition};
