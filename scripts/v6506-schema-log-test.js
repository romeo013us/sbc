'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const identity = fs.readFileSync(path.join(root, 'config', 'release-identity.js'), 'utf8');

assert.strictEqual(pkg.version, require('../package.json').version, 'package version must match this release');
assert(identity.includes("RELEASE_VERSION = '" + pkg.version + "'"), 'release identity must match package version');
assert(!server.includes("SBC V12.0.5: sbc_settings.setting_value upgraded to MEDIUMTEXT"), 'old application-style migration log must be removed');
assert(server.includes('INFORMATION_SCHEMA.COLUMNS'), 'column type must be checked before migration');
assert(server.includes("settingColumnType === 'mediumtext' || settingColumnType === 'longtext'"), 'existing sufficiently large columns must not be altered');
assert(server.includes('[SBC DB SCHEMA]'), 'schema messages must use the current neutral schema label');
assert(server.includes("ALTER TABLE sbc_settings MODIFY setting_value MEDIUMTEXT NOT NULL"), 'legacy TEXT columns must still be upgraded');
console.log('V65.1.26 inherited schema/log test: 7/7 checks passed');
