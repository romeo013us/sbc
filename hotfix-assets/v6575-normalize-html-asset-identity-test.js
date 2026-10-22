'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6575-normalize-html-asset-identity');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6575-assets-'));
try{
 const pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
 fs.writeFileSync(path.join(pub,'index.html'),'<link href="/a.css?v=65.1.61"><script src="/b.js?x=1&v=65.1.61"></script><script src="/old.js?v=65.1.67"></script>');
 const result=patch.apply(root);
 const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
 assert.deepEqual(result.changed,['public/index.html']);
 assert.match(html,/a\.css\?v=66\.0\.0/);
 assert.match(html,/b\.js\?x=1&v=66\.0\.0/);
 assert.match(html,/old\.js\?v=65\.1\.67/);
 assert.doesNotMatch(html,/[?&]v=65\.1\.61/);
 console.log('[SBC V6575] PASS: targeted stale HTML asset token normalized; unrelated historical tags preserved.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
