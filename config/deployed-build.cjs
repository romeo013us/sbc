'use strict';

let sourceCommit = null;

function recordVerifiedBuild(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit) ||
      (sourceCommit && sourceCommit !== commit)) {
    throw new Error('Invalid verified deployment identity');
  }
  sourceCommit = commit;
}

function healthHeaders(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  if (sourceCommit) res.setHeader('X-SBC-Source-Commit', sourceCommit);
  next();
}

function missingBrowserAsset(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method) ||
      !/\.(?:m?js|css|map|png|jpe?g|webp|svg|ico|woff2?|webmanifest)$/i.test(req.path)) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(404).type('text/plain').send('Asset not found');
}

module.exports = { recordVerifiedBuild, healthHeaders, missingBrowserAsset };
