'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('public/sbc-v6559-ui.js'),app=read('public/app.js'),index=read('public/index.html');
test('current layout removes only retired acquisition panel and does not enable drag or reload',()=>{
 const removed=[],target={innerText:'Launch & Customer Acquisition OS',remove(){removed.push('acquisition');}},sales={innerText:'Sales',remove(){removed.push('sales');}};
 const document={body:{},documentElement:{},readyState:'complete',querySelectorAll:()=>[sales,target]};
 const forbidden=()=>assert.fail('legacy layout must not reorder or reload a live workspace');
 vm.runInNewContext(ui,{document,MutationObserver:forbidden,addEventListener:forbidden,location:{reload:forbidden},localStorage:{setItem:forbidden}}, {timeout:1000});assert.deepEqual(removed,['acquisition']);
 assert.match(ui,/function initReorder\(\)\{\s*\/\* SBC_V6565_DASHBOARD_LAYOUT_STABILITY/);
 assert.match(index,/src="\/sbc-v6559-ui\.js\?v=66\.0\.13-profile-stability"/);
 assert.match(index,/href="\/sbc-v66-owner-ui-core\.[a-f0-9]+\.css"/,'current theme bundle remains loaded');
 assert.doesNotMatch(index,/href="\/sbc-v6559-burnt-orange-layout\.css/,'do not restore retired theme override');
});
test('actual device error handler surfaces provider code and remembers diagnostic without calling a customer',()=>{
 const line=app.split('\n').find(l=>l.includes("sbcVoiceDevice.on('error',e=>"));assert(line);let handler;const live={textContent:''},notices=[],remembered=[];
 vm.runInNewContext(line,{sbcVoiceDevice:{on(name,fn){assert.equal(name,'error');handler=fn;}},document:{querySelector:()=>live},sbcVoiceRememberError:(e,type)=>remembered.push([e,type]),toast:m=>notices.push(m),console:{error(){}}},{timeout:1000});
 const failure={message:'Fixture provider failure',description:'Fixture description',name:'FixtureError',code:12345};handler(failure);assert.match(live.textContent,/Twilio code 12345/);assert.match(live.textContent,/Fixture description/);assert.equal(notices[0],live.textContent);assert.deepEqual(remembered,[[failure,'device']]);
});
