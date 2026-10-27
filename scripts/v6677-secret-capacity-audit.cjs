'use strict';
// SBC V66.77 — read-only environment-name inventory and compiled-runtime reference survey.
// Deliberately NEVER reads or logs environment variable values.
const fs = require('node:fs');
const path = require('node:path');

const CAP = 50;
const CONFIG_CANDIDATES = Object.freeze([
  'SBC_AI_TIMEOUT_MS',
  'SBC_TWILIO_TIMEOUT_MS',
  'SBC_KIM_MASTER_MODEL',
  'SBC_WORKER_MEMORY_MB',
  'SBC_SMTP_PORT',
  'SBC_SMTP_SECURE',
  'SQUARE_API_VERSION',
]);
const HIGH_RISK = Object.freeze([
  'DB_PASSWORD','OPENAI_API_KEY','SQUARE_ACCESS_TOKEN','SQUARE_WEBHOOK_SIGNATURE_KEY',
  'TWILIO_AUTH_TOKEN','TWILIO_API_KEY_SECRET','SBC_RUNTIME_ROLE','SBC_SESSION_SECRET',
  'SBC_AUTH_SECRET','SBC_COOKIE_SECRET','SBC_CSRF_SECRET','SBC_ENCRYPTION_KEY',
  'SBC_VAULT_KEY','SBC_PORTAL_SECRET','SBC_API_SECRET','SBC_WEBHOOK_SECRET',
  'SBC_PRESENTATION_SIGNING_SECRET','SBC_ADMIN_PASSWORD','OFFICE_BOX_WEBHOOK_SECRET',
  'SBC_WEBSITE_BRIDGE_KEY','SBC_SMTP_PASS',
]);
const VALID_NAME = /^[A-Z_][A-Z0-9_]*$/;
function parseNames(text) {
  const raw = text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
  for (const n of raw) if (!VALID_NAME.test(n)) throw Error('Name-only file contains invalid entry; do NOT include .env values');
  const unique = [...new Set(raw)];
  return { names: unique, duplicateCount: raw.length-unique.length };
}
function collectCode(root) {
  if (!fs.existsSync(root)) return [];
  const found=[];
  const skipDirs = new Set(['.git','node_modules','data','backups','sbc-persistent','.github','public','browser_public','docs','test','tests']);
  const walk=(folder,depth)=>{
    if (depth>7) return;
    for (const entry of fs.readdirSync(folder,{withFileTypes:true})) {
      if (entry.isSymbolicLink()) continue;
      const f=path.join(folder,entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.sbc-runtime-')) walk(f,depth+1);
      } else if (entry.isFile() && /\.(?:c?js|mjs)$/.test(entry.name) && entry.name !== path.basename(__filename)) {
        if (fs.statSync(f).size<=12*1024*1024) found.push(f);
      }
    }
  };
  walk(root,0);
  return found;
}
function audit({names,runtime,variant='unknown',codeFiles=collectCode(runtime)}) {
  const inspected=codeFiles.map(f=>({name:path.relative(runtime,f),content:fs.readFileSync(f,'utf8')}));
  function observed(name){ const re=new RegExp('\\b'+name+'\\b'); return inspected.filter(x=>re.test(x.content)).map(x=>x.name); }
  const set=new Set(names);
  const entries=CONFIG_CANDIDATES.map(name=>({name,present:set.has(name),sourceReferences:observed(name)}));
  return {
    schema:1,
    mode:'READ_ONLY_NAME_AUDIT',
    variant,
    limit:CAP,
    declaredUniqueNames:names.length,
    exceedsLimit:names.length>CAP,
    inspectedSourceFiles:inspected.length,
    configurationMigrationCandidates:entries,
    protectionsPresent:HIGH_RISK.filter(x=>set.has(x)),
    websiteBridgeKeyNamePresent:set.has('SBC_WEBSITE_BRIDGE_KEY'),
    notes:[
      'Candidates are NOT approved for deletion; current values and complete compiled-runtime behavior must be preserved first.',
      'Textual source references are clues only; dynamic environment access and third-party code may not be detected.',
      'Never remove a protected credential, writer setting, or authentication key to make room for a new token.',
      'Compare Preview and Publish inventories separately; never infer either environment from a merged list.',
    ]
  };
}
function runCli(argv=process.argv.slice(2)){
  const get=k=>{const t=argv.find(s=>s.startsWith(k+'='));return t&&t.slice(k.length+1)};
  const file=get('--names-file');
  if(!file)throw Error('Specify a name-only file: --names-file=/path/names.txt (one VARIABLE_NAME per line, never values)');
  const root=path.resolve(get('--runtime')||process.cwd());
  const variant=get('--variant')||'unknown';
  if(!['preview','publish','unknown'].includes(variant))throw Error('Invalid variant');
  const parsed=parseNames(fs.readFileSync(file,'utf8'));
  const report=audit({names:parsed.names,runtime:root,variant});
  report.duplicateNames=parsed.duplicateCount;
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module){try{runCli()}catch(e){console.error('[SBC SECRETS AUDIT] '+e.message);process.exitCode=1}}
module.exports={parseNames,collectCode,audit,runCli,CONFIG_CANDIDATES,HIGH_RISK};
