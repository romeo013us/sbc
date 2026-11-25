'use strict';

let sourceCommit = null;
let verifiedRelease = null;

function recordVerifiedBuild(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit) ||
      (sourceCommit && sourceCommit !== commit)) {
    throw new Error('Invalid verified deployment identity');
  }
  sourceCommit = commit;
}

function recordVerifiedRelease(id) {
  if(!id || !/^[a-f0-9]{40}$/.test(id.sourceCommit||'') ||
     !['serverSha256','sourceFingerprint','stagedInventorySha256'].every(k=>/^[a-f0-9]{64}$/.test(id[k]||'')) ||
     typeof id.candidateOnly!=='boolean' || id.productionCertified!==false) throw Error('Invalid verified release proof');
  const next=Object.freeze({sourceCommit:id.sourceCommit,serverSha256:id.serverSha256,sourceFingerprint:id.sourceFingerprint,stagedInventorySha256:id.stagedInventorySha256,candidateOnly:id.candidateOnly});
  if(verifiedRelease&&JSON.stringify(verifiedRelease)!==JSON.stringify(next))throw Error('Verified release proof cannot change');
  recordVerifiedBuild(id.sourceCommit);
  verifiedRelease=next;
}
function healthHeaders(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  if (sourceCommit) res.setHeader('X-SBC-Source-Commit', sourceCommit);
  if(verifiedRelease){
    res.setHeader('X-SBC-Server-Sha256',verifiedRelease.serverSha256);
    res.setHeader('X-SBC-Source-Fingerprint',verifiedRelease.sourceFingerprint);
    res.setHeader('X-SBC-Inventory-Sha256',verifiedRelease.stagedInventorySha256);
    res.setHeader('X-SBC-Release-Candidate',String(verifiedRelease.candidateOnly));
  }
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

module.exports = { recordVerifiedBuild, recordVerifiedRelease, healthHeaders, missingBrowserAsset };
