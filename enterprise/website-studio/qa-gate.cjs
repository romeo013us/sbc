'use strict';
// Conservative static contract for Studio-generated HTML, NOT a sanitizer or
// browser sandbox. Browser/accessibility/security/hosting/consent remain separate.
const path=require('node:path').posix;
const MAX_FILES=256,MAX_HTML=512*1024,MAX_TOTAL=16*1024*1024;
const REQUIRED=['index.html','styles.css','site.js','design-tokens.json','layout-ast.json'];
const SAFE_PATH=/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;
const own=(o,k)=>Object.hasOwn(o,k);
function safePath(s){return typeof s==='string'&&s.length<=240&&SAFE_PATH.test(s)&&s.split('/').every(p=>p!=='.'&&p!=='..');}
// Only intended for our generated markup. Scan quoted attributes without
// treating a > inside a quoted value as the end of a tag.
function tags(html){
 const out=[];
 const input=html.replace(/<!--[\s\S]*?-->/g,'');
 const re=/<([a-z][a-z0-9:-]*)(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
 for(const m of input.matchAll(re)){
  const attrs=Object.create(null),duplicates=[];
  for(const a of m[2].matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)){
   const key=a[1].toLowerCase();if(own(attrs,key))duplicates.push(key);
   attrs[key]=a[2]??a[3]??a[4]??'';
  }
  out.push({name:m[1].toLowerCase(),attrs,duplicates});
 }
 return out;
}
function checkPrivateBundle(bundle){
 const issues=[],checks=[],pages=[];
 const files=bundle?.files;
 const record=(label,good,code)=>{checks.push({label,passed:!!good});if(!good&&!issues.includes(code))issues.push(code);};
 const validFiles=files&&typeof files==='object'&&!Array.isArray(files);
 record('Required private build artifacts',validFiles&&REQUIRED.every(name=>own(files,name)&&typeof files[name]==='string'&&files[name].length>0),'MISSING_STATIC_FILE');
 record('Never claim publication readiness',bundle?.publicationReady===false,'PUBLICATION_GUARD_FAILED');
 if(!validFiles)return {passed:false,publicationReady:false,checks,issues,pages};
 const names=Object.keys(files);
 record('Safe relative bundle paths',names.every(safePath),'UNSAFE_BUNDLE_PATH');
 const htmlNames=names.filter(n=>/\.html$/i.test(n));
 const size=names.reduce((n,k)=>n+(typeof files[k]==='string'?Buffer.byteLength(files[k],'utf8'):0),0);
 const bounded=names.length<=MAX_FILES&&size<=MAX_TOTAL&&htmlNames.every(n=>typeof files[n]==='string'&&Buffer.byteLength(files[n],'utf8')<=MAX_HTML);
 record('Bounded static inspection',bounded,'BUNDLE_INSPECTION_LIMIT');
 const css=typeof files['styles.css']==='string'?files['styles.css']:'';
 if(!bounded)return {passed:false,publicationReady:false,checks,issues,pages};
 record('Responsive layout stylesheet',/@media\s*\(max-width\s*:\s*\d+px\)/.test(css),'RESPONSIVE_CONTRACT_MISSING');
 record('No remote stylesheet imports',!/@import\b/i.test(css),'REMOTE_OR_MISSING_ASSET');
 const parsed=new Map();
 for(const name of htmlNames){
  const html=files[name],elements=tags(html);
  const ids=elements.filter(t=>own(t.attrs,'id')).map(t=>t.attrs.id);
  parsed.set(name,{html,elements,ids:new Set(ids),duplicateIds:ids.length!==new Set(ids).size});
 }
 function localTarget(from,href){
  if(!href||/[\u0000-\u0020\\]/.test(href)||href.includes('&')||href.includes('%')||href.includes('?'))return null;
  const pieces=href.split('#');if(pieces.length>2)return null;
  const [file,fragment]=pieces;
  if(file&&!safePath(file))return null;
  const resolved=file?path.join(path.dirname(from),file):from;
  if(!safePath(resolved))return null;
  return {file:resolved,fragment};
 }
 for(const [name,info] of parsed){
  const {html,elements,ids,duplicateIds}=info;
  const result={path:name,passed:true,checks:[],issues:[],localLinks:0,externalLinks:0,externalImages:0};
  const check=(label,good,code)=>{result.checks.push({label,passed:!!good});if(!good){result.passed=false;if(!result.issues.includes(code))result.issues.push(code);}};
  const metas=elements.filter(t=>t.name==='meta');
  const robots=metas.filter(t=>String(t.attrs.name||'').toLowerCase()==='robots');
  check('Private indexing disabled',robots.length===1&&robots[0].attrs.content==='noindex,nofollow,noarchive','PRIVATE_INDEXING_UNSAFE');
  check('Responsive viewport',metas.some(t=>String(t.attrs.name||'').toLowerCase()==='viewport'),'RESPONSIVE_CONTRACT_MISSING');
  const links=elements.filter(t=>t.name==='link');
  const scripts=elements.filter(t=>t.name==='script');
  check('Local CSS and JS only',links.some(t=>t.attrs.rel==='stylesheet'&&t.attrs.href==='styles.css')&&links.every(t=>t.attrs.rel==='stylesheet'&&t.attrs.href==='styles.css')&&scripts.length===1&&scripts[0].attrs.src==='site.js'&&REQUIRED.slice(1,3).every(n=>typeof files[n]==='string'&&files[n].length>0),'REMOTE_OR_MISSING_ASSET');
  const inlineScript=/<script\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/script\s*>/gi;
  const inlineBodies=[...html.matchAll(inlineScript)];
  const unsafe=elements.some(t=>t.duplicates.length||Object.keys(t.attrs).some(k=>/^on/i.test(k)||k==='srcdoc'||k==='formaction'||k==='ping')||
   ['iframe','frame','object','embed','base'].includes(t.name)||
   (t.name==='meta'&&own(t.attrs,'http-equiv')&&String(t.attrs['http-equiv']).toLowerCase()==='refresh')||
   (t.name==='form'&&(own(t.attrs,'action')||own(t.attrs,'method')))||
   (t.name==='script'&&t.attrs.src!=='site.js'));
  check('Private preview form and executable markup',!unsafe&&inlineBodies.length===scripts.length&&inlineBodies.every(m=>!m[1].trim()),'UNSAFE_FORM_OR_SCRIPT');
  let anchorsOK=!duplicateIds,pageLinksOK=true,assetsOK=true;
  for(const t of elements){
   const a=t.attrs;
   if(t.name==='a'&&own(a,'href')){
    const href=a.href;
    if(/^(?:https:\/\/|mailto:|tel:)/i.test(href)){result.externalLinks++;continue;}
    const dest=localTarget(name,href);result.localLinks++;
    if(href.startsWith('#')){if(!dest||!dest.fragment||!ids.has(dest.fragment))anchorsOK=false;}
    else if(!dest||!parsed.has(dest.file)||(dest.fragment!==undefined&&(!dest.fragment||!parsed.get(dest.file).ids.has(dest.fragment))))pageLinksOK=false;
   }
   if(t.name==='img'&&own(a,'src')){
    if(/^https:\/\//i.test(a.src)){result.externalImages++;continue;} // existing owner-confirmed photo contract, not license proof
    const dest=localTarget(name,a.src);
    if(!dest||dest.fragment!==undefined||!own(files,dest.file)||!files[dest.file])assetsOK=false;
   }
  }
  check('No broken internal anchors or duplicate IDs',anchorsOK,'BROKEN_ANCHOR_OR_DUPLICATE_ID');
  check('Every local page and fragment exists',pageLinksOK,'BROKEN_PAGE_LINK');
  check('Referenced local image assets exist',assetsOK,'REMOTE_OR_MISSING_ASSET');
  for(const code of result.issues)if(!issues.includes(code))issues.push(code);
  pages.push(result);
 }
 record('All generated HTML pages pass static preflight',pages.length>0&&pages.every(p=>p.passed),'PAGE_PREFLIGHT_FAILED');
 return {passed:issues.length===0,publicationReady:false,checks,issues,pages,scope:'GENERATED_HTML_STATIC_PREFLIGHT_ONLY'};
}
module.exports={checkPrivateBundle};
