'use strict';
const crypto = require('node:crypto');
// This is an optimistic-concurrency fingerprint, NOT an authentication token.
// Normalise MySQL DATETIME driver output identically on GET and SELECT FOR UPDATE.
function normaliseDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  return String(value ?? '');
}
function revisionOfLead(row) {
  if (!row || row.id == null) throw new TypeError('Lead revision needs an id');
  const data = [
    String(row.id),
    String(row.contact_name ?? ''),
    String(row.phone ?? ''),
    String(row.email ?? ''),
    String(row.status ?? ''),
    String(row.notes ?? ''),
    normaliseDate(row.updated_at)
  ];
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
module.exports = { revisionOfLead };
