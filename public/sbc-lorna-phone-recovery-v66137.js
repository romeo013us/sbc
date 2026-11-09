/* SBC V66.137 — targeted phone-recovery work, only 15-day due items, no AI/calls. */
(function(){
 'use strict';
 function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 async function request(url,method,body){
  const response=await fetch(url,{method:method||'GET',credentials:'same-origin',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{})});
  let payload={};try{payload=await response.json()}catch{}
  if(!response.ok||payload.ok===false)throw Error(String(payload.error||'Recovery service unavailable'));
  return payload;
 }
 function mount(){
  const home=document.querySelector('.pane[data-pane="home"]');if(!home||document.getElementById('sbc-phone-recovery'))return;
  const card=node('section','card');card.id='sbc-phone-recovery';card.style.margin='18px 0';card.style.padding='20px';
  card.style.borderLeft='5px solid #60a5fa';
  const eyebrow=node('div','eyebrow','SMART LEAD RECOVERY · COST CONTROL');
  const title=node('h3','', 'Phone Verification — Targeted Checks Only');
  const expl=node('p','', 'Do not redo successful research. Failed numbers leave sales immediately; review once after 15 days only if due. Spend no more than five minutes checking a credible NEW source. Never call an unchanged bad number.');
  const status=node('p','muted','Checking due items…');status.setAttribute('role','status');
  const rows=node('div','list');rows.id='sbc-phone-recovery-due';
  card.append(eyebrow,title,expl,status,rows);
  home.prepend(card);
  function show(rowsData){
   rows.replaceChildren();
   status.textContent=rowsData.length?rowsData.length+' targeted phone check(s) due — no automatic calls':'No phone-recovery checks due. Keep researching new prospects.';
   for(const item of rowsData){
    const wrap=node('div','lead-row');wrap.style.display='block';wrap.style.padding='14px';
    const heading=node('strong','',item.businessName||'Business lead');
    const summary=node('p','muted','Unreachable: '+(item.phone||'Unknown')+' · Due '+(item.reviewAt||''));
    const form=node('form','');form.style.display='grid';form.style.gap='8px';
    const outcome=node('select','');outcome.setAttribute('aria-label','Phone verification result');
    [['NO_NEW_NUMBER','No credible new number — archive from calling'],['CANDIDATE_FOUND','New candidate number with reliable source']].forEach(([v,label])=>{const option=node('option','',label);option.value=v;outcome.append(option)});
    const candidate=node('input','');candidate.placeholder='New phone number (only if different)';candidate.maxLength=40;candidate.setAttribute('aria-label','Replacement phone number');
    const source=node('input','');source.placeholder='Exact source URL or verified reference';source.maxLength=400;source.setAttribute('aria-label','Research source');
    const notes=node('textarea','');notes.placeholder='Brief findings — do not repeat research';notes.rows=2;notes.maxLength=1000;notes.setAttribute('aria-label','Phone verification notes');
    const action=node('button','primary','Save verification (no phone call)');action.type='submit';
    function syncFields(){const found=outcome.value==='CANDIDATE_FOUND';candidate.hidden=!found;source.hidden=!found;candidate.required=found;source.required=found;}
    outcome.addEventListener('change',syncFields);syncFields();
    form.append(outcome,candidate,source,notes,action);
    const message=node('div','muted','');message.setAttribute('role','status');
    form.addEventListener('submit',async e=>{
     e.preventDefault();action.disabled=true;message.textContent='Saving to SBC…';
     try{
      const result=await request('/api/v9/phone-recovery/'+encodeURIComponent(item.id)+'/review','POST',
       {outcome:outcome.value,candidatePhone:candidate.value,source:source.value,notes:notes.value});
      message.textContent=result.state==='OWNER_REVIEW'?'Candidate sent for owner verification; call hold remains.':'No new number. Archived from sales calling; customer history retained.';
      await refresh();
     }catch(err){message.textContent='Not saved: '+err.message;}finally{action.disabled=false;}
    });
    wrap.append(heading,summary,form,message);rows.append(wrap);
   }
  }
  async function refresh(){
   try{const data=await request('/api/v9/phone-recovery');show(Array.isArray(data.rows)?data.rows:[]);}
   catch(err){status.textContent='Phone-recovery checks unavailable. Do not call blocked numbers. '+err.message;rows.replaceChildren();}
  }
  const watch=document.querySelector('#refresh');if(watch)watch.addEventListener('click',()=>refresh());
  refresh();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();