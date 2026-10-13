'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installTenantRejectionGuard, isMissingTenantContext } = require('../tenant-rejection-guard');

assert.equal(isMissingTenantContext(Object.assign(new Error('TENANT_CONTEXT_REQUIRED'), { code: 'TENANT_CONTEXT_REQUIRED' })), true);
assert.equal(isMissingTenantContext(new Error('database unavailable')), false);

const emitter = new EventEmitter();
const fakeProcess = { on: emitter.on.bind(emitter), emit: emitter.emit.bind(emitter) };
const logs = [];
const logger = { error: (...args) => logs.push(args.join(' ')) };
assert.equal(installTenantRejectionGuard(fakeProcess, logger), true);
fakeProcess.on('unhandledRejection', reason => { throw new Error('fatal handler invoked: ' + reason.message); });
assert.doesNotThrow(() => fakeProcess.emit('unhandledRejection', Object.assign(new Error('TENANT_CONTEXT_REQUIRED'), { code: 'TENANT_CONTEXT_REQUIRED' }), Promise.resolve()));
assert.equal(logs.length, 1);
assert.match(logs[0], /failed closed/);
assert.throws(() => fakeProcess.emit('unhandledRejection', new Error('database unavailable'), Promise.resolve()), /fatal handler invoked/);
console.log('[SBC V65.1.34 TENANT REJECTION GUARD TEST] PASS');
