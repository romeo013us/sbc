'use strict';

/**
 * SBC V47 — Secret Consolidation Layer
 *
 * Purpose:
 *   Keep one canonical GoDaddy Secret slot for credentials/configuration that
 *   are intentionally the same value under multiple legacy/runtime names.
 *
 * Rules:
 *   1. Never logs or returns secret values.
 *   2. An explicitly supplied alias is never overwritten.
 *   3. If the canonical name exists, it populates missing aliases.
 *   4. If only an alias exists, it populates the canonical name (migration-safe).
 *   5. Conflicting values are left untouched and reported as a conflict.
 *
 * This lets the application continue supporting older names while GoDaddy
 * stores only one value. Example: one TWILIO_ACCOUNT_SID can satisfy both
 * TWILIO_ACCOUNT_SID and SBC_TWILIO_ACCOUNT_SID at runtime.
 */

const GROUPS = Object.freeze([
  // Communications — one provider credential, multiple historical names.
  { id: 'twilio.account_sid', canonical: 'TWILIO_ACCOUNT_SID', aliases: ['SBC_TWILIO_ACCOUNT_SID'] },
  { id: 'twilio.auth_token', canonical: 'TWILIO_AUTH_TOKEN', aliases: ['SBC_TWILIO_AUTH_TOKEN'] },
  { id: 'twilio.phone_number', canonical: 'TWILIO_PHONE_NUMBER', aliases: ['SBC_TWILIO_FROM'] },

  // 4OVER4 — V41/V43 naming drift; same provider values.
  { id: '4over4.api_key', canonical: 'FOUROVER4_API_KEY', aliases: ['FOUR_OVER_FOUR_API_KEY'] },
  { id: '4over4.api_url', canonical: 'FOUROVER4_API_URL', aliases: ['FOUR_OVER_FOUR_API_URL'] },
  { id: '4over4.order_endpoint', canonical: 'FOUROVER4_ORDER_ENDPOINT', aliases: ['FOUR_OVER_FOUR_ORDER_ENDPOINT'] },

  // VistaPrint / ProShop — one credential, two runtime names.
  { id: 'vistaprint.api_key', canonical: 'VISTAPRINT_API_KEY', aliases: ['VISTAPRINT_PROSHOP_API_KEY'] },

  // AI provider — one OpenAI credential, legacy/provider alias.
  { id: 'openai.api_key', canonical: 'OPENAI_API_KEY', aliases: ['SBC_AI_PROVIDER_KEY'] },

  // Optional infrastructure aliases. These are configuration values, not
  // credentials, but consolidating them also frees GoDaddy environment slots.
  { id: 'redis.url', canonical: 'SBC_REDIS_URL', aliases: ['REDIS_URL'] },
  { id: 'amqp.url', canonical: 'SBC_AMQP_URL', aliases: ['AMQP_URL'] },
  { id: 'public.url', canonical: 'SBC_PUBLIC_URL', aliases: ['SBC_GODADDY_PUBLIC_URL'] },
  { id: 'ai.model', canonical: 'SBC_AI_MODEL', aliases: ['SBC_KIM_MASTER_MODEL'] }
]);



// Provider bundles: one GoDaddy Secret may contain several related values.
// These are optional. If present, they hydrate the normal process.env names.
// Individual environment variables remain authoritative when explicitly set.
const BUNDLES = Object.freeze([
  {
    id: 'twilio', env: 'SBC_TWILIO_BUNDLE', fields: {
      accountSid: 'TWILIO_ACCOUNT_SID', authToken: 'TWILIO_AUTH_TOKEN',
      apiKeySid: 'TWILIO_API_KEY_SID', apiKeySecret: 'TWILIO_API_KEY_SECRET',
      twimlAppSid: 'TWILIO_TWIML_APP_SID', phoneNumber: 'TWILIO_PHONE_NUMBER'
    }
  },
  {
    id: 'square', env: 'SBC_SQUARE_BUNDLE', fields: {
      accessToken: 'SQUARE_ACCESS_TOKEN', apiVersion: 'SQUARE_API_VERSION',
      environment: 'SQUARE_ENVIRONMENT', locationId: 'SQUARE_LOCATION_ID',
      successRedirectUrl: 'SQUARE_SUCCESS_REDIRECT_URL',
      webhookSignatureKey: 'SQUARE_WEBHOOK_SIGNATURE_KEY', webhookUrl: 'SQUARE_WEBHOOK_URL'
    }
  },
  {
    id: 'smtp', env: 'SBC_SMTP_BUNDLE', fields: {
      host: 'SBC_SMTP_HOST', port: 'SBC_SMTP_PORT', user: 'SBC_SMTP_USER',
      pass: 'SBC_SMTP_PASS', secure: 'SBC_SMTP_SECURE', mailFrom: 'SBC_MAIL_FROM',
      provider: 'SBC_MAIL_PROVIDER'
    }
  },
  {
    id: '4over4', env: 'SBC_4OVER4_BUNDLE', fields: {
      apiKey: 'FOUROVER4_API_KEY', apiUrl: 'FOUROVER4_API_URL',
      orderEndpoint: 'FOUROVER4_ORDER_ENDPOINT', webhookSecret: 'FOUROVER4_WEBHOOK_SECRET'
    }
  },
  {
    id: 'vistaprint', env: 'SBC_VISTAPRINT_BUNDLE', fields: {
      apiKey: 'VISTAPRINT_API_KEY', apiUrl: 'VISTAPRINT_API_URL',
      orderEndpoint: 'VISTAPRINT_ORDER_ENDPOINT', webhookSecret: 'VISTAPRINT_WEBHOOK_SECRET'
    }
  },
  {
    id: 'database', env: 'SBC_DB_BUNDLE', fields: {
      host: 'DB_HOST', port: 'DB_PORT', name: 'DB_NAME', user: 'DB_USER', password: 'DB_PASSWORD'
    }
  },
  {
    id: 'openai', env: 'SBC_OPENAI_BUNDLE', fields: {
      apiKey: 'OPENAI_API_KEY', model: 'SBC_AI_MODEL', reasoning: 'SBC_AI_REASONING', timeoutMs: 'SBC_AI_TIMEOUT_MS'
    }
  },
  {
    id: 'core-security', env: 'SBC_CORE_SECURITY_BUNDLE', fields: {
      jwtSecret: 'SBC_JWT_SECRET', fieldKey: 'SBC_SUPERNOVA_FIELD_KEY', officeSetupSecret: 'SBC_OFFICE_SETUP_SECRET', publicUrl: 'SBC_PUBLIC_URL'
    }
  }
]);

function hydrateBundles() {
  const applied = [];
  const conflicts = [];
  for (const bundle of BUNDLES) {
    if (!present(bundle.env)) continue;
    let parsed;
    try {
      parsed = JSON.parse(process.env[bundle.env]);
    } catch {
      conflicts.push({ group: `bundle:${bundle.id}`, bundle: bundle.env, reason: 'invalid_json' });
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      conflicts.push({ group: `bundle:${bundle.id}`, bundle: bundle.env, reason: 'bundle_not_object' });
      continue;
    }
    for (const [key, target] of Object.entries(bundle.fields)) {
      const candidate = parsed[key] ?? parsed[target];
      if (candidate === undefined || candidate === null || String(candidate).trim() === '') continue;
      if (!present(target)) {
        process.env[target] = String(candidate);
        applied.push({ group: `bundle:${bundle.id}`, source: bundle.env, target });
      } else if (String(process.env[target]) !== String(candidate)) {
        conflicts.push({ group: `bundle:${bundle.id}`, bundle: bundle.env, target, reason: 'explicit_env_conflict' });
      }
    }
  }
  return { applied, conflicts };
}

function present(name) {
  const value = process.env[name];
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function value(name) {
  return String(process.env[name] ?? '');
}

function consolidate() {
  const applied = [];
  const conflicts = [];

  for (const group of GROUPS) {
    const names = [group.canonical, ...group.aliases];
    const presentNames = names.filter(present);
    if (!presentNames.length) continue;

    // Canonical wins when it exists. Otherwise promote the first supplied alias
    // to canonical so legacy-only deployments remain functional.
    const source = present(group.canonical) ? group.canonical : presentNames[0];
    const sourceValue = value(source);

    for (const name of names) {
      if (name === source) continue;
      if (!present(name)) {
        process.env[name] = sourceValue;
        applied.push({ group: group.id, source, target: name });
      } else if (value(name) !== sourceValue) {
        conflicts.push({ group: group.id, canonical: group.canonical, source, conflicting: name });
      }
    }
  }

  return {
    version: '48.0.0-secret-consolidation-2',
    groups: GROUPS.length,
    applied,
    conflicts,
    consolidatedCount: applied.length,
    conflictCount: conflicts.length
  };
}

const BUNDLE_RESULT = hydrateBundles();
const RESULT = consolidate();
RESULT.applied = [...BUNDLE_RESULT.applied, ...RESULT.applied];
RESULT.conflicts = [...BUNDLE_RESULT.conflicts, ...RESULT.conflicts];
RESULT.consolidatedCount = RESULT.applied.length;
RESULT.conflictCount = RESULT.conflicts.length;

if (process.env.SBC_SECRET_CONSOLIDATION_DEBUG === 'true') {
  console.log(`[SBC SECRET CONSOLIDATION] groups=${RESULT.groups} aliasesFilled=${RESULT.consolidatedCount} conflicts=${RESULT.conflictCount}`);
}

module.exports = {
  GROUPS,
  BUNDLES,
  result: () => ({ ...RESULT, applied: RESULT.applied.map(x => ({ ...x })), conflicts: RESULT.conflicts.map(x => ({ ...x })) }),
  consolidate
};
