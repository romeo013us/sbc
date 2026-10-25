'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MARKER='SBC_V6636_CANONICAL_SHELL_CSS_BUNDLE';
function apply(root){
 const pub=path.join(root,'public'),mirror=path.join(root,'browser_public'),entry=path.join(pub,'index.html');
 if(!fs.existsSync(entry)||!fs.existsSync(mirror))throw Error(MARKER+': missing public/browser_public');
 let html=fs.readFileSync(entry,'utf8');
 if(html.includes('id="sbc-v6636-canonical-styles"'))throw Error(MARKER+': already applied');
 const tag=/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi;
 const tags=[...html.matchAll(tag)];
 if(tags.length<60||tags.length>90)throw Error(MARKER+': unexpected stylesheet count '+tags.length);
 const sources=[],seen=new Set();
 for(const m of tags){
  const href=m[0].match(/\bhref=(["'])(.*?)\1/i)?.[2];
  if(!href||!href.startsWith('/')||href.includes('..'))throw Error(MARKER+': invalid CSS asset '+href);
  const local=href.split('?')[0].split('#')[0];
  if(!/^\/[A-Za-z0-9/_-]+\.css$/.test(local)||seen.has(local))throw Error(MARKER+': unsafe or duplicate CSS '+local);
  seen.add(local);
  const p=path.join(pub,local.substring(1));
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())throw Error(MARKER+': missing stylesheet '+local);
  const css=fs.readFileSync(p,'utf8');
  if(/@import\b|@charset\b|@namespace\b|\burl\s*\(/i.test(css))throw Error(MARKER+': stylesheet needs individual handling '+local);
  sources.push({name:local,contents:css});
 }
 // Preserve original cascade order and all selectors; don't minify or remove styles.
 const bundle='/* '+MARKER+'; '+sources.length+' original stylesheets, in cascade order. */\n'+
   sources.map(s=>'\n/* source '+s.name+' */\n'+s.contents+'\n').join('\n');
 const sha=crypto.createHash('sha256').update(bundle).digest('hex');
 const name='sbc-v6636-styles.'+sha.slice(0,16)+'.css';
 fs.writeFileSync(path.join(pub,name),bundle);
 let inserted=false;
 html=html.replace(tag,()=>{
  if(inserted)return '';
  inserted=true;
  return '<link id="sbc-v6636-canonical-styles" rel="stylesheet" href="/'+name+'" data-sbc-v6636="'+sha+'">';
 });
 if(!inserted||(html.match(/rel=["']stylesheet["']/gi)||[]).length!==1)throw Error(MARKER+': inconsistent bundled HTML');
 // Canonicalize the secondary entrypoint, whose old HTML contains file:///mnt/data/war_test paths.
 // Copy only static public resources, never server credentials, runtime data or backups.
 function copyStatic(src,dst){
  fs.mkdirSync(dst,{recursive:true});
  for(const e of fs.readdirSync(src,{withFileTypes:true})){
   const a=path.join(src,e.name),b=path.join(dst,e.name);
   if(e.isDirectory())copyStatic(a,b);
   else if(e.isFile())fs.copyFileSync(a,b);
   else throw Error(MARKER+': unsafe public asset '+a);
  }
 }
 fs.writeFileSync(entry,html);
 copyStatic(pub,mirror);
 for(const dir of [pub,mirror]){
  const sw=path.join(dir,'sw.js');
  if(!fs.existsSync(sw))throw Error(MARKER+': no service worker '+dir);
  const old=fs.readFileSync(sw,'utf8');
  if(!/const CACHE=['"][^'"]+['"]/.test(old))throw Error(MARKER+': unknown SW cache declaration');
  fs.writeFileSync(sw,old.replace(/const CACHE=['"][^'"]+['"]/,"const CACHE='sbc-static-v66-36-canonical-shell'"));
  const copied=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  if(copied.includes('file:///')||copied.includes('/sbc-lead-import-v6541.js'))throw Error(MARKER+': legacy asset or removed importer returned');
  if((copied.match(/rel=["']stylesheet["']/gi)||[]).length!==1)throw Error(MARKER+': multiple stylesheet requests in '+dir);
 }
 return {marker:MARKER,stylesheetsBefore:sources.length,stylesheetsAfter:1,canonicalAssetHash:sha,mirroredEntrypoints:true,
  preservesCascade:true,keepsJavaScriptOrder:true,sourceSafetyControlsUnchanged:true,databaseWrites:false};
}
module.exports={apply,MARKER};