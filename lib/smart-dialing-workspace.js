'use strict';
/**
 * Read-only, compliance-gated adapter for SBC's existing caller workspace.
 * Caller must supply verified consent/DNC eligibility and the prospect's local
 * timezone. No outbound call or database write occurs in this module.
 */
const engine = require('./smart-dialing-engine');
function localCallingWindow(now, timeZone, startMinute = 9*60, endMinute = 20*60) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    const {minute} = engine.minutesOfDay(now,timeZone);
    return minute >= startMinute && minute < endMinute;
  } catch { return false; }
}
function canPresentForDialing(lead, now = new Date()) {
  if (!lead || lead.dncChecked !== true || lead.callingAuthorized !== true ||
      !lead.prospectTimeZone || lead.phoneVerified !== true) return false;
  return engine.eligible(lead,now) &&
    localCallingWindow(now,lead.prospectTimeZone);
}
function buildCallerQueue(leads, now = new Date()) {
  if (!Array.isArray(leads)) return [];
  return leads.filter(lead => canPresentForDialing(lead,now))
    .map((lead,index) => ({lead,index,score:engine.scoreLead(lead,now,lead.prospectTimeZone)}))
    .sort((a,b) => b.score-a.score || a.index-b.index);
}
module.exports = {localCallingWindow,canPresentForDialing,buildCallerQueue};
