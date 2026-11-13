'use strict';
/* V66 source-locked browser bundles.
 * Each original V56 controller is a self-executing isolated IIFE. Preserve
 * relative order, browser APIs and Office Box inline setup, with per-script
 * exception isolation so a broken legacy controller cannot suppress later ones.
 * Never concatenate scripts containing unwrapped top-level declarations.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const GROUPS=Object.freeze({
 'growth-rail':Object.freeze([
  'v56221-revenue-command.js',
  'v56230-destination-autopilot.js',
  'v56240-growth-hardening.js',
  'v56-autonomous.js'
 ]),
 'experience-rail':Object.freeze([
  'v562-experience.js','v562-next.js','v562-executive.js',
  'v563-maturity.js','v564-guardian.js','v565-operational.js',
  'v566-customer360.js'
 ]),
 'legacy-growth-controls':Object.freeze([
  'v37-kim-automation.js',
  'v38-kim-growth.js',
  'v391-commercial-readiness.js'
 ]),
 'legacy-enterprise-controls':Object.freeze([
  'v43-edge-suite.js',
  'v43-4-resilience-brand.js',
  'v43-7-sales-velocity.js',
  'kim-deep-ops.js',
  'kim-founder-fortress.js'
 ])
});
const digest=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
// Modern isolated account/profile scripts added to the existing checked-in V66 bundle set.
const ACCOUNT_SCRIPTS=Object.freeze(['/sbc-lead-profile-v1.js','/sbc-command-center-focus-v1.js','/sbc-account-success-v1.js','/sbc-account-portfolios-v1.js']);
function onlyIIFE(file,source){
 const noComments=source.replace(/^\s*(?:(?:\/\*[\s\S]*?\*\/)|(?:\/\/[^\n]*))\s*/gm,'').trimStart();
 if(!/^\(\s*(?:function\s*\(|\(\s*\)\s*=>)/.test(noComments) ||
   !/\}\)\s*\(\s*\)\s*;?\s*$/.test(source.trim()) ||
   /\b(?:document\.currentScript|importScripts|module\.exports|require\s*\(|\bimport\s*\(|\bexport\s+(?:default|\{))/.test(source)){
  throw Error('[SBC V66 JS] Unsafe non-isolated module or dynamic script source: '+file);
 }
}
function compile(root=path.resolve(__dirname,'..'),group){
 const files=GROUPS[group];
 if(!files)throw Error('[SBC V66 JS] Unknown script bundle: '+String(group));
 const sections=[];
 for(const file of files){
  const source=fs.readFileSync(path.join(root,'public',file),'utf8');
  onlyIIFE(file,source);
  sections.push(
   '/* BEGIN '+file+' */\n'+
   'try {\n'+source+(source.endsWith('\n')?'':'\n')+
   '} catch (sbcBundleError) {\n'+
   '  console.error("[SBC V66 JS] Legacy controller failed: '+file+'", sbcBundleError);\n'+
   '}\n/* END '+file+' */\n'
  );
 }
 const content='/* SBC V66 '+group+' · checked-in scripts retain startup order */\n'+sections.join(';\n');
 const hash=digest(content),filename='sbc-v66-'+group+'.'+hash.slice(0,16)+'.js';
 return {filename,content,hash,files};
}
function verify(root=path.resolve(__dirname,'..')){
 const values=Object.keys(GROUPS).map(g=>compile(root,g));
 const inputs=values.flatMap(v=>v.files);
 if(new Set(inputs).size!==inputs.length)throw Error('[SBC V66 JS] Component listed twice');
 for(const dir of ['public','browser_public']){
  const html=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  const tags=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
  const expectedTags=92+ACCOUNT_SCRIPTS.length;
  if(tags.length!==expectedTags)throw Error('[SBC V66 JS] Expected '+expectedTags+' external script tags, got '+tags.length+' in '+dir);
  for(const name of ACCOUNT_SCRIPTS)if(tags.filter(t=>t.split('?')[0]===name).length!==1)throw Error('[SBC V66 JS] Account workspace script not loaded exactly once: '+name);
  for(const value of values){
   const file=path.join(root,dir,value.filename);
   if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==value.content)throw Error('[SBC V66 JS] Missing/stale JS bundle: '+dir+'/'+value.filename);
   if(tags.filter(t=>t.split('?')[0]==='/'+value.filename).length!==1)throw Error('[SBC V66 JS] Bundle not loaded once: '+value.filename);
   for(const original of value.files)if(tags.some(t=>t.split('?')[0]==='/'+original))throw Error('[SBC V66 JS] Duplicate original module request: '+original);
  }
  const inline=html.indexOf("window.__SBC_OFFICE_BOX_URL='/office-box'");
  const first=html.indexOf('/'+values[0].filename),second=html.indexOf('/'+values[1].filename);
  if(!(first>=0&&inline>first&&second>inline))throw Error('[SBC V66 JS] Office Box config startup order changed');
 }
 return {ok:true,originalFiles:inputs.length,bundleCount:values.length,
  scriptRequestsSaved:inputs.length-values.length,
  bundles:values.map(x=>({file:x.filename,sha256:x.hash,components:x.files.length}))};
}
if(require.main===module){
 try{
  const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'--check';
  if(mode==='--write'){
   for(const group of Object.keys(GROUPS)){
    const {filename,content}=compile(root,group);
    for(const dir of ['public','browser_public'])fs.writeFileSync(path.join(root,dir,filename),content);
   }
  }else if(mode!=='--check')throw Error('Use --check or --write');
  console.log('[SBC V66 JS BUNDLE] '+JSON.stringify(verify(root)));
 }catch(err){console.error(err?.stack||err);process.exitCode=1;}
}
module.exports={GROUPS,compile,verify};
