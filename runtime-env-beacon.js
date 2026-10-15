'use strict';

const crypto = require('node:crypto');

const ENV_NAME_PATTERN = /^(?:SBC_|NODE_ENV$|PORT$|HOSTNAME$|WEBSITE_|GODADDY_|APP_)/i;

function buildBeaconLine(env = process.env, hostname = 'unknown-host') {
  const rawRole = env.SBC_RUNTIME_ROLE;
  const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  const role = !normalizedRole
    ? '<absent>'
    : (normalizedRole === 'writer' || normalizedRole === 'readonly' ? normalizedRole : '<invalid>');

  const dbHost = typeof env.DB_HOST === 'string' ? env.DB_HOST : '';
  const dbName = typeof env.DB_NAME === 'string' ? env.DB_NAME : '';
  const fingerprint = dbHost || dbName
    ? crypto.createHash('sha256').update(dbHost + '|' + dbName).digest('hex').slice(0, 8)
    : '<absent>';

  const envNames = Object.keys(env)
    .filter(name => ENV_NAME_PATTERN.test(name))
    .sort()
    .join(',');

  const port = typeof env.PORT === 'string' && env.PORT.length ? env.PORT : '<unset>';
  const nodeEnv = typeof env.NODE_ENV === 'string' && env.NODE_ENV.length ? env.NODE_ENV : '<unset>';
  const safeHostname = String(hostname || 'unknown-host').replace(/[|\r\n]/g, '_');

  return '[SBC ENV BEACON] role_env=' + role +
    ' | node_env=' + nodeEnv +
    ' | port=' + port +
    ' | hostname=' + safeHostname +
    ' | db_fingerprint=' + fingerprint +
    ' | env_names=' + envNames;
}

module.exports = { buildBeaconLine };
