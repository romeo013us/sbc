(function(){'use strict';
  const VERSION='43.7.1';
  const shortcuts=[
    ['n','Next lead','next'],['p','Previous lead','previous'],['s','Save profile','save'],['c','Add call note','call-note'],['t','Add follow-up task','task'],['d','Mark research complete','research-complete'],['e','Edit profile','edit']
  ];
  function dispatch(action){
    window.dispatchEvent(new CustomEvent('sbc:lead-workbench-action',{detail:{action,version:VERSION}}));
    if(typeof window.SBCLeadWorkbenchAction==='function'){try{window.SBCLeadWorkbenchAction(action)}catch(e){console.warn('[SBC V43.7] workbench action',e)}}
    const el=document.querySelector(`[data-sbc-action="${action}"]`); if(el && typeof el.click==='function') el.click();
  }
  function close(){const x=document.getElementById('sbc437Palette');if(x)x.remove()}
  function open(){close();const wrap=document.createElement('div');wrap.id='sbc437Palette';wrap.innerHTML='<div class="sbc437-backdrop"></div><div class="sbc437-palette" role="dialog" aria-label="SBC Lead Workbench Command Palette"><div class="sbc437-head"><strong>⚡ SBC Lead Workbench</strong><button id="sbc437Close">×</button></div><input id="sbc437Search" autocomplete="off" placeholder="Type an action…"><div id="sbc437List"></div><small>Enter runs • Esc closes • shortcuts never bypass server authorization</small></div>';document.body.appendChild(wrap);
    const input=wrap.querySelector('#sbc437Search'),list=wrap.querySelector('#sbc437List');
    function render(q){const rows=shortcuts.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q.toLowerCase()));list.innerHTML=rows.map((x,i)=>`<button class="sbc437-row" data-action="${x[2]}"><span>${x[1]}</span><kbd>${i<2?'N/P':''}</kbd></button>`).join('');list.querySelectorAll('button').forEach(b=>b.onclick=()=>{dispatch(b.dataset.action);close()})}
    input.oninput=()=>render(input.value);input.onkeydown=e=>{if(e.key==='Escape'){close()}if(e.key==='Enter'){const b=list.querySelector('button');if(b){dispatch(b.dataset.action);close()}}};wrap.querySelector('#sbc437Close').onclick=close;wrap.querySelector('.sbc437-backdrop').onclick=close;render('');input.focus();
  }
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();return}if(e.key==='Escape'){close();return}if(e.target && /input|textarea|select/i.test(e.target.tagName))return;if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();const row=shortcuts.find(x=>x[0]===k);if(row){e.preventDefault();dispatch(row[2])}});
  window.SBC437={version:VERSION,shortcuts,openPalette:open,closePalette:close};
})();
