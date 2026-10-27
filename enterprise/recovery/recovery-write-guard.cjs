'use strict';

// Fail closed for API writes while authoritative MySQL recovery is required.
// Login and logout remain available so the owner can inspect status and exit safely.
const SAFE_SESSION_PATHS = new Set(['/api/login', '/api/logout']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isExpectedRecoveryRejection(reason) {
  const message = String(reason?.message || reason || '');
  return ['MYSQL_RECOVERY_REQUIRED','MYSQL_RECOVERY_NOT_EVALUATED'].includes(reason?.code) || ['MYSQL_RECOVERY_REQUIRED','MYSQL_RECOVERY_NOT_EVALUATED'].includes(message);
}

function createRecoveryWriteGuard(options = {}) {
  const isRecoveryRequired = typeof options.isRecoveryRequired === 'function'
    ? options.isRecoveryRequired
    : () => false;
  const allowPaths = new Set(options.allowPaths || SAFE_SESSION_PATHS);
  return function recoveryWriteGuard(req, res, next) {
    let recoveryRequired = false;
    try { recoveryRequired = Boolean(isRecoveryRequired()); } catch { recoveryRequired = true; }
    if (!recoveryRequired || !String(req.path || '').startsWith('/api/') || !WRITE_METHODS.has(String(req.method || '').toUpperCase())) return next();
    if (allowPaths.has(String(req.path || ''))) return next();
    return res.status(423).json({
      ok: false,
      error: 'MYSQL_RECOVERY_REQUIRED',
      recoveryRequired: true,
      readOnly: true,
      message: 'This API write is blocked until authoritative MySQL recovery is verified. No business mutation was accepted.'
    });
  };
}

module.exports = { createRecoveryWriteGuard, isExpectedRecoveryRejection, SAFE_SESSION_PATHS, WRITE_METHODS };
