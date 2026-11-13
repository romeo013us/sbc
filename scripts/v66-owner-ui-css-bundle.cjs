'use strict';
/* V66 build-time CSS compactor.
   Merge ONLY six consecutive leaf stylesheets after the existing owner inline
   style blocks. Preserve byte order, selectors, @media and specificity. No minify,
   no CSSOM mutation, no runtime transformer, no customer data or network access.
   Compiled artifacts are committed under BOTH public and browser_public to
   preserve the currently verified GoDaddy release/publisher contract.
*/
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const COMPONENTS=Object.freeze([
 'sbc-global-contrast-rescue-20261106.css',
 'sbc-manual-dialer-v6696.css',
 'sbc-owner-employee-switch-v6697.css',
 'sbc-executive-ui-v1.css',
 'sbc-website-revenue-shortcuts-v1.css',
 'sbc-website-production-contrast-v1.css'
]);
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
function compile(root=path.join(__dirname,'..')){
 const pieces=[];
 for(const file of COMPONENTS){
  const source=fs.readFileSync(path.join(root,'public',file),'utf8');
  if(/@(?:import|charset|namespace)\b|url\s*\(/i.test(source))
   throw Error('[SBC V66 CSS] unsupported @import/@charset/@namespace or relative url in '+file);
  pieces.push('/* '+file+' */\n'+source+(source.endsWith('\n')?'':'\n')+'\n');
 }
 const content='/* SBC V66 OWNER UI COMPILED · SOURCE ORDER MUST REMAIN UNCHANGED */\n'+pieces.join('');
 const digest=hash(content),filename='sbc-v66-owner-ui-core.'+digest.slice(0,16)+'.css';
 return {filename,content,hash:digest,components:COMPONENTS.length};
}
function verify(root=path.join(__dirname,'..'),opts={}){
 const expected=compile(root);
 for(const dir of ['public','browser_public']){
  const file=path.join(root,dir,expected.filename);
  if(!fs.existsSync(file))throw Error('[SBC V66 CSS] stale or missing compiled bundle '+file);
  const raw=fs.readFileSync(file,'utf8');
  if(raw!==expected.content||hash(raw)!==expected.hash)
   throw Error('[SBC V66 CSS] bundle checksum mismatch / stale compiled file '+dir);
  if(opts.checkIndex===false)continue;
  const page=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  const links=[...page.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)].map(m=>m[0]);
  const ownerFocusCss='/sbc-command-center-focus-v1.css';
  if(links.length!==6)throw Error('[SBC V66 CSS] Expected six stylesheet requests including focused workspace styling, got '+links.length+' in '+dir);
  if(links.filter(x=>x.includes('href="'+ownerFocusCss+'?')).length!==1)throw Error('[SBC V66 CSS] Owner focus stylesheet not present exactly once in '+dir);
  const last=links.at(-1)||'';
  if(!last.includes('/'+expected.filename))throw Error('[SBC V66 CSS] owner UI bundle missing from '+dir+' index');
  for(const original of COMPONENTS)if(page.includes('href="/'+original))
   throw Error('[SBC V66 CSS] redundant component stylesheet still loaded: '+original);
  for(const marker of [
   'data-sbc-contrast-rescue="global"',
   'data-sbc-executive-ui="global"',
   'data-sbc-website-spotlight="true"',
   'data-sbc-website-contrast="scoped"'
  ])if(!last.includes(marker))throw Error('[SBC V66 CSS] legacy asset capability marker lost: '+marker);
 }
 return {ok:true,components:COMPONENTS.length,stylesheetRequestsSaved:COMPONENTS.length-1,
  bundleSha256:expected.hash,filename:expected.filename};
}
if(require.main===module){
 try{
  const mode=process.argv[2]||'--check',root=path.join(__dirname,'..');
  if(mode==='--write'){
   const {filename,content}=compile(root);
   for(const dir of ['public','browser_public'])fs.writeFileSync(path.join(root,dir,filename),content);
   console.log('[SBC V66 CSS] wrote '+filename);
  }else if(mode!=='--check')throw Error('Mode must be --check or --write');
  console.log('[SBC V66 CSS] '+JSON.stringify(verify(root)));
 }catch(e){console.error(e?.stack||e);process.exitCode=1}
}
module.exports={COMPONENTS,compile,verify};
