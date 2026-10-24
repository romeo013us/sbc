'use strict';

const path = require('node:path');
const fs = require('node:fs');

const MARKER = 'SBC_V6602_STABLE_SIDEBAR_LAYOUT';
const SCRIPT = `<script id="sbc-v6602-stable-sidebar-layout" data-sbc-v6602-stable-sidebar-layout="true">
(function(){
  'use strict';
  var marker='SBC_V6602_STABLE_SIDEBAR_LAYOUT';
  if(window[marker])return;
  window[marker]={active:true,version:'66.0.2',moved:0};
  var ids=['sbcConsultativeRevenueMount','sbcGodTierBroadcastMount'];
  var scheduled=false;
  function repair(){
    scheduled=false;
    var app=document.querySelector('#app.app');
    if(!app)return;
    var main=app.querySelector(':scope > .main');
    if(!main)return;
    var anchor=main.querySelector(':scope > .topbar')||main.firstElementChild;
    ids.forEach(function(id){
      var mount=document.getElementById(id);
      if(!mount||!app.contains(mount))return;
      if(mount.parentElement!==main){
        main.insertBefore(mount,anchor||null);
        window[marker].moved++;
      }
      mount.style.setProperty('display','block','important');
      mount.style.setProperty('box-sizing','border-box','important');
      mount.style.setProperty('width','100%','important');
      mount.style.setProperty('min-width','0','important');
      mount.style.setProperty('max-width','100%','important');
      mount.style.setProperty('flex','0 0 auto','important');
      mount.style.setProperty('align-self','stretch','important');
      mount.style.setProperty('position','relative','important');
      mount.style.setProperty('left','auto','important');
      mount.style.setProperty('right','auto','important');
      mount.style.setProperty('transform','none','important');
      mount.style.setProperty('margin','0 0 16px 0','important');
      mount.setAttribute('data-sbc-v6602-contained','true');
    });
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    if(window.requestAnimationFrame)window.requestAnimationFrame(repair);
    else window.setTimeout(repair,0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  if(window.MutationObserver){
    var observer=new MutationObserver(schedule);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('resize',schedule,{passive:true});
})();
</script>`;

function apply(root){
  const changed=[];
  for(const rel of ['public/index.html','browser_public/index.html']){
    const file=path.join(root,rel);
    if(!fs.existsSync(file))continue;
    let html=fs.readFileSync(file,'utf8');
    if(html.includes(MARKER))continue;
    if(/<\\/body>/i.test(html))html=html.replace(/<\\/body>/i,SCRIPT+'\\n</body>');
    else if(/<\\/html>/i.test(html))html=html.replace(/<\\/html>/i,SCRIPT+'\\n</html>');
    else throw new Error(MARKER+': no body/html close tag in '+rel);
    fs.writeFileSync(file,html);
    changed.push(rel);
  }
  if(!changed.length)throw new Error(MARKER+': no supported HTML entrypoint found or patch already applied');
  return {marker:MARKER,changed,crmWrites:false,databaseChanges:false,tenantIsolationChanged:false,writerSafeguardsChanged:false};
}
module.exports={apply,MARKER};
