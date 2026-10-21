'use strict';
const fs = require('node:fs');
const path = require('node:path');
const VERSION = '65.1.72';
const MARKER = 'data-sbc-v6572-layout-stability';
const STYLE = `
<style id="sbc-v6572-layout-stability" data-sbc-v6572-layout-stability="true">
:root{--sbc-sidebar-width:clamp(220px,18vw,290px);--sbc-layout-gap:16px}
html{min-width:320px}
body{min-width:320px}
#app,#root,#content,#main-content,.app,.app-shell,.app-layout,.main-content,.main-content-wrapper,.dashboard,.dashboard-page,.dashboard-content,.page-content,.content-area,.workspace,.workspace-content,[data-page="home"],[data-route="home"]{box-sizing:border-box;min-width:0;max-width:100%}
#content,#main-content,.main-content,.main-content-wrapper,.dashboard-content,.page-content,.content-area,.workspace-content{width:auto;flex:1 1 auto}
#content *,#main-content *, .main-content *, .dashboard-content *, .page-content *, .content-area *{box-sizing:border-box}
#content .grid,#main-content .grid,.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:var(--sbc-layout-gap);min-width:0;width:100%}
#content .card,#main-content .card,.dashboard-card,.metric-card,.stat-card,.kpi-card,.panel,.dashboard-panel,.sbc-card{min-width:0;max-width:100%;overflow-wrap:anywhere}
#content img,#main-content img,.main-content img{max-width:100%;height:auto}
#content table,#main-content table{max-width:100%;display:block;overflow-x:auto}
#content input,#content select,#content textarea,#main-content input,#main-content select,#main-content textarea{max-width:100%;min-width:0}
#sbc-v6571-bilingual-sales-ops,#sbcBilingualSalesOperations,[data-sbc-module="bilingual-sales-ops"],.sbc-bilingual-sales-ops{width:100%;max-width:100%;min-width:0;display:block;overflow-wrap:anywhere}
#sbc-v6571-bilingual-sales-ops .card,#sbc-v6571-bilingual-sales-ops .panel,#sbc-v6571-bilingual-sales-ops .grid,#sbcBilingualSalesOperations .grid{min-width:0;max-width:100%}
@media(max-width:760px){:root{--sbc-layout-gap:10px}#content,#main-content,.main-content,.main-content-wrapper{width:100%;max-width:100%;min-width:0}.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}}
</style>`;
const SCRIPT = `<script id="sbc-v6572-layout-observer" data-sbc-v6572-layout-stability="true">
(function(){
'use strict';
if(window.__SBC_V6572_LAYOUT__)return;window.__SBC_V6572_LAYOUT__=true;
var started=false,tries=0,observer=null,raf=0;
function measure(){
var sidebar=document.querySelector('aside,.sidebar,[data-sidebar],#sidebar,.app-sidebar,nav[aria-label]');
var main=document.querySelector('#content,#main-content,.main-content,.main-content-wrapper,.dashboard-content,.page-content,.content-area,.workspace-content,main');
if(!main)return false;
var rect=main.getBoundingClientRect(),w=window.innerWidth||document.documentElement.clientWidth||1024;
if(sidebar){var sw=sidebar.getBoundingClientRect().width;if(sw>80&&sw<w*.65)document.documentElement.style.setProperty('--sbc-sidebar-width',Math.round(sw)+'px');}
if(rect.width<Math.min(320,w*.45)&&w>760){
main.style.setProperty('min-width','0','important');
main.style.setProperty('width','auto','important');
main.style.setProperty('flex','1 1 0%','important');
main.style.setProperty('max-width','none','important');
}
document.documentElement.dataset.sbcLayoutReady='true';
return true;
}
function schedule(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;measure();});}
function start(){
if(started)return;started=true;
var ok=measure();
if(window.ResizeObserver){observer=new ResizeObserver(schedule);[document.documentElement,document.body,document.querySelector('aside,.sidebar,[data-sidebar],#sidebar,.app-sidebar,nav[aria-label]'),document.querySelector('#content,#main-content,.main-content,.main-content-wrapper,main')].filter(Boolean).forEach(function(el){try{observer.observe(el)}catch(_){}});}
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});
if(!ok&&tries++<20)setTimeout(function(){measure();},150);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',schedule,{once:true});
})();
</script>`;
function inject(file){
if(!fs.existsSync(file))return false;
var html=fs.readFileSync(file,'utf8');
if(html.includes(MARKER))return false;
if(/<\/head>/i.test(html))html=html.replace(/<\/head>/i,STYLE+'\n'+SCRIPT+'\n</head>');
else html=STYLE+'\n'+SCRIPT+'\n'+html;
fs.writeFileSync(file,html);
return true;
}
function apply(root){
var changed=[];
['public/index.html','browser_public/index.html'].forEach(function(p){if(inject(path.join(root,p)))changed.push(p)});
return {version:VERSION,changed,crmWrites:false};
}
module.exports={apply,VERSION,MARKER};
