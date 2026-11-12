'use strict';

const { createHash, createPrivateKey, sign } = require('node:crypto');

const CREDENTIAL = 'SBC_GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT';
const PROPERTY = 'https://sbcmia.com/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const QUERY_URL = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DAY = 86_400_000;
const CACHE_LIMIT = 32;

function parseCredential(value) {
  if (typeof value !== 'string' || value.length > 20_000) throw Error('SEARCH_CREDENTIAL_INVALID');
  const fields = JSON.parse(value);
  if (fields?.type !== 'service_account' || typeof fields.client_email !== 'string' ||
      !/^[a-z0-9._-]+@[a-z0-9.-]+\.gserviceaccount\.com$/i.test(fields.client_email) ||
      typeof fields.private_key !== 'string' || fields.token_uri !== TOKEN_URL) {
    throw Error('SEARCH_CREDENTIAL_INVALID');
  }
  const key = createPrivateKey(fields.private_key);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) {
    throw Error('SEARCH_CREDENTIAL_INVALID');
  }
  return { email: fields.client_email, key };
}

function jwtAssertion(credential, time) {
  const issuedAt = Math.floor(time / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const claims = encode({ iss: credential.email, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 900 });
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), credential.key).toString('base64url')}`;
}

function reportDates(days, time) {
  // Search Console reports calendar dates in Pacific Time. Allow three full
  // days of reporting lag and request finalized data from the API.
  const [month, day, year] = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(time)).split('/').map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  const date = offset => new Date(midnight + offset * DAY).toISOString().slice(0, 10);
  return {
    current: { startDate: date(-days - 3), endDate: date(-4) },
    previous: { startDate: date(-2 * days - 3), endDate: date(-days - 4) }
  };
}

async function requestJson(fetcher, url, options) {
  const response = await fetcher(url, { ...options, redirect: 'error' });
  if (!response.ok) {
    throw Object.assign(Error('SEARCH_PROVIDER_HTTP_ERROR'), { status: response.status, endpoint: url });
  }
  return response.json();
}

function metrics(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('SEARCH_PROVIDER_RESPONSE_INVALID');
  if (data.rows === undefined || (Array.isArray(data.rows) && data.rows.length === 0)) return null;
  const row = Array.isArray(data.rows) && data.rows.length === 1 && data.rows[0];
  if (!row || !Number.isSafeInteger(row.clicks) || row.clicks < 0 ||
      !Number.isSafeInteger(row.impressions) || row.impressions < row.clicks) {
    throw Error('SEARCH_PROVIDER_RESPONSE_INVALID');
  }
  return { clicks: row.clicks, impressions: row.impressions };
}

async function queryReport(fetcher, credential, periods, time) {
  const signal = AbortSignal.timeout(6500);
  const token = await requestJson(fetcher, TOKEN_URL, {
    method: 'POST', signal,
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtAssertion(credential, time)
    })
  });
  if (typeof token?.access_token !== 'string' || !/^[!-~]{1,4096}$/.test(token.access_token)) {
    throw Error('SEARCH_ACCESS_TOKEN_INVALID');
  }
  const fetchPeriod = async period => metrics(await requestJson(fetcher, QUERY_URL, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...period, type: 'web', dataState: 'final', rowLimit: 1 })
  }));
  const [current, previous] = await Promise.all([fetchPeriod(periods.current), fetchPeriod(periods.previous)]);
  return { status: 'connected', property: PROPERTY, periods, current, previous, checkedAt: new Date(time).toISOString() };
}

function createReader(fetcher = globalThis.fetch) {
  const cache = new Map();
  return async function read({ tenantId, value, days, time }) {
    const key = `${tenantId}:${days}`;
    if (!value) {
      cache.delete(key);
      return { status: 'not_configured', property: PROPERTY };
    }
    const periods = reportDates(days, time);
    const version = `${periods.current.endDate}:${createHash('sha256').update(value).digest('hex')}`;
    const previous = cache.get(key);
    if (previous?.version === version && (previous.expiresAt === null || time < previous.expiresAt)) {
      return previous.task;
    }
    let credential;
    try { credential = parseCredential(value); }
    catch { return { status: 'credential_invalid', property: PROPERTY }; }

    const entry = { version, expiresAt: null };
    entry.task = queryReport(fetcher, credential, periods, time).catch(error => {
      const denied = error.endpoint === QUERY_URL && [401, 403, 404].includes(error.status);
      const invalid = error.endpoint === TOKEN_URL && [400, 401, 403].includes(error.status);
      return { status: denied ? 'access_denied' : invalid ? 'credential_invalid' : 'unavailable', property: PROPERTY };
    }).then(report => {
      entry.expiresAt = time + (report.status === 'connected' ? 15 * 60_000 : 60_000);
      return report;
    });
    if (!cache.has(key) && cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
    return entry.task;
  };
}

module.exports = { CREDENTIAL, PROPERTY, parseCredential, createReader };
