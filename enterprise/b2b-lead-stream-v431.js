'use strict';

const fs = require('fs');
const crypto = require('crypto');

function clean(value, max = 2000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizePhone(value) {
  return clean(value, 80).replace(/\D/g, '');
}

function normalizeText(value) {
  return clean(value, 500).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function first(record, names) {
  for (const name of names) {
    if (record && record[name] !== undefined && String(record[name]).trim()) return record[name];
  }
  return '';
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') {
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => clean(h, 160));
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, clean(values[i] ?? '', 1000)])));
}

function mapLead(record, source = 'SBC-250-Verified-Lead-Prospects.csv') {
  const businessName = clean(first(record, ['Business Name', 'businessName', 'Company Name', 'Company', 'Business']), 255);
  const contactName = clean(first(record, ['Contact Name', 'contactName', 'Contact', 'Owner']), 255);
  const email = clean(first(record, ['Email', 'email']), 320).toLowerCase();
  const phone = clean(first(record, ['Phone', 'Phone Number', 'phone']), 80);
  const website = clean(first(record, ['Website', 'website']), 500);
  const industry = clean(first(record, ['Industry', 'Type / Industry', 'Type']), 160);
  const address = clean(first(record, ['Address', 'address']), 500);
  return {
    businessName, contactName, email, phone, phoneNormalized: normalizePhone(phone), website, industry, address,
    source: clean(source, 255), status: 'PENDING_VERIFICATION',
    dedupeKey: [normalizeText(businessName), email, normalizePhone(phone), normalizeText(website)].join('|')
  };
}

function batchHash(rows) {
  return crypto.createHash('sha256').update(JSON.stringify(rows || [])).digest('hex');
}

async function streamFile(file, onBatch, options = {}) {
  const resolved = String(file || '');
  if (!resolved || !fs.existsSync(resolved)) throw new Error(`Lead source not found: ${resolved}`);
  const batchSize = Math.max(1, Number(options.batchSize || 100));
  const records = parseCsv(fs.readFileSync(resolved, 'utf8'));
  let total = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const rows = records.slice(i, i + batchSize);
    total += rows.length;
    if (typeof onBatch === 'function') await onBatch(rows, { offset: i, batchNumber: Math.floor(i / batchSize) + 1 });
  }
  return { ok: true, rows: total, batches: Math.ceil(records.length / batchSize) };
}

module.exports = { parseCsv, mapLead, batchHash, streamFile };
