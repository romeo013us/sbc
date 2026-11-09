'use strict';

/**
 * SBC Smart Dialing Engine — deterministic, zero-AI-cost scheduling core.
 * This module does not place calls, mutate CRM records, or override consent.
 * Integrate through the existing writer-lease and role-authorized CRM service.
 */
const DEFAULT_WINDOWS = Object.freeze({
  2: [[600, 660], [960, 1020]],
  3: [[600, 660], [960, 1020]],
  4: [[600, 660], [960, 1020]]
});
const DAY_MS = 86400000;
function minutesOfDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  const weekday = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get('weekday')];
  return {weekday, minute: Number(get('hour')) * 60 + Number(get('minute'))};
}
function eligible(lead, now = new Date()) {
  if (!lead || lead.isTest || lead.deleted || lead.doNotCall || lead.optedOut ||
      lead.consentBlocked || lead.legalHold || lead.phoneInvalid ||
      lead.numberStatus === 'invalid' || lead.numberStatus === 'disconnected' ||
      !lead.phone || lead.status === 'won' || lead.status === 'closed') return false;
  if (lead.nextCallAt) {
    const next = new Date(lead.nextCallAt).getTime();
    if (!Number.isFinite(next) || next > now.getTime()) return false;
  }
  return true;
}
function windowScore(now = new Date(), timeZone = 'America/New_York') {
  const {weekday, minute} = minutesOfDay(now, timeZone);
  return (DEFAULT_WINDOWS[weekday] || []).some(([start,end]) => minute >= start && minute < end) ? 20 : 0;
}
function scoreLead(lead, now = new Date(), timeZone = 'America/New_York') {
  if (!eligible(lead, now)) return null;
  const rawQuality = Number(lead.qualityScore);
  const quality = Number.isFinite(rawQuality) ? Math.max(0, Math.min(100, rawQuality)) : 0;
  const answered = Math.max(0, Number(lead.successfulContacts) || 0);
  const unanswered = Math.max(0, Number(lead.unansweredAttempts) || 0);
  return quality + windowScore(now, timeZone) + Math.min(15, answered * 5) - Math.min(30, unanswered * 10);
}
function rankQueue(leads, now = new Date(), timeZone = 'America/New_York') {
  return leads.map((lead, index) => ({lead, index, score:scoreLead(lead, now, timeZone)}))
    .filter(item => item.score !== null)
    .sort((a,b) => b.score - a.score || a.index - b.index);
}
function outcomePolicy(outcome, attemptCount = 1, now = new Date()) {
  const attempts = Math.max(1, Number(attemptCount) || 1);
  const normalized = String(outcome || '').toLowerCase();
  if (['opt_out','do_not_call'].includes(normalized)) return {action:'suppress', nextCallAt:null, research:false};
  if (['invalid','disconnected','wrong_number'].includes(normalized))
    return {action:'quarantine_number', nextCallAt:null, research:false};
  if (['no_answer','busy','voicemail'].includes(normalized)) {
    if (attempts >= 4) return {action:'cooldown', nextCallAt:new Date(now.getTime()+15*DAY_MS).toISOString(), research:false};
    const days = [1,2,4][Math.min(attempts-1,2)];
    return {action:'retry_later', nextCallAt:new Date(now.getTime()+days*DAY_MS).toISOString(), research:false};
  }
  if (normalized === 'callback_requested') return {action:'schedule_requested_callback', nextCallAt:null, research:false};
  if (normalized === 'connected') return {action:'record_contact', nextCallAt:null, research:false};
  return {action:'manual_review', nextCallAt:null, research:false};
}
module.exports = {eligible, minutesOfDay, windowScore, scoreLead, rankQueue, outcomePolicy};
