'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6530-writer-lease-marker-fix'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6530-test-'));
try{
 const source="// SBC_V6528_RUNTIME_WRITER_LEASE\nconsole.log('['+MARKER+'] process writer lease acquired');\nconsole.error('['+MARKER+'] writer lease lost');\nconsole.warn('['+MARKER+'] no writer lease');\n";
 fs.writeFileSync(path.join(root,'server.js'),source);const result=patch.apply(root);const out=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.equal(result.repairedMarkerReferences,3);assert.equal(out.includes("'['+MARKER+']"),false);
 assert.ok(out.includes("'[SBC_V6528_RUNTIME_WRITER_LEASE] process writer lease acquired'"));
 assert.ok(out.includes("'[SBC_V6528_RUNTIME_WRITER_LEASE] writer lease lost'"));
 assert.ok(out.includes("'[SBC_V6528_RUNTIME_WRITER_LEASE] no writer lease'"));
 console.log('[SBC V65.1.30] writer-lease marker regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
