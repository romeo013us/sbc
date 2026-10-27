'use strict';
const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'..');
const required=['enterprise/sbc-god-tier-event-fabric-v600.js','enterprise/sbc-god-tier-resilience-v600.js','enterprise/sbc-god-tier-slo-v600.js','migrations/20261007_001_v600_god_tier_foundation.sql'];
const failures=[];const checks=[];
for(const f of required){const ok=fs.existsSync(path.join(root,f));checks.push({check:`required:${f}`,ok});if(!ok)failures.push(f);}
for(const f of ['enterprise/sbc-god-tier-event-fabric-v600.js','enterprise/sbc-god-tier-resilience-v600.js','enterprise/sbc-god-tier-slo-v600.js']){try{new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});checks.push({check:`syntax:${f}`,ok:true});}catch(e){checks.push({check:`syntax:${f}`,ok:false,error:e.message});failures.push(f);}}
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
for(const needle of ["BUILD_VERSION = RELEASE_VERSION","sbc-god-tier-event-fabric-v600","/api/god-tier/health","SBC GOD-TIER V60.1","checkout.received"]){const ok=server.includes(needle);checks.push({check:`server:${needle}`,ok});if(!ok)failures.push(needle);}
const migration=fs.readFileSync(path.join(root,'migrations/20261007_001_v600_god_tier_foundation.sql'),'utf8')+'\n'+fs.readFileSync(path.join(root,'migrations/20261007_002_v601_god_tier_integrity.sql'),'utf8');
const releaseIdentity=fs.readFileSync(path.join(root,'enterprise/v567-nine-nine.js'),'utf8');
for(const needle of ["ACTIVE_PACKAGE_RELEASE='60.4.5'","'60.0.0'"]){const ok=releaseIdentity.includes(needle);checks.push({check:`release-identity:${needle}`,ok});if(!ok)failures.push(needle);}
for(const needle of ['sbc_god_events','sbc_god_event_dead_letters','sbc_slo_evidence','sbc_god_event_ledger','uq_god_event_idem','uq_god_ledger_event','uq_god_ledger_idem']){const ok=migration.includes(needle);checks.push({check:`migration:${needle}`,ok});if(!ok)failures.push(needle);}
const result={ok:failures.length===0,version:'60.4.5',checks,failures,checkedAt:new Date().toISOString()};console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
