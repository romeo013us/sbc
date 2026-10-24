'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6602_LAYOUT_CONTAINMENT';
const SCRIPT = `<style id="sbc-v6602-layout-containment-css">
/* Contain late-mounted revenue modules so they cannot become competing root flex columns. */
#app>#sbcConsultativeRevenueMount,#app>#sbcGodTierBroadcastMount{display:block!important;position:relative!important;inset:auto!important;flex:0 1 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;overflow-wrap:anywhere!important;order:90!important}
#app>.main>#sbcConsultativeRevenueMount,#app>.main>#sbcGodTierBroadcastMount{flex:0 1 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:18px 0 0!important}
#app .sbc-v6602-ten-brain-compact{display:block!important;position:relative!important;inset:auto!important;float:none!important;clear:both!important;width:min(100%,760px)!important;max-width:760px!important;min-width:0!important;margin:28px auto 0!important;padding:12px!important;box-sizing:border-box!important;overflow-wrap:anywhere!important;transform:none!important}
#app .sbc-v6602-ten-brain-compact>*{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}
#app .sbc-v6602-ten-brain-compact h1,#app .sbc-v6602-ten-brain-compact h2,#app .sbc-v6602-ten-brain-compact h3{font-size:clamp(14px,1.6vw,19px)!important;line-height:1.25!important}
@media(max-width:760px){#app .sbc-v6602-ten-brain-compact{width:100%!important;max-width:100%!important;margin-top:18px!important;padding:10px!important}}
</style>
<script id="sbc-v6602-layout-containment">
(function(){
  'use strict';
  var marker='SBC_V6602_LAYOUT_CONTAINMENT';
  if(window[marker]&&window[marker].active)return;
  var mountIds=['sbcConsultativeRevenueMount','sbcGodTierBroadcastMount'];
  function textOf(el){return String(el&&(el.innerText||el.textContent)||'').replace(/\\s+/g,' ').trim();}
  function root(){return document.querySelector('#app.app')||document.getElementById('app');}
  function mainFor(app){return app&&(app.querySelector(':scope > .main')||app.querySelector('.main'));}
  function contentFor(main){return main&&(main.querySelector(':scope > .content')||main.querySelector('.content')||main);}
  function moveMounts(app,main){
    mountIds.forEach(function(id){
      var el=document.getElementById(id);
      if(!el||!main||el===main||main.contains(el))return;
      // Keep the revenue modules alive and connected; relocate only the known rogue root children.
      if(el.parentElement===app||!el.parentElement){
        var content=contentFor(main);
        (content||main).appendChild(el);
        el.setAttribute('data-sbc-v6602-contained','true');
      }
    });
  }
  function findTenBrain(app,main){
    if(!app||!main)return;
    var candidates=app.querySelectorAll('section,article,aside,div,header');
    var hits=[];
    for(var i=0;i<candidates.length;i++){
      var el=candidates[i];
      if(el.dataset&&el.dataset.sbcV6602BrainMoved==='true')continue;
      var t=textOf(el);
      var cls=String(el.className&&el.className.baseVal||el.className||'')+' '+String(el.id||'');
      if((!t||t.length>9000||!/ten[- ]brain|10[- ]brain|10 brains|ten brains|v56134/i.test(t))&&!/ten[- ]brain|10[- ]brain|v56134/i.test(cls))continue;
      // Prefer a compact, named module container over broad ancestors containing the whole page.
      var named=/brain|intelligence|cognitive|multi.?agent/i.test(cls);
      var childMatch=el.querySelector('h1,h2,h3,h4,[role="heading"]');
      if(named||childMatch)hits.push({el:el,score:(named?5:0)+(childMatch?2:0)+Math.max(0,1000-t.length)/1000});
    }
    hits.sort(function(a,b){return b.score-a.score;});
    if(!hits.length)return;
    var target=hits[0].el;
    // Reject broad containers that would relocate the entire workspace.
    if(target===app||target===main||target.classList.contains('content')||target.classList.contains('topbar'))return;
    var content=contentFor(main);
    if(!content||target===content||content.contains(target)) {
      target.classList.add('sbc-v6602-ten-brain-compact');
      target.dataset.sbcV6602BrainMoved='true';
      return;
    }
    content.appendChild(target);
    target.classList.add('sbc-v6602-ten-brain-compact');
    if(target.dataset)target.dataset.sbcV6602BrainMoved='true';
  }
  var queued=false;
  function apply(){
    queued=false;
    var app=root(),main=mainFor(app);
    if(!app||!main)return;
    moveMounts(app,main);
    findTenBrain(app,main);
  }
  function schedule(){if(queued)return;queued=true;window.requestAnimationFrame?window.requestAnimationFrame(apply):setTimeout(apply,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  if(window.MutationObserver)new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window[marker]={active:true,version:'66.0.2',apply:apply};
})();
</script>`;
function apply(root) {
  const changed=[];
  for (const rel of ['public/index.html','browser_public/index.html']) {
    const file=path.join(root,rel);
    if(!fs.existsSync(file))continue;
    let html=fs.readFileSync(file,'utf8');
    if(html.includes(MARKER))continue;
    if(/<\/body>/i.test(html))html=html.replace(/<\/body>/i,SCRIPT+'\n</body>');
    else if(/<\/html>/i.test(html))html=html.replace(/<\/html>/i,SCRIPT+'\n</html>');
    else throw new Error(MARKER+': no body/html close tag in '+rel);
    fs.writeFileSync(file,html);
    changed.push(rel);
  }
  if(!changed.length)throw new Error(MARKER+': no supported HTML entrypoint found or patch already applied');
  return {marker:MARKER,changed};
}
module.exports={apply,MARKER};
