'use strict';
// Owner-approved SBC commercial policy, effective 2026-10-30.
// A legacy SBC_MIN_MARGIN_PCT=0.30 setting must not silently re-enable the old floor.
// Any later policy change requires an explicit code review and release verification.
const MIN_MARGIN_PCT = 0.20;
module.exports = Object.freeze({ MIN_MARGIN_PCT });
