'use strict';
/* Production overlay safety: only the known legacy diagnostic payload may be
 * removed, and the cleanup must not follow symlinks or touch other files.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {removeLegacyDiagnosticFiles}=require('../enterprise/v66131-close-legacy-diag.cjs');
const fixture="<!doctype html><html><body><button data-view=\"dashboard\" id=\"b\">Dash</button><div id=\"content\"></div><div id=\"login\"></div><div id=\"app\"></div><div id=\"toast\"></div><div id=\"modal\"><div id=\"modalTitle\"></div><div id=\"modalBody\"></div></div><script src=\"/app.js\"></script><script>setTimeout(()=>{document.body.insertAdjacentHTML('beforeend','<pre id=\"diag\">'+JSON.stringify({render:typeof window.render,nav:typeof window.sbcNavigate,bind:typeof window.sbcBindPrimaryNav,err:window.__err||null},null,2)+'</pre>')},1000);window.addEventListener('error',e=>window.__err=e.message)</script></body></html>";
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-diag-'));
try {
 for(const dir of ['public','browser_public'])fs.mkdirSync(path.join(root,dir));
 const first=path.join(root,'public/diag2.html');
 const second=path.join(root,'browser_public/diag2.html');
 const keep=path.join(root,'public/app.js');
 fs.writeFileSync(first,fixture);
 fs.writeFileSync(second,fixture);
 fs.writeFileSync(keep,'const APP_UNCHANGED = true;');
 let result=removeLegacyDiagnosticFiles(root);
 assert.deepEqual(result.removed.sort(),['browser_public/diag2.html','public/diag2.html']);
 assert.equal(result.retained.length,0);
 assert.equal(fs.existsSync(first),false);
 assert.equal(fs.existsSync(second),false);
 assert.equal(fs.readFileSync(keep,'utf8'),'const APP_UNCHANGED = true;');
 result=removeLegacyDiagnosticFiles(root);
 assert.deepEqual(result.removed,[],'must be idempotent');
 fs.writeFileSync(first,'Customer data that must not be removed.');
 result=removeLegacyDiagnosticFiles(root);
 assert.deepEqual(result.removed,[]);
 assert.deepEqual(result.retained,['public/diag2.html']);
 assert.equal(fs.readFileSync(first,'utf8'),'Customer data that must not be removed.');
 fs.unlinkSync(first);
 fs.symlinkSync(keep,first);
 result=removeLegacyDiagnosticFiles(root);
 assert.deepEqual(result.removed,[],'symlinks cannot be deleted by cleanup');
 assert.deepEqual(result.retained,['public/diag2.html']);
 assert.equal(fs.readFileSync(keep,'utf8'),'const APP_UNCHANGED = true;');
}finally{fs.rmSync(root,{recursive:true,force:true});}
for(const rel of ['public/diag2.html','browser_public/diag2.html']){
 assert.equal(fs.existsSync(path.join(__dirname,'..',rel)),false,'legacy diagnostic source must not ship: '+rel);
}
const entry=fs.readFileSync(path.join(__dirname,'../sbc-godaddy-flat-entrypoint.cjs'),'utf8');
assert.match(entry,/removeLegacyDiagnosticFiles\(root\)/,'Published startup must clean old extract-without-cleanup overlays');
console.log('[SBC DIAGNOSTIC CLOSURE] PASS: only legacy files purged; symlink safe, idempotent and source removed');
