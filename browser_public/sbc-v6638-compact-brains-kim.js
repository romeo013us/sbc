(function(){'use strict';
var ID='sbc-v6638-ui-styles';
var CSS='#sbcAgentOSPanel[data-sbc-compact="1"] .sbc-agent-brains-grid{display:none!important}'+
'#sbcAgentOSPanel[data-sbc-compact="1"] .sbc-agent-os-head{padding-block:8px!important;gap:8px!important}'+
'#sbcAgentOSPanel[data-sbc-compact="1"] .sbc-agent-os-head h2{font-size:18px!important;margin:3px 0!important}'+
'#sbcAgentOSPanel[data-sbc-compact="1"] .sbc-agent-os-head p{display:none!important}'+
'#sbcAgentOSPanel .sbc-agent-collapse,#sbc-kim-header-launch{font:inherit;cursor:pointer;border:1px solid #338cbd;border-radius:8px;background:#12324a;color:#fff;padding:6px 12px;min-height:36px}';
function styles(){if(document.getElementById(ID))return;var s=document.createElement('style');s.id=ID;s.textContent=CSS;document.head.appendChild(s)}
function brains(){var p=document.getElementById('sbcAgentOSPanel');if(!p)return;if(!p.dataset.sbcCompact)p.dataset.sbcCompact='1';
var h=p.querySelector('.sbc-agent-os-head');if(!h)return;
var b=h.querySelector('.sbc-agent-collapse');if(!b){b=document.createElement('button');b.type='button';b.className='sbc-agent-collapse';h.appendChild(b)}
var g=p.querySelector('.sbc-agent-brains-grid');if(g&&g.id!=='sbc-agent-brains-grid')g.id='sbc-agent-brains-grid';
var collapsed=p.dataset.sbcCompact==='1';var label=collapsed?'Expand 10 Brains':'Collapse 10 Brains';if(b.textContent!==label)b.textContent=label;b.setAttribute('aria-expanded',String(!collapsed));b.setAttribute('aria-controls','sbc-agent-brains-grid')}
function kim(){var fn=window.sbcKimCanonical&&window.sbcKimCanonical.open||window.openSbcAI;if(typeof fn==='function')fn()}
function launcher(){var t=document.querySelector('#app .topbar');if(!t||document.getElementById('sbc-kim-header-launch'))return;
var b=document.createElement('button');b.id='sbc-kim-header-launch';b.type='button';b.textContent='✦ Open Kim';b.setAttribute('aria-label','Open Kim AI Chief of Staff chat');b.addEventListener('click',kim);t.appendChild(b)}
var scheduled=false;function scan(){scheduled=false;styles();brains();launcher()}
function queue(){if(!scheduled){scheduled=true;queueMicrotask(scan)}}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#sbcAgentOSPanel .sbc-agent-collapse');
if(b){var p=document.getElementById('sbcAgentOSPanel');if(p){p.dataset.sbcCompact=p.dataset.sbcCompact==='1'?'0':'1';brains()}return}
var el=e.target.closest&&e.target.closest('button,[role="button"]');
if(el&&el.id!=='sbc-kim-header-launch'&&/^open kim$/i.test((el.textContent||'').trim())){e.preventDefault();e.stopImmediatePropagation();kim()}},true);
function ready(){scan();new MutationObserver(queue).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
