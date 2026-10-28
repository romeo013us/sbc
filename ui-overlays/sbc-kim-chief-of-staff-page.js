/* SBC V66: Kim's dedicated Chief-of-Staff page. One existing chat/voice backend; zero duplicate dock owners. */
(function(){'use strict';
 if(window.__SBC_KIM_CHIEF_OF_STAFF_PAGE__)return;
 window.__SBC_KIM_CHIEF_OF_STAFF_PAGE__=true;
 const STYLE_ID='sbc-kim-revival-style', MODAL_ID='sbcKimChiefRoom', BUTTON_ID='sbcKimChiefNav';
 const css=String.raw`
 #sbcKimChiefRoom[hidden]{display:none!important}
 #sbcKimChiefRoom{position:fixed;inset:0;z-index:10040;overflow-y:auto;overscroll-behavior:contain;background:#020916e8;color:#fff;font-family:inherit}
 .sbc-kim-room{position:relative;max-width:1020px;min-height:600px;margin:clamp(16px,5vh,48px) auto;padding:28px;border:1px solid #367eab;border-radius:24px;background:radial-gradient(circle at 76% 12%,#123e6870,transparent 45%),linear-gradient(120deg,#071221,#0d1d30 66%,#152538);box-shadow:0 30px 90px #000b}
 .sbc-kim-room header{display:flex;justify-content:space-between;align-items:center;gap:12px}
 .sbc-kim-mark{font-size:12px;letter-spacing:.15em;color:#8edaff;font-weight:900}
 .sbc-kim-close{border:1px solid #68a4c4;border-radius:10px;background:#152f47;color:white;min-width:42px;min-height:42px;font-size:22px;cursor:pointer}
 .sbc-kim-hero{display:grid;grid-template-columns:minmax(180px,310px) 1fr;align-items:center;gap:28px;margin:30px 0}
 .sbc-kim-avatar{width:100%;max-height:360px;object-fit:contain;filter:drop-shadow(0 0 18px #08a5ff65);border:1px solid #4394c145;background:radial-gradient(circle at center,#17517f78,#041323);border-radius:20px}
 .sbc-kim-room h1{font-size:clamp(31px,5vw,57px);line-height:1.02;color:#fff;margin:9px 0 16px}
 .sbc-kim-room h1 em{font-style:normal;color:#ff974d}
 .sbc-kim-room p{color:#cfe7f7;font-size:clamp(14px,1.4vw,17px);line-height:1.6}
 .sbc-kim-room .sbc-kim-lead{font-size:clamp(16px,1.7vw,21px);color:#fff}
 .sbc-kim-capabilities{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:25px 0}
 .sbc-kim-capabilities>div{border:1px solid #285779;background:#0f304955;padding:15px;border-radius:12px;color:#e1f4ff}
 .sbc-kim-capabilities strong{display:block;color:#fff;margin-bottom:4px}
 .sbc-kim-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
 .sbc-kim-action{cursor:pointer;min-height:48px;border-radius:11px;font-weight:800;font-size:15px;padding:11px 18px;border:1px solid #55b3ec;background:#1168b9;color:white}
 .sbc-kim-action.secondary{background:#102941;border-color:#4d86af}
 .sbc-kim-action:focus-visible,.sbc-kim-close:focus-visible{outline:3px solid #ff9f50;outline-offset:2px}
 .sbc-kim-reality{border-left:3px solid #ff974d;padding:13px 17px;margin-top:17px;background:#f5822016;color:#d5e9f9;font-size:13px}
 #sbcKimChiefNav{border-left:3px solid #ff9347}
 @media(max-width:680px){.sbc-kim-room{min-height:auto;margin:6px;padding:17px}.sbc-kim-hero{grid-template-columns:1fr;gap:16px;margin:18px 0}.sbc-kim-avatar{width:min(240px,100%);max-height:245px}.sbc-kim-capabilities{grid-template-columns:1fr 1fr}.sbc-kim-room h1{font-size:32px}}
 @media(prefers-reduced-motion:reduce){#sbcKimChiefRoom *{animation:none!important;transition:none!important}}
 `;
 let previousFocus=null;
 function addStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s)}
 function mk(name,className,text){const x=document.createElement(name);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x}
 function button(label,className,fn){const b=mk('button','sbc-kim-action'+(className?' '+className:''),label);b.type='button';b.addEventListener('click',fn);return b}
 function ensure(){
  let root=document.getElementById(MODAL_ID);if(root)return root;
  root=mk('section');root.id=MODAL_ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','sbcKimChiefTitle');
  const room=mk('div','sbc-kim-room'),header=mk('header');
  header.append(mk('span','sbc-kim-mark','SBC · EXECUTIVE INTELLIGENCE'));
  const close=mk('button','sbc-kim-close','×');close.type='button';close.setAttribute('aria-label','Close Kim Chief of Staff page');close.addEventListener('click',hide);header.append(close);room.append(header);
  const hero=mk('div','sbc-kim-hero'),portrait=mk('img','sbc-kim-avatar');portrait.src='/assets/kim-avatar.png';portrait.alt='Kim — illustrated SBC AI Chief of Staff';portrait.loading='lazy';hero.append(portrait);
  const copy=mk('div');copy.append(mk('div','sbc-kim-mark','MEET YOUR CHIEF OF STAFF'));
  const heading=mk('h1');heading.id='sbcKimChiefTitle';heading.append('Hi, I’m ',mk('em','','Kim.'));copy.append(heading);
  copy.append(mk('p','sbc-kim-lead','Your AI Chief of Staff at Successful By Choice.'));
  copy.append(mk('p','','I’m here to help you get answers, learn faster, solve problems, practice sales, stay productive, and keep the Command Center moving. Tell me what happened, what’s happening, or what you want to do next.'));
  const actions=mk('div','sbc-kim-actions');actions.append(button('✦ Ask Kim','',openChat),button('🎙 Talk to Kim','secondary',startVoice));copy.append(actions);const voiceState=mk('div','sbc-kim-reality','Voice idle · Use Talk to Kim to connect.');voiceState.id='kimVoiceStatus';voiceState.setAttribute('role','status');voiceState.setAttribute('aria-live','polite');copy.append(voiceState);hero.append(copy);room.append(hero);const voiceTranscript=mk('div','kim-voice-transcript');voiceTranscript.id='kimVoiceTranscript';voiceTranscript.setAttribute('aria-live','polite');room.append(voiceTranscript);
  const grid=mk('div','sbc-kim-capabilities');
  for(const [name,description] of [['Get Answers','Understand business activity and your options'],['Learn Faster','Training, onboarding, and how-to help'],['Solve Problems','Diagnose errors and propose safe fixes'],['Practice Sales','Rehearse pitches and customer objections'],['Stay Productive','Plan tasks, leads and fulfillment'],['Know the Next Move','Turn real business context into decisions']]){
    const tile=mk('div');tile.append(mk('strong','',name),mk('span','',description));grid.append(tile);
  }
  room.append(grid);
  room.append(mk('p','sbc-kim-reality','Kim is an AI assistant, not a human employee. Protected business changes, payments, credentials and production deployments still require your authorized controls. Voice and live context depend on their configured services.'));
  root.append(room);root.addEventListener('click',e=>{if(e.target===root)hide()});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();return}if(e.key==='Tab'){const focusables=[...root.querySelectorAll('button:not([disabled])')];const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  document.body.appendChild(root);return root;
 }
 function show(){addStyle();previousFocus=document.activeElement;const root=ensure();root.hidden=false;document.body.classList.add('sbc-kim-page-open');root.querySelector('.sbc-kim-close')?.focus()}
 function hide(){const root=document.getElementById(MODAL_ID);if(!root||root.hidden)return;root.hidden=true;document.body.classList.remove('sbc-kim-page-open');try{previousFocus?.focus()}catch{}}
 function openChat(){hide();const open=window.sbcKimCanonical?.open||window.openSbcAI;if(typeof open==='function')open();else alert('Kim chat is still loading. Please open Intelligence and retry.')}
 function startVoice(){if(typeof window.startKimVoice==='function'){window.startKimVoice()}else alert('Voice is not configured on this Command Center runtime. Text chat remains available.')}
 function nav(){const host=document.querySelector('button[data-view="kimcenter"]');if(!host||document.getElementById(BUTTON_ID))return;const b=mk('button',host.className,'👑 Ask Kim');b.id=BUTTON_ID;b.type='button';b.removeAttribute('data-view');b.setAttribute('aria-label','Open Kim AI Chief of Staff page');b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show()});host.insertAdjacentElement('afterend',b)}
 let scheduled=false;function scan(){scheduled=false;nav()}function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
 function init(){addStyle();nav();window.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});new MutationObserver(queue).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});window.openKimChiefRoom=show}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
