'use strict';
// Preserve V66 root launcher data persistence, tenant process guards and boot beacon.
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const root = __dirname;
const {persistState} = require('./persistent-state.js');
const state = persistState(root, root, {reused:false});
if (state.ephemeral) throw Error('SBC flat runtime rejects ephemeral customer state');
const bootId = Date.now().toString(36)+'-'+process.pid+'-'+crypto.randomBytes(4).toString('hex');
process.env.SBC_BOOT_ID = bootId;
console.log('[SBC FLAT STARTUP] boot_id='+bootId+' port='+(process.env.PORT||'<absent>')+' role_env='+String(process.env.SBC_RUNTIME_ROLE||'<absent>'));
console.log(require('./runtime-env-beacon.js').buildBeaconLine(process.env,os.hostname()));
require('./tenant-rejection-guard.js').installTenantRejectionGuard(process,console);
require(path.join(root,'server.js'));
