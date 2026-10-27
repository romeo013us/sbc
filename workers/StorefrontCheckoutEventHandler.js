'use strict';

// Compatibility facade for the V58.3 worker workspace contract.
// Canonical implementation lives in enterprise/ so Command Center routes and
// background workers share exactly one checkout acceptance policy.
module.exports = require('../enterprise/StorefrontCheckoutEventHandler');
