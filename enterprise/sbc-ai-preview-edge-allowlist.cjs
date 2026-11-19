'use strict';
/**
 * SBC private customer website ZIP asset edge pass-through.
 *
 * This function is only a request-shape filter at the outer zero-trust gate.
 * It cannot authorize a file: the downstream ZIP preview route validates the
 * unpredictable 256-bit grant, its expiration, customer, tenant and upload,
 * then validates the archive-relative path before returning any bytes.
 *
 * Browsers intentionally omit SameSite login cookies from the opaque-origin
 * sandbox iframe. The token URL, not an exposed session cookie, is the only
 * way local CSS, JS and image files can render inside that sandbox.
 */
const ROOT=/^\/api\/website-production\/customers\/([A-Za-z0-9_:.+-]{1,120})\/ai-proposals\/uploads\/(up_[a-f0-9]{32})\/render\/([A-Za-z0-9_-]{43})\/(.+)$/;
const ASSET=/\.(?:html?|css|m?js|json|webmanifest|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|txt|xml|avif)$/i;
function isPreviewAssetRequest(req){
  if(!req||!['GET','HEAD'].includes(req.method))return false;
  const matched=ROOT.exec(String(req.path||''));
  if(!matched)return false;
  const relative=matched[4];
  if(relative.length>260||relative.includes('\\')||relative.includes('\0')||relative.startsWith('/')||
     relative.split('/').length>12||
     relative.split('/').some(part=>!part||part==='.'||part==='..'))return false;
  return ASSET.test(relative);
}
module.exports={isPreviewAssetRequest};
