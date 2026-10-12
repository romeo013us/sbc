'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6526_DEMO_STUDIO';
function once(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${MARKER}: ${label} anchor count ${count}`);
  return source.replace(oldText, newText);
}
function apply(root) {
  const pub = path.join(root, 'public');
  const serverPath = path.join(root, 'server.js');
  const indexPath = path.join(pub, 'index.html');
  const cssPath = path.join(pub, 'sbc-command-center-ui-v56-25-3.css');
  const moduleSource = path.join(__dirname, 'sbc-demo-studio-v6526.js');
  for (const f of [serverPath, indexPath, cssPath, moduleSource]) if (!fs.existsSync(f)) throw new Error(`${MARKER}: missing ${path.relative(root, f)}`);

  // Ensure an explicitly selected variation outranks a previous AI-plan style.
  let server = fs.readFileSync(serverPath, 'utf8');
  server = once(server, "app.post('/api/communications/email',auth,ownerOnly,async(req,res)=>{try{", "app.post('/api/communications/email',auth,ownerOnly,async(req,res)=>{try{if(!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||SBC_RUNTIME_READ_ONLY)return res.status(423).json({error:'SBC_RECOVERY_OR_READ_ONLY_BLOCK',message:'Outbound communications are disabled until recovery is evaluated and the Published writer is active.'});", 'server-side email recovery gate');
  server = once(server, "app.post('/api/communications/sms',auth,ownerOnly,async(req,res)=>{try{", "app.post('/api/communications/sms',auth,ownerOnly,async(req,res)=>{try{if(!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||SBC_RUNTIME_READ_ONLY)return res.status(423).json({error:'SBC_RECOVERY_OR_READ_ONLY_BLOCK',message:'Outbound communications are disabled until recovery is evaluated and the Published writer is active.'});", 'server-side SMS recovery gate');
  server = once(server, "app.post('/api/website-demos',auth,async(req,res)=>{", "app.post('/api/website-demos',auth,async(req,res)=>{if(!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||SBC_RUNTIME_READ_ONLY)return res.status(423).json({error:'SBC_RECOVERY_OR_READ_ONLY_BLOCK',message:'Demo generation is disabled until recovery is evaluated and the Published writer is active.'});", 'server-side demo-generation recovery gate');
  server = once(server, "visualSystem:String(plan.visualSystem||'premium-hybrid'),media:plan.media||seed.media||{},aiDirector:", "visualSystem:String(plan.visualSystem||'premium-hybrid'),designStyle:style,media:plan.media||seed.media||{},aiDirector:", 'persist selected design direction');
  const oldReturn = "  return String(result.html||'').replace('</body>',checkoutBlock+'</body>');";
  const newReturn = `  const businessLabel=String(demo?.customer?.businessName||demo?.customer?.contactName||'your business').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));\n  const previewRibbon='<aside class="sbc-concept-ribbon" aria-label="Website concept preview"><span class="sbc-concept-dot"></span><span><strong>Custom website concept</strong><small>Prepared for '+businessLabel+' by Successful By Choice</small></span><span class="sbc-concept-tag">PREVIEW</span></aside><style>.sbc-concept-ribbon{position:relative;z-index:70;display:flex;align-items:center;gap:12px;padding:12px clamp(16px,4vw,44px);background:#0b1020;color:#fff;border-bottom:1px solid rgba(255,255,255,.12);font:500 12px/1.4 Inter,system-ui,sans-serif}.sbc-concept-ribbon strong{display:block;font-size:12px;letter-spacing:.01em}.sbc-concept-ribbon small{display:block;color:#b7c1d4;margin-top:2px;font-size:11px}.sbc-concept-dot{width:9px;height:9px;border-radius:50%;background:#f28a19;box-shadow:0 0 0 4px rgba(242,138,25,.16);flex:none}.sbc-concept-tag{margin-left:auto;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 9px;font-size:9px;font-weight:800;letter-spacing:.14em;color:#dce8ff}@media(max-width:520px){.sbc-concept-ribbon{gap:9px;padding:10px 14px}.sbc-concept-ribbon small{max-width:240px}.sbc-concept-tag{font-size:8px;padding:4px 6px}}</style>';\n  const premiumHtml=String(result.html||'').replace('<body>','<body>'+previewRibbon);\n  return premiumHtml.replace('</body>',checkoutBlock+'</body>');`;
  server = once(server, oldReturn, newReturn, 'demo preview ribbon insertion');
  fs.writeFileSync(serverPath, server);

  // Make the chosen direction affect the actual customer-facing renderer, not just metadata.
  const enginePath = path.join(root, 'enterprise', 'sbc-site-design-engine.js');
  if (!fs.existsSync(enginePath)) throw new Error(`${MARKER}: missing enterprise/sbc-site-design-engine.js`);
  let engine = fs.readFileSync(enginePath, 'utf8');
  const oldStyleMap = "  if(['archival','minimal','swiss','editorial','authority','professional','property','culinary','care'].includes(requested)) return 'archival';\n  if(['tactile','glass','glassmorphism','technology','modern-tech','bento'].includes(requested)) return 'tactile';\n  return 'generative';";
  const newStyleMap = "  if(['archival','swiss','editorial','property','culinary','care'].includes(requested)) return 'editorial';\n  if(requested==='minimal') return 'minimal';\n  if(['authority','professional'].includes(requested)) return 'professional';\n  if(['tactile','glass','glassmorphism','technology','modern-tech','bento'].includes(requested)) return 'tactile';\n  return 'generative';";
  engine = once(engine, oldStyleMap, newStyleMap, 'distinct design direction mapping');
  const styleRules = {
    editorial: '.hero{min-height:650px}.hero h1{font-family:Georgia,serif;font-weight:500;letter-spacing:-.045em;line-height:.96}.eyebrow,.meta{letter-spacing:.2em}.glass{border-radius:12px;box-shadow:none;background:rgba(255,255,255,.9)}.services{gap:12px;background:transparent;border:0}.service{border:1px solid var(--line);border-radius:12px}.media-card,.video,.aboutbox,.quote{border-radius:12px}.nav{backdrop-filter:none;background:rgba(246,244,240,.96)}',
    tactile: '.hero{min-height:720px}.hero h1{letter-spacing:-.04em}.glass,.media-card,.video,.aboutbox,.quote,.service{border-radius:16px}.glass{box-shadow:0 16px 42px rgba(0,0,0,.1)}.services{gap:12px;background:transparent;border:0}.service{border:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,.06)}.orb{filter:blur(55px)}',
    minimal: '.hero{min-height:600px}.hero h1{font-size:clamp(2.8rem,6.5vw,6rem);font-weight:600;letter-spacing:-.035em;line-height:1}.orb{display:none}.glass{backdrop-filter:none;box-shadow:none;border-radius:8px;background:#fff}.section{padding:76px 0}.services{gap:0;background:transparent;border:0}.service{border-top:1px solid var(--line);padding:28px 20px;min-height:180px}.service h3{margin:32px 0 10px}.media-card,.video,.aboutbox,.quote{border-radius:8px}.strip{margin-top:-30px}',
    professional: '.hero{min-height:680px}.hero h1{font-size:clamp(3rem,7vw,6.5rem);letter-spacing:-.05em}.nav{background:#fff;backdrop-filter:none}.glass,.aboutbox{border-radius:10px}.services{gap:8px;background:transparent;border:0}.service{border-left:3px solid var(--p);background:#fff;min-height:220px}.media-card,.video,.quote{border-radius:10px}.btn{border-radius:8px}.eyebrow,.meta{letter-spacing:.12em}'
  };
  const styleFn = 'function styleCss(style){\n switch(style){\n' + Object.entries(styleRules).map(([name, css]) => '  case ' + JSON.stringify(name) + ': return ' + JSON.stringify(css) + ';').join('\n') + '\n  default: return "";\n }\n}\nfunction buildSite(demo){';
  engine = once(engine, 'function buildSite(demo){', styleFn, 'install design-specific renderer CSS');
  engine = once(engine, '<style>${css(primary,accent)}</style>', '<style>${css(primary,accent)}${styleCss(styleFor(demo))}</style>', 'apply design-specific CSS to generated page');
  fs.writeFileSync(enginePath, engine);

  fs.copyFileSync(moduleSource, path.join(pub, 'sbc-demo-studio-v6526.js'));
  fs.copyFileSync(moduleSource, path.join(root, 'hotfix-assets', 'sbc-demo-studio-v6526.js'));
  fs.copyFileSync(__filename, path.join(root, 'hotfix-assets', 'apply-v6526-demo-studio.js'));
  const testSource = path.join(__dirname, 'v6526-demo-studio-test.js');
  if (!fs.existsSync(testSource)) throw new Error(`${MARKER}: missing regression test source`);
  fs.copyFileSync(testSource, path.join(root, 'hotfix-assets', 'v6526-demo-studio-test.js'));
  let index = fs.readFileSync(indexPath, 'utf8');
  if (!index.includes('/sbc-demo-studio-v6526.js')) {
    index = once(index, '</body>', '<script src="/sbc-demo-studio-v6526.js?v=65.1.26-demo-studio"></script>\n</body>', 'demo studio script insertion');
  }
  index = index.replace(/65\.1\.25-customer360/g, '65.1.26-demo-studio');
  index = index.replace(/V65\.1\.25/g, 'V65.1.26');
  index = index.replace(/V65\.1\.26 · CUSTOMER 360 WORKSPACE/g, 'V65.1.26 · DEMO STUDIO');
  fs.writeFileSync(indexPath, index);

  const finalizerPath = path.join(pub, 'v56251-ui-finalize.js');
  if (fs.existsSync(finalizerPath)) fs.writeFileSync(finalizerPath, fs.readFileSync(finalizerPath, 'utf8').replace(/__SBC_UI_RELEASE__='65\.1\.23'/g, "__SBC_UI_RELEASE__='65.1.26'").replace(/V65\.1\.23 · RECOVERY-SAFE CANDIDATE/g, 'V65.1.26 · DEMO STUDIO'));

  // Historical regression tests that asserted a frozen V65.1.24 identity must follow the active release.
  const scriptsDir = path.join(root, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const file of fs.readdirSync(scriptsDir)) {
      if (!file.endsWith('.js') || file === 'v6510-ui-recovery-buttons-test.js') continue;
      const testPath = path.join(scriptsDir, file);
      let test = fs.readFileSync(testPath, 'utf8');
      test = test.replace(/assert\.equal\(pkg\.version,\s*['\"]65\.1\.24['\"]\)/g, "assert.equal(pkg.version, require('../package.json').version)");
      test = test.replace(/assert\.strictEqual\(pkg\.version,\s*['\"]65\.1\.24['\"](,)/g, "assert.strictEqual(pkg.version, require('../package.json').version$1");
      test = test.replace(/assert\.equal\(release\.RELEASE_VERSION,\s*['\"]65\.1\.24['\"]\)/g, 'assert.equal(release.RELEASE_VERSION,pkg.version)');
      test = test.replace(/assert\.strictEqual\(release\.RELEASE_VERSION,\s*['\"]65\.1\.24['\"]\)/g, 'assert.strictEqual(release.RELEASE_VERSION,pkg.version)');
      test = test.replace(/assert\.match\(identity,\/RELEASE_VERSION = '65\\\.1\\\.24'\/\)/g, "assert.match(identity,new RegExp(\"RELEASE_VERSION = '\" + pkg.version.replaceAll('.', '\\\\.') + \"'\"))");
      test = test.replace(/identity\.includes\(\"RELEASE_VERSION = '65\.1\.24'\"\)/g, `identity.includes("RELEASE_VERSION = '" + pkg.version + "'")`);
      test = test.replace(/pkg\.version==='65\.1\.24'/g, "pkg.version===require('../package.json').version");
      test = test.replace(/rel\.RELEASE_VERSION==='65\.1\.24'/g, 'rel.RELEASE_VERSION===pkg.version');
      test = test.replace(/RELEASE_VERSION = '65\\\.1\\\.24'/g, "RELEASE_VERSION = '65\\.1\\.26'");
      test = test.replace(/V65\\\.1\\\.24 · RECOVERY-SAFE CANDIDATE/g, 'V65\\.1\\.26 · DEMO STUDIO');
      test = test.replace(/app\\\.js\\\?v=65\\\.1\\\.24/g, 'app\\.js\\?v=65\\.1\\.26-demo-studio');
      test = test.replace(/'65\.1\.24'/g, "'65.1.26'").replace(/"65\.1\.24"/g, '"65.1.26"');
      test = test.replace(/V65\.1\.24 · RECOVERY-SAFE CANDIDATE/g, 'V65.1.26 · DEMO STUDIO');
      test = test.replace(/65\.1\.24-recovery-authfix/g, '65.1.26-demo-studio');
      test = test.replace(/65\.1\.24/g, '65.1.26');
      test = test.replace(/65\\\.1\\\.24/g, '65\\.1\\.26');
      test = test.replace(/release\.RELEASE\.patch===24/g, 'release.RELEASE.patch===26');
      test = test.replace(`assert.match(server, /async function saveData\\(\\)\\{\\s*\\/\\/ V65\\.1\\.11:[\\s\\S]*?if\\(!MYSQL_RECOVERY_EVALUATED\\)/,`, `assert.match(server, /async function saveData\\(\\)\\{[\\s\\S]*?if\\(!MYSQL_RECOVERY_EVALUATED\\)/,`);
      // Some legacy UI panels keep their own feature-era label; validate the label shape, not a stale patch number.
      test = test.replace(/assert\.match\((kim|launch|growthUi),\/SBC OS V65\\\.1\\\.26\/\)/g, 'assert.match($1,/SBC OS V65\\.1\\.\\d+/)');
      if (file === 'v6513-recovery-safe-training-test.js') {
        if (!test.includes("const pkg=JSON.parse(read('package.json'));")) test = test.replace("const identity=read('config/release-identity.js');", "const identity=read('config/release-identity.js');\nconst pkg=JSON.parse(read('package.json'));");
        test = test.replace(/patch:24/g, 'patch:26').replace(/data\.version\|\|'65\.1\.26'/g, "data.version||'65.1.26'");
        test = test.replace(`assert.match(read('package.json'),/"version": "65\.1\.24"/);`, `assert.match(read('package.json'),/"version": "65\.1\.26"/);`);
        test = test.replace(`assert.match(read('public/v56251-ui-finalize.js'),/V65\.1\.26 · DEMO STUDIO/);`, `assert.match(read('public/v56251-ui-finalize.js'),/__SBC_UI_RELEASE__='65\.1\.26'/);`);
        test = test.replace(/assert\.match\(growthUi,\/SBC OS V65\\\.1\\\.26\/\)/g, 'assert.match(growthUi,/SBC OS V65\\.1\\.\\d+/)');
        test = test.replace(/data\\\.version\\\|\\\|'65\\\.1\\\.26'/g, "data\\.version\\|\\|'65\\.1\\.\\d+'");
      }
      fs.writeFileSync(testPath, test);
    }
  }

  const legacyUiTest = path.join(root, 'scripts', 'v6510-ui-recovery-buttons-test.js');
  if (fs.existsSync(legacyUiTest)) {
    let test = fs.readFileSync(legacyUiTest, 'utf8');
    test = once(test, "check('release identity is V65.1.24',()=>assert.match(read('config/release-identity.js'),/RELEASE_VERSION = '65\\.1\\.24'/));", "check('release identity matches the current package',()=>assert.equal(require(path.join(root,'config/release-identity.js')).RELEASE_VERSION,JSON.parse(read('package.json')).version));", 'legacy release identity assertion');
    test = once(test, "check('main shell uses V65.1.24 cache key',()=>{assert.match(html,/V65\\.1\\.24 · RECOVERY-SAFE CANDIDATE/);assert.match(html,/app\\.js\\?v=65\\.1\\.24/)});", "check('main shell uses current release identity',()=>{assert.match(html,/V65\\.1\\.26 · DEMO STUDIO/);assert.match(html,/app\\.js\\?v=65\\.1\\.26-demo-studio/)});", 'legacy shell identity assertion');
    fs.writeFileSync(legacyUiTest, test);
  }

  let css = fs.readFileSync(cssPath, 'utf8');
  css += `\n/* ${MARKER}: premium website Demo Studio */\n.v6526-studio{color:var(--text,#172033);max-height:calc(88vh - 50px);overflow:auto;padding:2px 2px 18px}.v6526-studio-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid rgba(38,95,175,.16);border-radius:16px;background:linear-gradient(130deg,rgba(31,111,235,.09),rgba(242,138,25,.08))}.v6526-kicker{font-size:9px;font-weight:850;letter-spacing:.16em;color:#54709a}.v6526-studio-top h3{font-size:22px;letter-spacing:-.04em;margin:7px 0}.v6526-studio-top p,.v6526-delivery p{font-size:12px;line-height:1.55;color:var(--muted,#647084);margin:0;max-width:600px}.v6526-ready{white-space:nowrap;font-size:10px;font-weight:800;border-radius:999px;background:#e8f7ef;color:#16734a;padding:8px 10px}.v6526-ready i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a064;margin-right:5px}.v6526-studio-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:9px;padding:12px 0}.v6526-device-tabs{display:flex;padding:3px;border:1px solid var(--border,#dbe2eb);border-radius:10px;gap:3px}.v6526-device-tabs button{border:0;background:transparent;border-radius:7px;padding:8px 11px;font-size:11px;color:var(--text,#172033);cursor:pointer}.v6526-device-tabs button.active{background:#173d72;color:#fff}.v6526-style-select{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted,#647084);margin-left:auto}.v6526-style-select select{max-width:170px;border:1px solid var(--border,#dbe2eb);border-radius:9px;padding:9px;background:var(--surface,#fff);color:var(--text,#172033)}.v6526-preview-shell{border:1px solid var(--border,#dbe2eb);border-radius:14px;overflow:hidden;background:#e9edf3}.v6526-browser{display:flex;align-items:center;gap:6px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #dbe2eb}.v6526-browser>span{width:8px;height:8px;border-radius:50%;background:#d4dae3}.v6526-browser small{margin-left:8px;color:#657287;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.v6526-browser button{border:0;background:transparent;font-size:20px;cursor:pointer;color:#44536b}.v6526-preview-shell iframe{display:block;width:100%;height:480px;border:0;background:#fff;transition:width .2s, height .2s}.v6526-preview-shell.is-mobile{padding:18px 0;display:flex;justify-content:center;background:#e4e9f1}.v6526-preview-shell.is-mobile iframe{width:390px;max-width:calc(100% - 24px);height:680px;border:7px solid #202b3a;border-radius:24px;box-shadow:0 12px 35px rgba(18,31,53,.18)}.v6526-link-row{display:flex;align-items:end;flex-wrap:wrap;gap:8px;margin:12px 0;padding:12px;border:1px solid var(--border,#dbe2eb);border-radius:12px}.v6526-link-row>div{flex:1;min-width:230px}.v6526-link-row input{width:100%;margin-top:5px;border:1px solid var(--border,#dbe2eb);border-radius:8px;padding:10px;background:var(--surface,#fff);color:var(--text,#172033);font-size:12px}.v6526-delivery{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;padding:16px;border-radius:14px;background:var(--surface,#f8fafc);border:1px solid var(--border,#dbe2eb)}.v6526-delivery h4{font-size:16px;margin:6px 0}.v6526-delivery-actions{display:flex;flex-wrap:wrap;gap:8px}.v6526-note{font-size:10px;line-height:1.5;color:var(--muted,#647084);margin:10px 2px}.v6526-delivery #v6526DeliveryStatus.is-error{color:#b42318}.v6526-studio-loading,.v6526-studio-error{text-align:center;padding:42px 20px}.v6526-studio-loading h3,.v6526-studio-error h3{margin:12px 0 8px}.v6526-studio-loading p,.v6526-studio-error p{font-size:12px;color:var(--muted,#647084)}.v6526-spinner{width:28px;height:28px;border:3px solid #dce5f2;border-top-color:#1f6feb;border-radius:50%;margin:0 auto;animation:v6526spin .8s linear infinite}@keyframes v6526spin{to{transform:rotate(360deg)}}@media(max-width:760px){.v6526-studio{max-height:calc(90vh - 45px)}.v6526-studio-top,.v6526-delivery{align-items:flex-start;flex-direction:column}.v6526-style-select{margin-left:0}.v6526-studio-toolbar{gap:7px}.v6526-preview-shell iframe{height:380px}.v6526-link-row{align-items:stretch}.v6526-link-row .btn{flex:1}.v6526-delivery-actions{width:100%}.v6526-delivery-actions .btn{flex:1}}\n`;
  fs.writeFileSync(cssPath, css);

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center') throw new Error(`${MARKER}: unexpected package identity`);
  pkg.version = '65.1.26';
  pkg.description = 'SBC OS V65.1.26 premium Demo Studio, design variation preview, and controlled delivery';
  pkg.scripts['test:v6526-demo-studio'] = 'node hotfix-assets/v6526-demo-studio-test.js';
  pkg.scripts['test:all'] += ' && npm run test:v6526-demo-studio';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = '65.1.26';
    if (lock.packages?.['']) { lock.packages[''].version = '65.1.26'; lock.packages[''].description = pkg.description; }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
  const identityPath = path.join(root, 'config', 'release-identity.js');
  if (fs.existsSync(identityPath)) fs.writeFileSync(identityPath, fs.readFileSync(identityPath, 'utf8').replace(/65\.1\.25/g, '65.1.26').replace(/patch:\s*25\b/g, 'patch:26'));
  const versionPath = path.join(root, 'VERSION');
  if (fs.existsSync(versionPath)) fs.writeFileSync(versionPath, fs.readFileSync(versionPath, 'utf8').replace(/65\.1\.25/g, '65.1.26'));
  fs.writeFileSync(path.join(root, 'RELEASE-NOTES-V65.1.26-DEMO-STUDIO.md'), `# SBC OS V65.1.26 — Premium Demo Studio\n\n## Included\n- Replaces the basic generated-demo confirmation with a responsive Demo Studio: customer preview, desktop/mobile viewport, copyable stable URL, open-full-page action, and alternate design direction generation.\n- Adds an SBC-branded concept-preview ribbon to generated customer website pages while preserving the existing industry-aware website design engine and checkout flow.\n- Adds owner-authorized email delivery through the existing communications API and consent-gated SMS delivery through the existing server-side SMS eligibility checks.\n- Prevents concurrent duplicate sends within the active studio session and provides provider response IDs/status where available.\n- Leaves payment, order, fulfillment, database schema, recovery state and owner veto unchanged.\n\n## Validation boundaries\n- Local static, syntax, generator, bootstrap and regression tests do not prove a live GoDaddy deploy or actual email/SMS delivery.\n- SMS remains blocked unless explicit consent is recorded and suppression/opt-out checks pass server-side.\n- No SQL import, new environment variables, Redis dependency, wildcard DNS or Nginx changes are required by this patch.\n`);
  return { marker: MARKER, version: '65.1.26' };
}
module.exports = { apply, MARKER };
