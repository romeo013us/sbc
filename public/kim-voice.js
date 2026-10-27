(()=>{
 let pc=null,dc=null,mic=null,audio=null,startedAt=null,active=false;
 const $=id=>document.getElementById(id);
 const status=t=>{const e=$('kimVoiceStatus');if(e)e.textContent=t;const c=$('sbcAiVoiceStatus');if(c)c.textContent=t;};
 const setActive=(v)=>{active=v;const b=$('kimVoiceToggle');if(b){b.textContent=v?'🔴 End Conversation':'🎙️ Talk to Kim';b.classList.toggle('active',v)}const cb=$('sbcAiListen');if(cb)cb.textContent=v?'🔴 End Conversation':'🎙 Talk to Kim';document.body.classList.toggle('kim-voice-active',v)};
 function cleanup(){try{dc?.close()}catch{};try{pc?.close()}catch{};mic?.getTracks?.().forEach(t=>t.stop());if(audio){audio.srcObject=null;audio.remove()}pc=dc=mic=audio=null;setActive(false);status('Ready when you are.');}
 function transcriptEvent(ev){
   const text=ev?.delta||ev?.text||ev?.item?.content?.map(x=>x.transcript||x.text||'').join('')||'';
   if(!text)return;
   const box=$('kimVoiceTranscript');if(!box)return;
   const role=String(ev.type||'').includes('input_audio')?'You':'Kim';
   const line=document.createElement('div');line.className='kim-voice-line '+(role==='You'?'user':'assistant');line.innerHTML=`<strong>${role}:</strong> ${String(text).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}`;box.appendChild(line);box.scrollTop=box.scrollHeight;
 }
 async function start(){
   if(active){stop();return}
   setActive(true);status('Asking for microphone access…');startedAt=Date.now();
   try{
     pc=new RTCPeerConnection();
     audio=new Audio();audio.autoplay=true;audio.setAttribute('aria-label','Kim voice output');document.body.appendChild(audio);
     pc.addEventListener('track',e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{})});
     mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
     mic.getTracks().forEach(t=>pc.addTrack(t,mic));
     dc=pc.createDataChannel('oai-events');
     dc.addEventListener('open',()=>status('Kim is listening… go ahead.'));
     dc.addEventListener('message',e=>{try{const ev=JSON.parse(e.data);if(ev.type==='session.created'||ev.type==='session.updated')status('Kim is listening… go ahead.');if(ev.type==='input_audio_buffer.speech_started')status('Listening…');if(ev.type==='response.created')status('Kim is thinking…');if(ev.type==='response.done')status('Kim is listening…');if(String(ev.type).includes('transcript'))transcriptEvent(ev);if(ev.type==='error')status(ev.error?.message||'Kim voice reported an error.');if(ev.type==='session.closed')cleanup();}catch{}});
     pc.addEventListener('connectionstatechange',()=>{if(['failed','disconnected','closed'].includes(pc.connectionState))cleanup()});
     const offer=await pc.createOffer();await pc.setLocalDescription(offer);
     if(pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const to=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',fn);reject(new Error('Timed out while preparing voice connection.'))},10000);function fn(){if(pc.iceGatheringState!=='complete')return;clearTimeout(to);pc.removeEventListener('icegatheringstatechange',fn);resolve()};fn()});
     const sdp=pc.localDescription?.sdp;if(!sdp)throw new Error('Missing voice connection offer.');
     const r=await fetch('/api/kim/voice/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp})});
     if(!r.ok){let d={};try{d=await r.json()}catch{};throw new Error(d.detail||d.error||'Kim voice session could not start.')}
     const answer=await r.text();await pc.setRemoteDescription({type:'answer',sdp:answer});
     status('Kim is connected. Talk naturally — you can interrupt her.');
   }catch(e){status((e&&e.message)||'Kim voice could not start.');cleanup()}
 }
 function stop(){if(!dc||dc.readyState!=='open'){cleanup();return}status('Wrapping up…');try{dc.send(JSON.stringify({type:'session.close'}))}catch{}setTimeout(cleanup,1200)}
 window.startKimVoice=start;window.stopKimVoice=stop;
 window.addEventListener('beforeunload',cleanup);
})();
