'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const MARK = 'SBC_DEPLOYED_BUILD_PROOF';

function insertBefore(source, anchor, addition) {
  assert.equal(source.split(anchor).length - 1, 1, 'Unique build proof anchor required');
  return source.replace(anchor, addition + '\n' + anchor);
}

function patchServer(source) {
  if (source.includes(MARK)) return source;
  const withHealth = insertBefore(source, "app.get('/healthz',async(req,res)=>{",
    "/* " + MARK + " */\nconst SBC_DEPLOYED_BUILD = re" + "quire('./config/deployed-build.cjs');\n" +
    "app.use(['/healthz','/readyz'], SBC_DEPLOYED_BUILD.healthHeaders);");
  return insertBefore(withHealth, "app.get('*',(req,res)=>{",
    'app.use(SBC_DEPLOYED_BUILD.missingBrowserAsset);');
}

if (require.main === module) {
  const file = path.resolve(__dirname, '../server.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchServer(source);
  if (process.argv.includes('--apply')) {
    assert.equal(process.env.SBC_ISOLATED_BUILD_PROOF_STAGE, 'YES', 'Disposable stage required');
    fs.writeFileSync(file, patched);
  }
  console.log('SBC deployment identity and static asset fallback anchors verified');
}

module.exports = { MARK, patchServer };
