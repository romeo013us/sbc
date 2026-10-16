'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6550-remove-floating-ask-kim');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6550-kim-'));
function put(rel,value){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value);}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
try{
 const canonical=[
  "function ensure(){",
  "document.querySelectorAll(",
  "'#sbcKimLauncher,#v56KimDrawer,.akx-launcher,.sbc-kim-bottom-launcher,' +",
  "function open(prefill){const d=ensure();restore(d);d.classList.remove('hidden');d.hidden=false;d.style.display='flex';d.setAttribute('aria-hidden','false');const l=$('#ckLauncher');if(l)l.classList.add('hidden');context();",
  "function close(){const d=dock();if(!d)return;d.classList.add('hidden');d.hidden=true;d.style.display='none';d.setAttribute('aria-hidden','true');$('#ckLauncher')?.classList.remove('hidden')}",
  "function killLegacyKim(){",
  "  document.querySelectorAll('#v56KimDrawer,.v56-kim-drawer,[data-v56-kim],[data-kim-legacy]').forEach(x=>x.remove());",
  "}",
  "restore(d);if(!$('#ckLauncher')){const b=document.createElement('button');b.id='ckLauncher';b.className='ck-launcher';b.type='button';b.innerHTML='<span class=\"orb\">✦</span><span><small>ASK KIM</small><strong>Open Chief of Staff</strong></span>';document.body.appendChild(b);b.onclick=()=>open()}",
  "window.openSbcAI=open;window.closeSbcAI=close;"
 ].join('\n');
 put('public/sbc-kim-canonical-v6424.js',canonical);
 put('public/index.html','<html><head><title>V65.1.48</title><script src="/app.js?v=65.1.13-recovery-authfix"></script></head><body></body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-47-import-contract';\nkeys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.48',description:'old',scripts:{'test:all':'node bootstrap.js --verify'}},null,2));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.48',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.48'}}},null,2));
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.48'; const RELEASE_NAME = 'LORNA_LEAST_PRIVILEGE'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:48});");
 put('browser_public/app.js',"const EXPECTED_RELEASE_VERSION = '65.1.48';");
 put('server.js',"const guard='MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED';");
 put('VERSION','65.1.48');
 const result=patch.apply(root);
 assert.equal(result.version,'65.1.49');
 const kim=get('public/sbc-kim-canonical-v6424.js');
 assert.ok(!kim.includes("b.id='ckLauncher'"),'must not create the floating launcher');
 assert.ok(!kim.includes("$('#ckLauncher')?.classList.remove"),'close must not resurrect launcher');
 assert.ok(kim.includes("window.openSbcAI=open"),'in-page Ask Kim bridge must remain');
 assert.ok(kim.includes('#ckLauncher,.ck-launcher,#kimGreatnessFab,.akx-launcher'),'legacy launcher cleanup must remain active');
 const html=get('public/index.html');
 assert.match(html,/sbc-no-floating-ask-kim-v6550/);
 assert.match(html,/65\.1\.49-kim-launcher-removed/);
 assert.ok(!html.includes('65.1.13-recovery-authfix'));
 assert.match(get('public/sw.js'),/sbc-static-v65-1-49-kim-launcher-removed/);
 const pkg=JSON.parse(get('package.json')),lock=JSON.parse(get('package-lock.json'));
 assert.equal(pkg.version,'65.1.49');assert.equal(lock.version,'65.1.49');assert.equal(lock.packages[''].version,'65.1.49');
 assert.match(pkg.scripts['test:all'],/v6550-remove-floating-ask-kim-test\.js/);
 assert.match(get('config/release-identity.js'),/REMOVE_FLOATING_ASK_KIM/);
 assert.match(get('browser_public/app.js'),/65\.1\.49/);
 assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);
 assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.49] floating Ask Kim launcher removal regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
