'use strict';
const crypto = require('crypto');

// Read-only audit. It groups environment variables by SHA-256 fingerprint
// without ever printing their values. Use this on the live server to discover
// additional exact-value duplicates that are safe to consolidate after review.
const names = Object.keys(process.env)
  .filter(k => /(?:SECRET|TOKEN|KEY|PASSWORD|PASS|SID|CREDENTIAL|AUTH|WEBHOOK)/i.test(k))
  .filter(k => process.env[k] !== undefined && String(process.env[k]).trim() !== '');

const groups = new Map();
for (const name of names) {
  const fingerprint = crypto.createHash('sha256').update(String(process.env[name])).digest('hex').slice(0, 16);
  if (!groups.has(fingerprint)) groups.set(fingerprint, []);
  groups.get(fingerprint).push(name);
}

const duplicates = [...groups.entries()]
  .filter(([, vars]) => vars.length > 1)
  .map(([fingerprint, vars]) => ({ fingerprint, variables: vars.sort() }))
  .sort((a,b) => b.variables.length - a.variables.length || a.fingerprint.localeCompare(b.fingerprint));

console.log(JSON.stringify({
  ok: true,
  scannedVariables: names.length,
  duplicateValueGroups: duplicates.length,
  duplicates,
  note: 'Fingerprints only. Secret values are never printed.'
}, null, 2));
