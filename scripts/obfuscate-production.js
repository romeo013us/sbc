'use strict';
/**
 * SBC protected production build.
 * Keeps the engineering source readable in the repository while producing
 * a deployable protected tree for external/shared deployments.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let JavaScriptObfuscator;
try { JavaScriptObfuscator = require('javascript-obfuscator'); }
catch (e) {
  console.error('javascript-obfuscator is not installed. Run npm install first.');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'protected');
const publicDir = path.join(ROOT, 'public');
const jsFiles = [
  path.join(ROOT, 'server.js'),
  ...fs.readdirSync(publicDir).filter(f => f.endsWith('.js')).map(f => path.join(publicDir, f))
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'public'), { recursive: true });

const buildSalt = crypto.randomBytes(16).toString('hex');
const obfuscationSeed = crypto.randomInt(1, 2147483646);

const options = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.35,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 3,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  seed: obfuscationSeed
};

for (const src of jsFiles) {
  const code = fs.readFileSync(src, 'utf8');
  const stripped=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  const result = JavaScriptObfuscator.obfuscate(stripped, options).getObfuscatedCode();
  const rel = path.relative(ROOT, src);
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, result + '\n');
}

for (const name of ['index.html','styles.css','manifest.webmanifest','sw.js']) {
  const src = path.join(publicDir, name);
  if (fs.existsSync(src)) {
    const dest = path.join(OUT, 'public', name);
    fs.copyFileSync(src, dest);
  }
}

for (const name of ['package.json','ecosystem.config.cjs']) {
  const src = path.join(ROOT, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, name));
}

const mappingSalt = crypto.randomBytes(24).toString('hex');
const mappingManifest = {version: require(path.join(ROOT,'package.json')).version, generatedAt: new Date().toISOString(), mappingSalt, sourceMap: 'disabled', files: jsFiles.map(f => path.relative(ROOT,f))};
fs.writeFileSync(path.join(OUT, 'PROTECTED-MAP.json'), JSON.stringify(mappingManifest, null, 2) + '\n');

fs.writeFileSync(path.join(OUT, 'PROTECTED-BUILD.txt'),
`SBC protected production build\nGenerated: ${new Date().toISOString()}\nSource build: ${require(path.join(ROOT,'package.json')).version}\nBuild salt: ${buildSalt}\nObfuscation seed: ${obfuscationSeed}\nRuntime mapping salt: ${mappingSalt}\n\nThis tree contains obfuscated JavaScript. Keep the readable source and secrets outside the shared/deployment artifact.\n`);
console.log(`Protected SBC build created at ${OUT}`);
