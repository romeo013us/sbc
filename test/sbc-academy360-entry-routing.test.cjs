'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('Legacy caller workstation does not impersonate the Account Manager training role',()=>{
 const html=read('public/sales-caller.html'),js=read('public/sales-caller.js');
 assert.match(html,/>Legacy Sales Caller Workspace</);
 assert.match(js,/result\.role==='caller'\?'Legacy Sales Caller'/);
 assert.doesNotMatch(js,/result\.role==='caller'\?'Account Manager'/);
 assert.doesNotMatch(html,/Legacy caller training — not Academy 360|Legacy SBC Academy/);
 assert.match(html,/src="\/sbc-academy360-employee-training\.html"/);
 assert.doesNotMatch(html,/href="\/sbc-am-academy\.html"/);
 for(const file of ['sales-caller.html','sales-caller.js'])
  assert.equal(read('public/'+file),read('browser_public/'+file),file+' mirrored');
});
test('A verified account_manager entering the old caller desk is returned to the real AM workstation with inline Academy 360',()=>{
 const js=read('public/sales-caller.js');
 assert.match(js,/me\?\.role==='account_manager'&&!preview\)\{location\.replace\('\/sbc-account-manager-v1\.html'\);return;\}/);
 assert.match(js,/if\(!preview&&me\?\.role!=='caller'\)throw Error/);
});
test('Real Account Manager desk links directly to the multimedia Academy and preserves independent certification',()=>{
 const html=read('public/sbc-account-manager-v1.html'),academy=read('public/sbc-am-academy.html');
 assert.match(html,/data-view="academy"/);
 assert.match(html,/src="\/sbc-am-academy\.html"/);
 assert.match(academy,/<video id="academyRecording"/);
 assert.match(academy,/<audio id="academyAudioRecording"/);
 assert.match(academy,/id="academyPhotoGallery"/);
 assert.match(academy,/id="academyMediaRewind"/);
 assert.match(academy,/id="academyMediaForward"/);
});
test('Every bilingual media lesson is physically available in both GoDaddy asset roots',()=>{
 const locations=['public','browser_public'],prefix='academy-media/academy360/';
 const manifest=JSON.parse(read(locations[0]+'/'+prefix+'AUTO_GENERATED_MANIFEST.json'));
 assert.equal(manifest.lessons.length,24);
 assert.equal(manifest.files.length,168);
 assert.equal(manifest.authenticatedEmployeeRecording,false);
 for(const id of Array.from({length:12},(_,i)=>'am-'+String(i+1).padStart(2,'0')))
 for(const lang of ['en','es']){
  const base=id+'-'+lang,files=[base+'.mp4',base+'-audio.webm',base+'.vtt',...Array.from({length:4},(_,i)=>base+'-'+String(i+1).padStart(2,'0')+'.webp')];
  for(const file of files)for(const dir of locations){
   const full=path.join(root,dir,prefix,file);
   assert(fs.existsSync(full),dir+'/'+file);
   assert(fs.statSync(full).size>400,dir+'/'+file);
  }
 }
});
