const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const checks = [
  ['session rejection closes body-level lead workspace', /function sbcShowLogin\([\s\S]*?getElementById\('sbc-lead-workspace'\)[\s\S]*?classList\.remove\('is-open'\)/.test(source)],
  ['session rejection hides lead launcher', /function sbcShowLogin\([\s\S]*?getElementById\('sbc-lead-workspace-launcher'\)[\s\S]*?hidden\s*=\s*true/.test(source)],
  ['login panel is shown after overlay cleanup', /function sbcShowLogin\([\s\S]*?classList\.remove\('is-open'\)[\s\S]*?querySelector\('#login'\)[\s\S]*?classList\.remove\('hidden'\)/.test(source)]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([,ok]) => !ok)) process.exit(1);
