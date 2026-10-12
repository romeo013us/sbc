'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {test}=require('node:test');
const sourceRoot=path.resolve(__dirname,'..');

if(fs.existsSync(path.join(sourceRoot,'server.js'))){
  test('patched source gates Preview and permits one configured writer',()=>{
    const s=fs.readFileSync(path.join(sourceRoot,'server.js'),'utf8');
    assert.match(s,/SBC_RUNTIME_ROLE \|\| 'readonly'/);
    assert.match(s,/SBC_READ_ONLY_RUNTIME/);
    assert.match(s,/SBC_RUNTIME_READ_ONLY\)\{return \{skipped:true/);
    assert.match(s,/runtime role=readonly; read-only MySQL hydration complete/);
    assert.match(s,/runtime role=writer; this Published runtime owns MySQL mutations/);
    assert.match(s,/autonomous sweep and all background mutation timers skipped/);
    assert.match(s,/background workers and WebSockets not started/);
  });
}else{
  const patch=require('./apply-v6524-single-writer');
  test('single-writer patch is fail-closed and keeps Preview read-only',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6524-'));
    try{
      fs.mkdirSync(path.join(dir,'enterprise'),{recursive:true});
      fs.mkdirSync(path.join(dir,'config'),{recursive:true});
      fs.mkdirSync(path.join(dir,'scripts'),{recursive:true});
      fs.mkdirSync(path.join(dir,'hotfix-assets'),{recursive:true});
      fs.writeFileSync(path.join(dir,'server.js'),`let mysqlPool = null;\nlet db = {};\nconst app = express();\napp.use(createRecoveryWriteGuard({isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED}));\nasync function initMysql(){\n    await RUNTIME_GATE.ensureSchema();\n}\nasync function saveData(){\n  // V65.1.11: startup workers must not write while MySQL's recovery state is unknown.\n}\ninitMysql().then(async()=>{SBC_UNATTENDED_NOTIFICATIONS.start();\n}).then(async()=>{if(MYSQL_RECOVERY_REQUIRED){console.warn('[SBC RECOVERY GUARD] runtime is in safe recovery mode; background automation, revenue, Kim missions, and mutation workers remain suspended until authoritative MySQL restore.');return;}\nconst startOperationalRuntime=async()=>{console.log('runtime started');\n`);
      fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'sbc-business-command-center',version:'65.1.23',scripts:{'test:all':'node test.js'}},null,2));
      fs.writeFileSync(path.join(dir,'package-lock.json'),JSON.stringify({version:'65.1.23',packages:{'':{version:'65.1.23'}}},null,2));
      fs.writeFileSync(path.join(dir,'VERSION'),'65.1.23');
      fs.writeFileSync(path.join(dir,'config/release-identity.js'),"module.exports={RELEASE_VERSION:'65.1.23',patch:23};\n");
      patch.apply(dir);
      const s=fs.readFileSync(path.join(dir,'server.js'),'utf8');
      assert.match(s,/SBC_RUNTIME_ROLE \|\| 'readonly'/);
      assert.match(s,/SBC_READ_ONLY_RUNTIME/);
      assert.match(s,/SBC_RUNTIME_READ_ONLY\)\{return \{skipped:true/);
      assert.match(s,/runtime role=readonly; read-only MySQL hydration complete/);
      assert.match(s,/runtime role=writer; this Published runtime owns MySQL mutations/);
      assert.match(s,/autonomous sweep and all background mutation timers skipped/);
      assert.match(s,/background workers and WebSockets not started/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'package.json'))).version,'65.1.24');
      const markerCount=(s.match(/SBC_V6524_SINGLE_WRITER_PREVIEW/g)||[]).length;
      patch.apply(dir);
      assert.equal((fs.readFileSync(path.join(dir,'server.js'),'utf8').match(/SBC_V6524_SINGLE_WRITER_PREVIEW/g)||[]).length,markerCount,'server patch remains idempotent');
    }finally{fs.rmSync(dir,{recursive:true,force:true})}
  });
}
