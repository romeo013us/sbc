'use strict';

// Runtime prestart must never mutate node_modules or invoke npm in GoDaddy's
// managed container. Dependency installation belongs to the build/deploy step.
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function missingEntrypoints() {
  const missing = [];
  for (const name of ['dayjs', 'dayjs/plugin/utc']) {
    try {
      require.resolve(name, { paths: [root] });
    } catch {
      missing.push(name);
    }
  }
  return missing;
}

function main() {
  const missing = missingEntrypoints();
  if (missing.length) {
    throw new Error(
      'Required runtime dependency entrypoint(s) are missing: ' + missing.join(', ') +
      '. Runtime installation is disabled. Confirm dayjs is in dependencies and package-lock.json is current, ' +
      'then rebuild Preview so the hosting platform installs dependencies before startup.'
    );
  }
  console.log('[SBC DEPENDENCY PREFLIGHT] PASS: dayjs and dayjs/plugin/utc resolve from the repository root.');
}

try {
  main();
} catch (error) {
  console.error('[SBC DEPENDENCY PREFLIGHT] FATAL:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
