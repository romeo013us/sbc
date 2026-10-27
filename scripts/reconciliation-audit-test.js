#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-reconcile-'));
try{
 const dump=path.join(tmp,'fixture.sql');fs.writeFileSync(dump,[
  "CREATE TABLE `sbc_customers` (`id` varchar(80), `business_name` varchar(255), `contact_name` varchar(255), `phone` varchar(80), `email` varchar(255), `source` varchar(100), `tenant_id` bigint);",
  "INSERT INTO `sbc_customers` (`id`,`business_name`,`contact_name`,`phone`,`email`,`source`,`tenant_id`) VALUES ('c-1','Benny Figaro Barbershop','Benito Cabrera','1 305-934-0651','','test',1),('c-2','Other Shop','','','','test',1);",
  "CREATE TABLE `sbc_lead_mesh` (`id` bigint, `business_name` varchar(255), `contact_name` varchar(255), `email` varchar(320), `phone` varchar(80), `source` varchar(255));",
  "INSERT INTO `sbc_lead_mesh` (`id`,`business_name`,`contact_name`,`email`,`phone`,`source`) VALUES (1,'Benny Figaro Barbershop','Benito Cabrera','','1 305-934-0651','worksheet');"
 ].join('\n'));
 const run=spawnSync(process.execPath,[path.join(root,'scripts/diff-leads-reconciliation.js'),dump],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(run.stdout);assert.equal(report.tables.sbc_customers.parsedRows,2);assert.equal(report.tables.sbc_lead_mesh.parsedRows,1);assert.equal(report.readOnly,true);assert.ok(report.customerTableCandidateMatches>=1);assert.ok(report.leadMeshCandidateMatches>=1);assert.equal(report.claimedFiveRecordAudit.length,5);assert.ok(report.claimedFiveRecordAudit.every(c=>c.assessment==='CLAIMED_NAME_NOT_FOUND_IN_NAMED_SOURCE_CSV'));assert.ok(!('sqlPatch' in report));
 console.log('SBC V65.1.26 reconciliation audit tests: PASS (SQL tuple parsing, candidate matching, unverified-claim handling, read-only output)');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
