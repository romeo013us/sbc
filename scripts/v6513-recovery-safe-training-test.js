#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const server=read('server.js');
const growthRoute=read('routes/v56240-autonomous-growth-hardening.js');
const app=read('public/app.js');
const browserApp=read('browser_public/app.js');
const shell=read('public/index.html');
const identity=read('config/release-identity.js');
const pkg=JSON.parse(read('package.json'));
const agentOs=read('public/sbc-agent-os-v56-25-3.js');
const growthUi=read('public/v56240-growth-hardening.js');
const training=read('enterprise/training-system-v2.js');
const enterpriseUi=read('public/v32-9-enterprise.js');
const customer360Ui=read('public/v32-2-upgrade.js');
const acquisitionUi=read('public/v33-0-launch-acquisition.js');
const TRAINING_SYSTEM=require('../enterprise/training-system-v2');
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name)}
const api404=server.indexOf("app.use('/api', (req,res,next)=>");
const spaFallback=server.indexOf("app.get('*',(req,res)=>");
const growthRegistration=server.indexOf("registerV56240GrowthHardening(app,");
check('growth status route is registered before final SPA fallback',()=>{
  assert(growthRegistration>0 && spaFallback>growthRegistration,'SPA fallback precedes growth route registration');
  assert(api404>growthRegistration && spaFallback>api404,'API JSON 404 and SPA fallback must be terminal in that order');
  assert.equal((server.match(/app\.get\('\*'/g)||[]).length,1,'expected exactly one SPA fallback');
  assert.match(growthRoute,/app\.get\('\/api\/v56240\/growth\/status',auth,guard/);
});
check('dashboard catalog is normalized before rendering',()=>{
  assert.match(app,/catalogCandidate=state\.data\?\.catalog&&typeof state\.data\.catalog==='object'\?state\.data\.catalog:\{\}/);
  assert.match(app,/packages:Array\.isArray\(catalogCandidate\.packages\)/);
  assert.match(app,/services:Array\.isArray\(catalogCandidate\.services\)/);
  assert.match(browserApp,/catalogCandidate=state\.data\?\.catalog/);
});
check('release identity and visible shell match V65.1.26',()=>{
  assert.match(identity,new RegExp("RELEASE_VERSION = '" + pkg.version.replaceAll('.', '\\.') + "'"));
  assert.match(identity,/patch:26/);
  assert.match(read('package.json'),/"version": "65\.1\.26"/);
  assert.match(shell,/V65\.1\.26 · DEMO STUDIO/);
  assert.match(shell,/app\.js\?v=65\.1\.26-demo-studio/);
  assert.match(read('public/v56251-ui-finalize.js'),/V65\.1\.26 · DEMO STUDIO/);
  assert.match(agentOs,/data\.version\|\|'65\.1\.\d+'/);
  assert.match(growthUi,/SBC OS V65\.1\.\d+/);
});
check('recovery-mode Training GET uses detached read-only catalog and never saves',()=>{
  assert.match(server,/const recoveryReadOnly=Boolean\(MYSQL_RECOVERY_REQUIRED\);[\s\S]*const sourceDb=recoveryReadOnly\?\{\.\.\.db,settings:\{\.\.\.\(db\.settings\|\|\{\}\),trainingCenterV2:/);
  assert.match(server,/if\(!recoveryReadOnly && \(repairedTraining\.changed \|\| s\.assignments\.length!==before \|\| s\.courses\.length!==beforeCourses\)\) await TRAINING_SYSTEM\.saveState/);
  assert.match(server,/recoveryRequired:true,readOnly:true,message:'Recovery lock active\. Training content is available for viewing/);
  assert.match(training,/const LEGACY_IMPORTED_COURSES = \[/);
});
check('built-in Academy catalog is visible from an isolated recovery snapshot without changing source DB',()=>{
  const original={settings:{trainingCenterV2:{schemaVersion:2,courses:[],assignments:[],progress:[],attempts:[],certifications:[],reviews:[],events:[],notes:[],sessions:[]}},users:[{id:'owner-test',name:'Owner',role:'owner',active:true}]};
  const snapshot={...original,settings:{...original.settings,trainingCenterV2:JSON.parse(JSON.stringify(original.settings.trainingCenterV2))},users:original.users};
  const repaired=TRAINING_SYSTEM.repairCourseCatalog(snapshot);
  TRAINING_SYSTEM.ensureAssignmentsForWorkforce(snapshot,repaired.state);
  const userData=TRAINING_SYSTEM.getForUser(snapshot,original.users[0]);
  assert(repaired.state.courses.length>0,'built-in course catalog should be present');
  assert(userData.available.length>0||userData.assigned.length>0,'owner should see courses');
  assert.equal(original.settings.trainingCenterV2.courses.length,0,'read-only recovery snapshot must not mutate source DB');
});
check('enterprise panel reports actual failure rather than falsely blaming workforce authentication',()=>{
  assert.match(enterpriseUi,/Enterprise status request failed:/);
  assert.doesNotMatch(enterpriseUi,/catch\(e\)\{msg\.textContent='Enterprise panel is available after workforce authentication\.'/);
});
check('acquisition summary exposes recovery read-only state',()=>{
  assert.match(server,/app\.get\('\/api\/kim\/v330\/summary',[\s\S]*recoveryRequired:Boolean\(MYSQL_RECOVERY_REQUIRED\),readOnly:Boolean\(MYSQL_RECOVERY_REQUIRED\)/);
  assert.match(acquisitionUi,/d\.recoveryRequired/);
});
check('v9 bootstrap is read-only during recovery and does not normalize or save live records',()=>{
  const route=server.slice(server.indexOf("app.get('/api/v9/bootstrap'"),server.indexOf("const trainingAdmin=role=>"));
  assert.match(route,/const recoveryReadOnly=Boolean\(MYSQL_RECOVERY_REQUIRED\)/);
  assert.match(route,/if\(!recoveryReadOnly\) \(db\.customers\|\|\[\]\)\.forEach\(normalizeLeadQuality\)/);
  assert.match(route,/const trainingDb=recoveryReadOnly\?\{\.\.\.db,settings:/);
  assert.match(route,/if\(!recoveryReadOnly && \(repairedTraining\.changed/);
  assert.match(route,/recoveryRequired:recoveryReadOnly,readOnly:recoveryReadOnly/);
});
check('Customer 360 supports legacy snake_case fields and keeps editing disabled during recovery',()=>{
  assert.match(customer360Ui,/contact_name/);
  assert.match(customer360Ui,/business_name/);
  assert.match(customer360Ui,/customer_id/);
  assert.match(customer360Ui,/RECOVERY LOCK ACTIVE — READ ONLY/);
  assert.match(customer360Ui,/Edit Customer — Locked/);
});
console.log(`\nSBC V65.1.26 recovery-safe training/enterprise regression: ${checks.length}/9 passed`);
