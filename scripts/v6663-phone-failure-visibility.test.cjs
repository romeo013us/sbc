'use strict';
/*
 * V66.63: compiled-browser Twilio failure visibility regression.
 * Synthetic SDK errors only. No provider requests, phone calls, credentials, or CRM mutations.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||path.join(__dirname,'..','.sbc-isolated-runtime'));
const marker='async function startSbcBusinessCall(customerId){';
const endMarker='\nfunction normalizeClientPhone';

async function exercise(source,which){
  assert(source.includes('TWILIO CONFIGURED · CALL TEST PENDING'),which+': configured credentials must not claim a verified working phone');
  const start=source.indexOf(marker);
  assert(start>=0,which+': live dialer start function missing');
  const end=source.indexOf(endMarker,start);
  assert(end>start,which+': live dialer boundary missing');
  const body=source.slice(start,end);
  assert.match(body,/sbcVoiceFailure/,'Safe provider failure summary must be present');
  assert.match(body,/Twilio code/,'Provider code must be visible');
  assert.doesNotMatch(body,/String\(e\?\.message\|\|'Unknown phone error'\)/,'Legacy fallback must not hide provider code');

  for(const mode of ['token-failure','device-failure']){
    const elements=new Map(),messages=[],events={};
    const getEl=k=>{if(!elements.has(k))elements.set(k,{disabled:false,textContent:'',value:''});return elements.get(k)};
    const ctx={
      state:{data:{customers:[{id:'lead-1',phone:'+13055550101',businessName:'Synthetic example'}]}},
      sbcVoiceStartedAt:null,sbcVoiceSessionId:'',sbcVoiceCallStatus:'idle',
      sbcVoiceCustomerId:'',sbcVoiceOpenCustomerId:'',sbcVoiceNotesSnapshot:{},
      sbcVoiceStartedAtIso:'',sbcVoiceFinishing:false,sbcVoiceConnection:null,
      sbcVoiceCollectNotes:()=>({notes:''}),saveSbcBusinessCallNotes:async()=>true,
      sbcVoiceFailureCodeForTest:null,
      $:getEl,toast:m=>messages.push(String(m)),console:{error:(...a)=>messages.push('console:'+String(a[0]))},
      normalizeClientPhone:v=>v,
      finishSbcBusinessCall:async()=>{getEl('#sbcPhoneLiveStatus').textContent='Call failed. Cleanup complete.';ctx.sbcVoiceStartedAt=null},
      ensureSbcVoice:async()=>{
        if(mode==='token-failure')throw Object.assign(new Error('Voice token rejected'),{code:20101,description:'Authentication failed'});
        return {connect:async()=>({on:(event,fn)=>{events[event]=fn}})};
      }
    };
    vm.runInNewContext(body,ctx,{timeout:1000,filename:which});
    await ctx.startSbcBusinessCall('lead-1');
    if(mode==='device-failure'){
      assert.equal(typeof events.error,'function','Twilio call error listener missing');
      await events.error({code:31005,name:'TwilioError',description:'Connection disrupted'});
    }
    const status=getEl('#sbcPhoneLiveStatus').textContent;
    const expected=mode==='token-failure'?'20101':'31005';
    assert(status.includes(expected),which+': '+mode+' lost provider code after cleanup: '+status);
    assert(status.includes(mode==='token-failure'?'Authentication failed':'Connection disrupted'),which+': '+mode+' lost descriptive reason: '+status);
    assert(messages.some(x=>x.includes(expected)),which+': '+mode+' toast must show provider code');
    assert(!status.includes('Cleanup complete'),which+': '+mode+' cleanup obscured failure');
  }
}
(async()=>{
  for(const rel of ['public/app.js','browser_public/app.js']){
    const file=path.join(root,rel);
    assert(fs.existsSync(file),'Compiled dialer missing '+file);
    await exercise(fs.readFileSync(file,'utf8'),rel);
  }
  console.log('[SBC V66.63] PASS compiled startup and async Twilio errors preserve detail after call cleanup; 2 browser entrypoints, no real calls');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
