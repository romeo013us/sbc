'use strict';
// SBC persistent state for the root launcher.
//
// PROBLEM THIS SOLVES: bootstrap.js extracts the source ZIP into a folder named by the ZIP's hash
// (.sbc-runtime-v<version>-<hash>) and server.js writes live state under <that folder>/data and /backups.
// Every NEW release ZIP therefore started with an EMPTY data folder, silently orphaning recovery snapshots,
// Kim/automation state files and backups.
//
// FIX: keep `data` and `backups` in ONE permanent folder outside every runtime folder and link them in.
const fs = require('fs');
const path = require('path');

const PERSIST_DIRS = ['data', 'backups'];
// Files shipped WITH a release that must always come from the new release (never from old live state).
const RELEASE_OWNED = new Set(['data/sbc-integrity-manifest.json']);

function isRealDir(p) { try { const s = fs.lstatSync(p); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; } }
function exists(p) { try { fs.lstatSync(p); return true; } catch { return false; } }

function copyMissing(src, dest) {            // never overwrites existing live files
  if (!isRealDir(src) && !(exists(src) && fs.statSync(src).isDirectory())) return;
  fs.cpSync(src, dest, { recursive: true, force: false, errorOnExist: false, dereference: false });
}

function previousRuntimes(baseDir, currentRuntimeDir) {
  const cur = path.resolve(currentRuntimeDir);
  return fs.readdirSync(baseDir).filter(n => n.startsWith('.sbc-runtime-')).map(n => path.join(baseDir, n))
    .filter(p => path.resolve(p) !== cur && isRealDir(p))
    .map(p => { let t = 0; try { t = fs.statSync(path.join(p, '.sbc-bootstrap-ready.json')).mtimeMs; } catch { try { t = fs.statSync(p).mtimeMs; } catch {} } return { p, t }; })
    .sort((a, b) => b.t - a.t).map(x => x.p);
}

/**
 * @param baseDir     folder containing bootstrap.js
 * @param runtimeDir  the hashed runtime folder about to be launched
 * @param opts.reused true when runtimeDir already existed and has been running (its data/ is LIVE)
 */
function persistState(baseDir, runtimeDir, opts = {}) {
  const log = opts.log || console;
  const root = path.resolve(process.env.SBC_PERSIST_DIR || path.join(baseDir, 'sbc-persistent'));
  const report = { root, linked: [], seeded: [], ephemeral: false };
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
    for (const name of PERSIST_DIRS) {
      const target = path.join(root, name);
      const linkPath = path.join(runtimeDir, name);
      const firstTime = !exists(target);
      if (firstTime) {
        fs.mkdirSync(target, { recursive: true });
        // Seed order: (1) a reused runtime holds LIVE state; (2) otherwise the newest previous runtime's live state.
        let seedFrom = null;
        if (opts.reused && isRealDir(linkPath)) seedFrom = linkPath;
        else for (const prev of previousRuntimes(baseDir, runtimeDir)) { const c = path.join(prev, name); if (isRealDir(c)) { seedFrom = c; break; } }
        if (seedFrom) { copyMissing(seedFrom, target); report.seeded.push(`${name} <- ${path.relative(baseDir, seedFrom)}`); }
      }
      // Shipped defaults: add files that are new in this release, without touching live files.
      if (isRealDir(linkPath)) {
        copyMissing(linkPath, target);
        for (const rel of RELEASE_OWNED) {
          if (!rel.startsWith(name + '/')) continue;
          const shipped = path.join(runtimeDir, rel);
          if (isRealDir(path.dirname(shipped)) && exists(shipped)) fs.copyFileSync(shipped, path.join(root, rel));
        }
      }
      // (Re)link runtime/<name> -> persistent/<name>
      let ok = false;
      try { ok = fs.lstatSync(linkPath).isSymbolicLink() && path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath)) === path.resolve(target); } catch {}
      if (!ok) {
        fs.rmSync(linkPath, { recursive: true, force: true });   // removes a symlink itself; never follows it
        fs.symlinkSync(target, linkPath, 'dir');
      }
      report.linked.push(name);
    }
    log.log(`[SBC PERSIST] state folders linked to ${root}: ${report.linked.join(', ')}${report.seeded.length ? ' | seeded: ' + report.seeded.join('; ') : ''}`);
    return report;
  } catch (err) {
    if (process.env.SBC_ALLOW_EPHEMERAL_DATA === '1') {
      report.ephemeral = true;
      log.warn(`[SBC PERSIST] WARNING: could not make state persistent (${err.message}). Continuing EPHEMERAL because SBC_ALLOW_EPHEMERAL_DATA=1. State will be lost on the next release.`);
      return report;
    }
    throw new Error(`Persistent state setup failed (${err.message}). Refusing to start with throw-away data. Fix the folder permissions, or set SBC_ALLOW_EPHEMERAL_DATA=1 to override knowingly.`);
  }
}
module.exports = { persistState, PERSIST_DIRS, RELEASE_OWNED };
