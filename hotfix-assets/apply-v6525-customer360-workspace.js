'use strict';
const fs = require('fs');
const path = require('path');
const MARKER = 'SBC_V6525_CUSTOMER360_WORKSPACE';
function once(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${MARKER}: ${label} anchor count ${count}`);
  return source.replace(oldText, newText);
}
function apply(root) {
  const publicDir = path.join(root, 'public');
  const indexPath = path.join(publicDir, 'index.html');
  const cssPath = path.join(publicDir, 'sbc-command-center-ui-v56-25-3.css');
  const appPath = path.join(publicDir, 'app.js');
  for (const f of [indexPath, cssPath, appPath]) if (!fs.existsSync(f)) throw new Error(`${MARKER}: missing ${path.relative(root, f)}`);

  const moduleSourcePath = path.join(__dirname, 'customer360-workspace-v6525.js');
  if (!fs.existsSync(moduleSourcePath)) throw new Error(`${MARKER}: missing action module source`);
  const modulePath = path.join(publicDir, 'sbc-customer360-workspace-v6525.js');
  fs.copyFileSync(moduleSourcePath, modulePath);

  let index = fs.readFileSync(indexPath, 'utf8');
  if (!index.includes('/sbc-customer360-workspace-v6525.js')) {
    index = once(index, '</body>', '<script src="/sbc-customer360-workspace-v6525.js?v=65.1.25-customer360"></script>\n</body>', 'index script insertion');
  }
  index = index.replace(/V65\.1\.23/g, 'V65.1.25').replace(/65\.1\.23-recovery-authfix/g, '65.1.25-customer360').replace(/65\.1\.24-single-writer/g, '65.1.25-customer360');
  index = index.replace('V65.1.25 · RECOVERY-SAFE CANDIDATE', 'V65.1.25 · CUSTOMER 360 WORKSPACE');
  fs.writeFileSync(indexPath, index);

  let css = fs.readFileSync(cssPath, 'utf8');
  css = once(css, '#sbc-lead-workspace-launcher{position:fixed;left:18px;bottom:22px;', '#sbc-lead-workspace-launcher{position:fixed;right:18px;left:auto;bottom:22px;', 'launcher position');
  css = once(css,
    '@media(max-width:760px){#sbc-lead-workspace .slw-body{grid-template-columns:1fr;padding:10px;gap:10px}#sbc-lead-workspace .slw-header{padding:14px}#sbc-lead-workspace .slw-table-wrap{max-height:32vh}#sbc-lead-workspace .slw-form{grid-template-columns:1fr}#sbc-lead-workspace .slw-form .slw-wide{grid-column:auto}#sbc-lead-workspace-launcher{left:10px;bottom:10px}}',
    '@media(max-width:760px){#sbc-lead-workspace .slw-body{grid-template-columns:1fr;padding:10px;gap:10px}#sbc-lead-workspace .slw-header{padding:14px}#sbc-lead-workspace .slw-table-wrap{max-height:32vh}#sbc-lead-workspace .slw-form{grid-template-columns:1fr}#sbc-lead-workspace .slw-form .slw-wide{grid-column:auto}#sbc-lead-workspace-launcher{right:10px;left:auto;bottom:10px}}',
    'mobile launcher position');
  css += `\n/* ${MARKER}: customer action strip + fast checkout chooser */\n.v6525-customer-actions{display:flex;flex-wrap:wrap;gap:8px;padding:12px;margin:14px 0;border:1px solid rgba(31,111,235,.18);border-radius:12px;background:var(--sbc-card,#f7faff)}.v6525-customer-actions .btn{white-space:normal}.v6525-checkout-list{display:grid;gap:8px;margin:14px 0}.v6525-checkout-list .list-card{gap:12px;align-items:center;flex-wrap:wrap}.v6525-checkout-list .actions{flex-wrap:wrap}.v6525-consent{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:9px;margin:12px 0;font-size:13px}.v6525-consent input{margin-top:3px;flex:0 0 auto}\n`;
  fs.writeFileSync(cssPath, css);

  let app = fs.readFileSync(appPath, 'utf8');
  app = app.replace('65.1.23-webhook-evidence-guard', '65.1.25-customer360');
  if (!app.includes('65.1.25-customer360')) throw new Error(`${MARKER}: client cache version not updated`);
  if (!app.includes('openCustomer360Safe=async function')) throw new Error(`${MARKER}: expected CRM entry point missing`);
  fs.writeFileSync(appPath, app);

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center') throw new Error(`${MARKER}: unexpected package identity`);
  pkg.version = '65.1.25';
  pkg.description = 'SBC OS V65.1.25 Customer 360 action workspace and Lead Workspace launcher correction';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const versionPath = path.join(root, 'VERSION');
  if (fs.existsSync(versionPath)) fs.writeFileSync(versionPath, fs.readFileSync(versionPath, 'utf8').replace(/65\.1\.24/g, '65.1.25'));
  const identityPath = path.join(root, 'config', 'release-identity.js');
  if (fs.existsSync(identityPath)) fs.writeFileSync(identityPath, fs.readFileSync(identityPath, 'utf8').replace(/65\.1\.24/g, '65.1.25').replace(/patch:\s*24\b/g, 'patch:25'));
  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = '65.1.25';
    if (lock.packages?.['']) { lock.packages[''].version = '65.1.25'; lock.packages[''].description = pkg.description; }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
  const notesPath = path.join(root, 'RELEASE-NOTES-V65.1.25-CUSTOMER360.md');
  fs.writeFileSync(notesPath, `# SBC OS V65.1.25 — Customer 360 action workspace\n\n## UI changes\n- Customer 360 is the primary CRM customer click-through instead of the legacy two-action modal.\n- Adds SBC business calling, email composer, SMS composer, quote/cart builder, fast-checkout quote selection, appointment, and activity actions when supported by the existing app.\n- Checkout links can be sent only from an existing quote with a valid HTTPS payment URL and after an explicit consent confirmation.\n- Paid/won/completed quotes cannot be sent for a second charge.\n- Recovery/read-only mode disables outreach, quote/cart, checkout, demo and refund actions.\n- Keeps existing demo/refund actions, with refund still owner-governed.\n- Moves the Lead Workspace launcher from the lower-left sidebar/sign-out area to the lower-right corner on desktop and mobile.\n\n## Test limits\n- This patch changes UI routing and presentation only; it does not change payment state, recovery gates, or database data.\n- Local static and regression checks do not prove GoDaddy deployment or live Square checkout.\n`);
  return { marker: MARKER, version: '65.1.25' };
}
module.exports = { apply, MARKER };
