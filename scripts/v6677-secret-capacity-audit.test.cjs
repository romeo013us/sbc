'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {parseNames,audit,collectCode,runCli}=require('./v6677-secret-capacity-audit.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6677-'));
try {
  fs.writeFileSync(path.join(root,'server.js'),"const x = process.env.SBC_AI_TIMEOUT_MS; const v = process.env.SBC_WEBSITE_BRIDGE_KEY;");
  fs.mkdirSync(path.join(root,'public'));
  fs.writeFileSync(path.join(root,'public','app.js'),"const TWILIO_AUTH_TOKEN='not a credential';");
  const namesFile=path.join(root,'names.txt');
  fs.writeFileSync(namesFile,'# names only\nSBC_AI_TIMEOUT_MS\nSBC_WEBSITE_BRIDGE_KEY\nDB_PASSWORD\nSBC_AI_TIMEOUT_MS\n');
  assert.throws(()=>parseNames('DB_PASSWORD=private-secret'),/invalid entry/);
  assert.equal(parseNames(fs.readFileSync(namesFile,'utf8')).duplicateCount,1);
  assert.deepEqual(collectCode(root).map(x=>path.basename(x)),['server.js']);
  for(let pass=1;pass<=3;pass++) {
    const report=audit({names:parseNames(fs.readFileSync(namesFile,'utf8')).names,runtime:root,variant:'preview'});
    assert.equal(report.declaredUniqueNames,3);
    assert.equal(report.websiteBridgeKeyNamePresent,true);
    assert.equal(report.configurationMigrationCandidates.find(x=>x.name==='SBC_AI_TIMEOUT_MS').sourceReferences[0],'server.js');
    assert.equal(report.configurationMigrationCandidates.find(x=>x.name==='SBC_SMTP_PORT').present,false);
    assert(report.protectionsPresent.includes('DB_PASSWORD'));
    assert(!JSON.stringify(report).includes('private-secret'));
    assert.equal(audit({names:Array.from({length:55},(_,i)=>'SBC_TEST_'+i),runtime:root}).exceedsLimit,true);
    console.log('[SBC V6677] PASS '+pass+'/3 capacity, references, nonmutation and secret-value exclusion');
  }
  const report=runCli(['--names-file='+namesFile,'--runtime='+root,'--variant=publish']);
  assert.equal(report.variant,'publish');
} finally {fs.rmSync(root,{recursive:true,force:true});}
