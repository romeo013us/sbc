'use strict';

/**
 * SBC V60.4.2 — tolerant JSON boundary.
 *
 * Database drivers/providers may return JSON columns as either strings or
 * already-materialized objects. Never feed an object to JSON.parse(), which
 * coerces it to "[object Object]" and throws a misleading SyntaxError.
 */
function parseJson(value, fallback = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function stringifyJson(value, fallback = '{}') {
  try { return JSON.stringify(value ?? {}); } catch { return fallback; }
}

module.exports = { parseJson, stringifyJson };
