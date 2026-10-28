'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6601-master-prospect-list');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-no-public-prospects-'));
try{
 const publicDir=path.join(root,'public');fs.mkdirSync(publicDir,{recursive:true});
 const ui=path.join(publicDir,'sbc-lead-import-v6541.js');
 fs.writeFileSync(ui,'// owner CSV uploader remains available\\n');
 const result=patch.apply(root);
 assert.equal(result.marker,patch.MARKER);
 assert.equal(result.rows,0);
 assert.equal(result.crmWrites,false);
 assert.equal(result.autoImport,false);
 assert.equal(result.publicProspectExportDisabled,true);
 assert(!fs.existsSync(path.join(publicDir,patch.CSV_NAME)),'no downloadable prospect CSV can be installed');
 fs.writeFileSync(path.join(publicDir,patch.CSV_NAME),'PRIVATE_TEST_DATA_NOT_REAL');
 assert.throws(()=>patch.apply(root),/refuse pre-existing public prospect CSV/);
 console.log('[SBC V6601] PASS no public prospect CSV, authenticated manual upload preserved');
}finally{fs.rmSync(root,{recursive:true,force:true});}
