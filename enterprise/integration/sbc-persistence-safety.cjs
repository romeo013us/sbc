'use strict';

const PERSISTENCE_EPOCH_KEY='__sbc_persistence_epoch';

function assessPersistenceSafety(authoritativeCore, sourceCore, shrinkThreshold=0.90){
  const tables=['customers','quotes','orders','renewals'];
  const shrink=[];
  const empty=[];
  for(const table of tables){
    const dbCount=Math.max(0,Number(authoritativeCore?.[table]||0));
    const memoryCount=Math.max(0,Number(sourceCore?.[table]||0));
    if(dbCount>0 && memoryCount===0) empty.push(table);
    if(dbCount>=10 && memoryCount < dbCount*shrinkThreshold){
      shrink.push({table,authoritative:dbCount,source:memoryCount,ratio:dbCount?memoryCount/dbCount:0});
    }
  }
  if(empty.length) return {
    ok:false,
    error:'CRM_BULK_REWRITE_BLOCKED_SOURCE_EMPTY',
    reason:'AUTHORITATIVE_CORE_NONEMPTY_SOURCE_EMPTY',
    empty
  };
  if(shrink.length) return {
    ok:false,
    error:'CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE',
    reason:'AUTHORITATIVE_CORE_PARTIAL_SHRINK',
    shrink,
    threshold:shrinkThreshold
  };
  return {ok:true,shrinkThreshold};
}

module.exports={PERSISTENCE_EPOCH_KEY,assessPersistenceSafety};
