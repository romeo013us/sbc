'use strict';
// SBC Website Studio — bounded, opt-in CSS Grid design sidecar.
// Only owner-approved *presentation* changes to verified service cards.
// Never compiles third-party HTML, JS, client prices, reviews or checkout controls.
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(obj,allowed)=>record(obj)&&Object.keys(obj).every(key=>allowed.includes(key));
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const guard=condition=>{if(!condition)throw Error('INVALID_STUDIO_GRID');};
const SHADOW=Object.freeze({
 none:'none',
 soft:'0 8px 25px -12px rgba(0,0,0,.3)',
 elevated:'0 23px 45px -22px rgba(0,0,0,.5)',
 glow:'0 0 22px -8px var(--v2-accent)'
});
const MOTION=new Set(['none','fade-up','scale-in','hover-lift']);
const ALIGN=new Set(['left','center','right']);
const MAX_NODES=12;
function normalizeGrid(raw){
 if(raw===undefined||raw===null)return {enabled:false,nodes:[]};
 guard(own(raw,['enabled','nodes']));
 if(raw.enabled===false){
  guard(!raw.nodes||Array.isArray(raw.nodes)&&raw.nodes.length===0);
  return {enabled:false,nodes:[]};
 }
 guard(raw.enabled===true&&Array.isArray(raw.nodes)&&raw.nodes.length>0&&raw.nodes.length<=MAX_NODES);
 const seen=new Set();
 const nodes=raw.nodes.map(input=>{
  guard(own(input,['id','grid','style','motion','breakpoints']));
  const id=input.id;
  guard(typeof id==='string'&&/^service-(?:[1-9]|1[0-2])$/.test(id)&&!seen.has(id));
  seen.add(id);
  const g=input.grid;
  guard(own(g,['colStart','colSpan','rowSpan','zIndex'])&&integer(g.colSpan,1,12));
  const rowSpan=g.rowSpan??1,zIndex=g.zIndex??1,colStart=g.colStart??null;
  guard(integer(rowSpan,1,3)&&integer(zIndex,1,5));
  if(colStart!==null)guard(integer(colStart,1,12)&&colStart+g.colSpan<=13);
  const st=input.style??{};
  guard(own(st,['paddingPx','radiusPx','glassBlurPx','shadow','align','accentOverride']));
  const paddingPx=st.paddingPx??24,radiusPx=st.radiusPx??18,glassBlurPx=st.glassBlurPx??0;
  const shadow=st.shadow??'soft',align=st.align??'left';
  guard(integer(paddingPx,0,64)&&integer(radiusPx,0,36)&&integer(glassBlurPx,0,18)&&Object.hasOwn(SHADOW,shadow)&&ALIGN.has(align));
  const accentOverride=st.accentOverride??null;
  if(accentOverride!==null)guard(typeof accentOverride==='string'&&/^#[0-9a-fA-F]{6}$/.test(accentOverride));
  const motion=input.motion??'none';
  guard(MOTION.has(motion));
  const breaks=input.breakpoints??{};
  guard(own(breaks,['tablet','mobile']));
  const viewport=(v,label)=>{
   guard(own(v,['colSpan','paddingPx','hide']));
   guard(v.hide===undefined||v.hide===false); // Services are approved business facts. Never hide them.
   const colSpan=v.colSpan??(label==='mobile'?12:6);
   const pad=v.paddingPx??Math.max(8,Math.min(48,paddingPx));
   guard([6,12].includes(colSpan)&&integer(pad,8,48));
   return {colSpan,paddingPx:pad,hide:false};
  };
  return {id,grid:{colStart,colSpan:g.colSpan,rowSpan,zIndex},
   style:{paddingPx,radiusPx,glassBlurPx,shadow,align,accentOverride:accentOverride?.toUpperCase()??null},
   motion,breakpoints:{tablet:viewport(breaks.tablet??{},'tablet'),mobile:viewport(breaks.mobile??{},'mobile')}};
 });
 return {enabled:true,nodes};
}
function snapColumnSpan(current,deltaPx,containerWidth){
 if(!integer(current,1,12)||!Number.isFinite(deltaPx)||!Number.isFinite(containerWidth)||containerWidth<=0)return current;
 return Math.min(12,Math.max(1,current+Math.round(deltaPx/(containerWidth/12))));
}
function compileGridCSS(normalized){
 if(!normalized.enabled)return '';
 const base='body[data-sbc-studio-version="2"] .sbc-v2-showcase .sbc-v2-service-grid.sbc-freeform-grid';
 const rules=[
  base+'{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-flow:row;gap:var(--sbc-studio-gap,18px);align-items:stretch}',
  base+' > [data-sbc-grid-node]{min-width:0;grid-column:span 4;grid-row:span 1;align-self:stretch;z-index:1;position:relative}',
  '@media(max-width:1024px){'+base+' > [data-sbc-grid-node]{grid-column:span 6!important;grid-row:span 1!important}}',
  '@media(max-width:640px){'+base+' > [data-sbc-grid-node]{grid-column:span 12!important;grid-row:span 1!important}}'
 ];
 for(const node of normalized.nodes){
  const id=node.id,selector=base+' > [data-sbc-grid-node="'+id+'"]';
  const g=node.grid,st=node.style,tab=node.breakpoints.tablet,mob=node.breakpoints.mobile;
  const col=g.colStart===null?'span '+g.colSpan:String(g.colStart)+' / span '+g.colSpan;
  const accent=st.accentOverride?'--v2-accent:'+st.accentOverride+';':'';
  rules.push(selector+'{grid-column:'+col+';grid-row:span '+g.rowSpan+';z-index:'+g.zIndex+
   ';padding:'+st.paddingPx+'px;border-radius:'+st.radiusPx+'px;backdrop-filter:blur('+st.glassBlurPx+
   'px);box-shadow:'+SHADOW[st.shadow]+';text-align:'+st.align+';'+accent+'}');
  rules.push('@media(max-width:1024px){'+selector+'{grid-column:span '+tab.colSpan+'!important;grid-row:span 1!important;padding:'+tab.paddingPx+'px}}');
  rules.push('@media(max-width:640px){'+selector+'{grid-column:span '+mob.colSpan+'!important;grid-row:span 1!important;padding:'+mob.paddingPx+'px}}');
  if(node.motion==='hover-lift')rules.push('@media(hover:hover) and (prefers-reduced-motion:no-preference){'+selector+':hover{transform:translate3d(0,-5px,0);transition:transform .2s ease}}');
  if(node.motion==='fade-up')rules.push('@media(prefers-reduced-motion:no-preference){'+selector+'{animation:sbc-grid-fade-up .45s ease both}}');
  if(node.motion==='scale-in')rules.push('@media(prefers-reduced-motion:no-preference){'+selector+'{animation:sbc-grid-scale-in .45s ease both}}');
 }
 rules.push('@keyframes sbc-grid-fade-up{from{opacity:.96;transform:translate3d(0,9px,0)}to{opacity:1;transform:translate3d(0,0,0)}}');
 rules.push('@keyframes sbc-grid-scale-in{from{opacity:.96;transform:scale(.985)}to{opacity:1;transform:scale(1)}}');
 rules.push('@media(prefers-reduced-motion:reduce){'+base+' > [data-sbc-grid-node]{animation:none!important;transition:none!important;transform:none!important;backdrop-filter:none!important}}');
 return '\n/* SBC opt-in, owner-verified 12-column service composition */\n'+rules.join('\n')+'\n';
}
function applyGridToPrivateBundle(bundle,raw){
 const grid=normalizeGrid(raw);
 if(!grid.enabled)return bundle; // No output changes to legacy websites until explicit opt-in.
 guard(record(bundle)&&record(bundle.files)&&typeof bundle.files['index.html']==='string'&&typeof bundle.files['styles.css']==='string');
 let html=bundle.files['index.html'];
 const start=html.indexOf('<section class="sbc-v2-showcase"');
 const end=start===-1?-1:html.indexOf('</section>',start);
 if(start<0||end<0)throw Error('STUDIO_GRID_SERVICE_SECTION_MISSING');
 let section=html.slice(start,end+10),count=0;
 const mark='<article class="sbc-v2-tile"';
 section=section.replace(/<article class="sbc-v2-tile"/g,()=>{
  count+=1;
  return mark+' data-sbc-grid-node="service-'+count+'"';
 });
 for(const node of grid.nodes){
  if(Number(node.id.slice(8))>count)throw Error('STUDIO_GRID_UNKNOWN_SERVICE');
 }
 if(count===0||count>12)throw Error('STUDIO_GRID_SERVICE_SECTION_MISSING');
 if(!section.includes('<div class="sbc-v2-service-grid">'))throw Error('STUDIO_GRID_SERVICE_SECTION_MISSING');
 section=section.replace('<div class="sbc-v2-service-grid">','<div class="sbc-v2-service-grid sbc-freeform-grid" data-sbc-grid-12="true">');
 html=html.slice(0,start)+section+html.slice(end+10);
 return {...bundle,files:{...bundle.files,'index.html':html,'styles.css':bundle.files['styles.css']+compileGridCSS(grid)},publicationReady:false};
}
module.exports={normalizeGrid,snapColumnSpan,compileGridCSS,applyGridToPrivateBundle};
