'use strict';
// SBC V66.73 GoDaddy backwards-compatible startup only.
// If GoDaddy preserved a legacy `node bootstrap.js` command, launch the same
// verified flat runtime rather than a second compiler or database writer.
console.log('[SBC DEPLOY STARTUP COMPAT] legacy bootstrap.js -> verified flat entrypoint');
require('./sbc-godaddy-flat-entrypoint.cjs');
