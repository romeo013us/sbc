'use strict';
/**
 * Pure disposition transition. The existing authorized CRM writer must commit
 * the returned patch + audit event atomically, then refresh the caller queue.
 * This module never calls Twilio, writes SQL, or changes production records.
 */
const {outcomePolicy} = require('./smart-dialing-engine');
const ALLOWED = new Set(['no_answer','busy','voicemail','invalid','disconnected','wrong_number','opt_out','do_not_call','callback_requested','connected']);
function dispositionTransition(lead, input, now = new Date()) {
  if (!lead || !lead.id || !input || !ALLOWED.has(input.outcome))
    throw new Error('Invalid lead or disposition');
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid event timestamp');
  const attemptCount = (Number.isSafeInteger(lead.callAttempts) && lead.callAttempts >= 0 ? lead.callAttempts : 0) + 1;
  const policy = outcomePolicy(input.outcome, attemptCount, now);
  if (policy.action === 'schedule_requested_callback') {
    const date = new Date(input.callbackAt);
    if (!input.callbackAt || !Number.isFinite(date.getTime()) || date.getTime() <= now.getTime())
      throw new Error('Future callback time required');
  }
  const callbackAt = policy.action === 'schedule_requested_callback' ? new Date(input.callbackAt).toISOString() : null;
  const patch = {
    callAttempts:attemptCount,
    lastCallOutcome:input.outcome,
    lastCalledAt:now.toISOString(),
    nextCallAt:callbackAt || policy.nextCallAt,
    ...(policy.action === 'quarantine_number' ? {numberStatus:'invalid',phoneInvalid:true} : {}),
    ...(policy.action === 'suppress' ? {doNotCall:true} : {})
  };
  const event = {
    type:'lead.call_disposition',
    leadId:String(lead.id),
    outcome:input.outcome,
    action:policy.action,
    occurredAt:now.toISOString(),
    actorId:input.actorId ? String(input.actorId) : null,
    previousAttemptCount:attemptCount - 1,
    nextCallAt:patch.nextCallAt
  };
  return {patch,event,queueAction:'remove_current',requiresAuthorizedWriter:true};
}
module.exports = {dispositionTransition};
