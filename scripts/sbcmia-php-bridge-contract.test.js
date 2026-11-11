'use strict';
/* SBCMIA PHP -> Command Center HMAC contract, synthetic and side-effect free.
 * This test never sends a live request, saves a lead or charges a payment.
 */
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const bridge = require('../enterprise/v6660-website-bridge.cjs');
const root = path.resolve(__dirname, '..');
const secret = 'test-only-site-bridge-signing-secret-at-least-32-bytes';
const json = '{"businessName":"SBC Test","message":"Café Español"}';

function phpHeaders(route, raw, key=secret) {
  const php = `$_SERVER['REQUEST_METHOD']='GET';$_GET=[];ob_start();require 'index.php';ob_end_clean();echo json_encode(sbcSignedBridgeHeaders(${JSON.stringify(route)},${JSON.stringify(raw)}));`;
  const rawOutput = execFileSync('php', ['-r', php], {
    cwd:root, encoding:'utf8', timeout:10000,
    env:{...process.env, SBC_WEBSITE_BRIDGE_KEY:key}
  });
  const lines = JSON.parse(rawOutput);
  assert(Array.isArray(lines),'PHP signer must return a header list');
  return Object.fromEntries(lines.map(line=>{
    const at=line.indexOf(':');
    assert(at>0,'header requires a name and value');
    return [line.slice(0,at).trim().toLowerCase(),line.slice(at+1).trim()];
  }));
}

for (const route of ['/api/web-lead','/api/portal/login','/api/portal/register']) {
  const headers = phpHeaders(route,json);
  assert.equal(headers['x-sbc-website-host'],'sbcmia.com');
  for (const required of ['x-sbc-website-timestamp','x-sbc-website-nonce','x-sbc-website-signature'])
    assert(headers[required],route+' missing '+required);
  const req = {method:'POST',path:route,headers,rawBody:Buffer.from(json)};
  const tampered = bridge.verify({...req,rawBody:Buffer.from(json+' ')},{key:secret});
  assert.equal(tampered.ok,false,route+' must reject modified raw body');
  assert.equal(tampered.code,'SITE_BRIDGE_SIGNATURE_INVALID');
  const accepted = bridge.verify(req,{key:secret});
  assert.equal(accepted.ok,true,route+' PHP signature must verify in Node');
  const replay = bridge.verify(req,{key:secret});
  assert.equal(replay.ok,false,route+' must reject replay');
  assert.equal(replay.code,'SITE_BRIDGE_REPLAY_DENIED');
}
assert.deepEqual(phpHeaders('/api/portal/orders',json),{},'read-only portal routes must not require signing');
assert.deepEqual(phpHeaders('/api/web-lead',json,''),{},'missing secret must fail closed');
console.log('SBCMIA SIGNED BRIDGE PHP/NODE CONTRACT PASS: lead + login + register; tamper/replay/config guards');
