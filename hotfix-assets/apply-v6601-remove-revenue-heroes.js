'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6601_REMOVE_REVENUE_HEROES';
const SCRIPT = `<script id="sbc-v6601-remove-revenue-heroes">
(function(){
  var marker='SBC_V6601_REMOVE_REVENUE_HEROES';
  var titles=[
    /V56\.13\.5\s*[·|—-]?\s*CONSULTATIVE REVENUE ENGINE/i,
    /GOD[- ]TIER REVENUE AUTOPILOT/i
  ];
  var labels=['DYNAMIC SOLUTION MAPPING ACROSS THE CANONICAL SBC CATALOG','DISCOVERY → SOLUTION GRAPH → CHECKOUT','KIM REVENUE CLOSER'];
  function textOf(el){return String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();}
  function isTarget(el){
    var t=textOf(el);
    return titles.some(function(re){return re.test(t);}) ||
      (t.indexOf('102 CATALOG OFFERINGS')>=0 && t.indexOf('RECENT SOLUTION MAPS')>=0) ||
      (t.indexOf('GOD-TIER REVENUE AUTOPILOT')>=0 && t.indexOf('FULFILLMENT JOBS')>=0);
  }
  function chooseBlock(el){
    var n=el, best=el;
    for(var i=0;n&&i<9;i++,n=n.parentElement){
      var tag=(n.tagName||'').toLowerCase();
      var cls=String(n.className&&n.className.baseVal||n.className||'');
      var id=String(n.id||'');
      if(/^(section|article|aside)$/.test(tag) || /card|panel|hero|revenue|autopilot|widget|module|feature/i.test(cls+' '+id)) best=n;
      if(tag==='main'||id==='content'||/main-content|page-content|dashboard-content/i.test(cls)) break;
    }
    return best;
  }
  function scrub(){
    var all=document.querySelectorAll('body *');
    for(var i=0;i<all.length;i++){
      var el=all[i];
      if(el.dataset&&el.dataset.sbcV6601Removed==='1')continue;
      var tag=(el.tagName||'').toLowerCase();
      if(!/^(h1|h2|h3|h4|header|strong|b|div|section|article|p)$/.test(tag))continue;
      var t=textOf(el);
      if(!t||t.length>1800)continue;
      if(!titles.some(function(re){return re.test(t);}))continue;
      var block=chooseBlock(el);
      if(!block||block===document.body||block===document.documentElement)continue;
      if(block.dataset)block.dataset.sbcV6601Removed='1';
      block.style.setProperty('display','none','important');
      block.setAttribute('aria-hidden','true');
    }
    // Also hide the matching named sections if the SPA wraps their content in a
    // generic container whose class is not descriptive.
    document.querySelectorAll('[data-sbc-revenue-hero]').forEach(function(el){
      el.style.setProperty('display','none','important');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scrub,{once:true});else scrub();
  var root=document.documentElement;
  if(root&&window.MutationObserver)new MutationObserver(function(){scrub();}).observe(root,{childList:true,subtree:true});
  window[marker]={active:true,version:'66.0.1'};
})();
</script>`;
function apply(root){
 const targets=['public/index.html','browser_public/index.html'];
 const changed=[];
 for(const rel of targets){
  const file=path.join(root,rel);if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  if(html.includes(MARKER))continue;
  if(/<\/body>/i.test(html))html=html.replace(/<\/body>/i,SCRIPT+'\n</body>');
  else if(/<\/html>/i.test(html))html=html.replace(/<\/html>/i,SCRIPT+'\n</html>');
  else throw new Error(MARKER+': no body/html close tag in '+rel);
  fs.writeFileSync(file,html);changed.push(rel);
 }
 if(!changed.length)throw new Error(MARKER+': no supported HTML entrypoint found or patch already applied');
 return {marker:MARKER,changed};
}
module.exports={apply,MARKER};
