'use strict';
/**
 * Transactional integration boundary for the existing SBC CRM writer.
 * Supply an authenticated/authorized writer adapter. Do not call directly
 * from an untrusted browser or from a read-only preview process.
 */
const {dispositionTransition} = require('./smart-dialing-disposition');
function assertWriter(writer) {
  for (const method of ['transaction'])
    if (typeof writer?.[method] !== 'function') throw new Error('CRM writer adapter missing '+method);
}
async function recordCallDisposition({writer,leadId,input,now=new Date(),authorize}) {
  assertWriter(writer);
  if (!input || typeof input.eventId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(input.eventId))
    throw new Error('Stable eventId required for idempotency');
  if (typeof authorize !== 'function') throw new Error('Authorization callback required');
  if (!input.actorId) throw new Error('Authenticated actor required');
  const permitted = await authorize({actorId:input.actorId,leadId,action:'record_call_disposition'});
  if (permitted !== true) throw new Error('Not authorized');
  return writer.transaction(async tx => {
    for (const method of ['findCallEvent','getLeadForUpdate','applyLeadPatch','appendCallEvent']) {
      if (typeof tx?.[method] !== 'function') throw new Error('CRM transaction missing ' + method);
    }
    const prior = await tx.findCallEvent(input.eventId);
    if (prior) {
      if (String(prior.leadId)!==String(leadId)) throw new Error('Event ID conflict');
      return {duplicate:true,queueAction:'remove_current',event:prior};
    }
    const lead = await tx.getLeadForUpdate(leadId);
    if (!lead) throw new Error('Lead not found');
    const result = dispositionTransition(lead,input,now);
    result.event.eventId = input.eventId;
    await tx.applyLeadPatch(leadId,result.patch);
    await tx.appendCallEvent(result.event);
    return {...result,duplicate:false};
  });
}
module.exports={recordCallDisposition};
