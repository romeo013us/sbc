'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {GROUPS,compile,verify}=require('../scripts/v66-safe-js-bundles.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const htmlScripts=html=>[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
const jsTag=name=>'<script src="/'+name+'?v=66.0.13-profile-stability"></script>';

test('index replaces 11 old synchronous script tags with 2 version-hashed bundles and keeps Office Box configuration position',()=>{
 for(const dir of ['public','browser_public']){
  const page=read(dir+'/index.html');
  const tags=htmlScripts(page);
  assert.equal(tags.length,98,'107 => 98 external JS requests');
  const bundles=Object.keys(GROUPS).map(group=>compile(root,group).filename);
  for(const file of bundles)assert(tags.some(t=>t.startsWith('/'+file)),file+' must load');
  for(const files of Object.values(GROUPS)){
   for(const file of files)assert(!tags.some(t=>t.split('?')[0]==='/'+file),'old script request still active: '+file);
  }
  const first=page.indexOf('/'+bundles[0]),second=page.indexOf('/'+bundles[1]);
  const config=page.indexOf("window.__SBC_OFFICE_BOX_URL='/office-box'");
  assert(first>0&&config>first&&second>config,'Office Box configuration order must remain');
  assert(!page.includes('<script src="/v562-experience.js?'),'Bundled source must not load twice');
 }
});

test('bundles preserve exact source ordering, source integrity and browser mirror parity',()=>{
 for(const group of Object.keys(GROUPS)){
  const {filename,content,hash}=compile(root,group);
  assert.equal(filename,'sbc-v66-'+group+'.'+hash.slice(0,16)+'.js');
  for(const dir of ['public','browser_public'])assert.equal(read(dir+'/'+filename),content);
  const positions=GROUPS[group].map(file=>content.indexOf('/* BEGIN '+file+' */'));
  assert(positions.every((value,index)=>value>=0&&(index===0||value>positions[index-1])));
  for(const file of GROUPS[group])assert(content.includes(read('public/'+file).trimEnd()));
 }
 const result=verify(root);
 assert.equal(result.scriptRequestsSaved,9);
 assert.equal(result.originalFiles,11);
});

test('real scripts expose identical browser globals and event registrations when loaded separately or bundled',()=>{
 const boot=()=>{
  const events=[],logs=[];
  const env={console:{log:()=>{},warn:()=>{},error:(...a)=>logs.push(a)},
   document:{
    body:{dataset:{},classList:{contains:()=>false}},
    documentElement:{},
    addEventListener:(...a)=>events.push('document:'+a[0]),
    querySelector:()=>null,getElementById:()=>null
   },
   history:{pushState:()=>true},
   MutationObserver:class {observe(){events.push('mutation:observe')}disconnect(){}},
   setTimeout:(fn,ms)=>{events.push('timeout:'+ms);return 1;},
   clearTimeout:()=>{},
   fetch:()=>{throw Error('Unexpected fetch before customer intent')},
   CustomEvent:class {},
   URL,Set,Map,Intl,Array,Object,Date,Promise
  };
  env.window=env;
  env.addEventListener=(name)=>events.push('window:'+name);
  const ctx=vm.createContext(env);
  return {ctx,events,logs};
 };
 const isolated=boot(),bundled=boot();
 for(const group of Object.keys(GROUPS)){
  for(const file of GROUPS[group])vm.runInContext(read('public/'+file),isolated.ctx,{filename:file,timeout:1500});
  vm.runInContext(compile(root,group).content,bundled.ctx,{filename:'bundle:'+group,timeout:1500});
 }
 const keys=ctx=>Object.keys(ctx).filter(k=>/^(SBC|Sbc|sbcV|sbc)/.test(k)).sort();
 assert.deepEqual(keys(bundled.ctx),keys(isolated.ctx));
 for(const name of keys(isolated.ctx)){
  const a=isolated.ctx[name],b=bundled.ctx[name];
  assert.equal(typeof b,typeof a,'public interface type: '+name);
  if(a&&typeof a==='object')assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),'public API: '+name);
 }
 assert.deepEqual(bundled.events,isolated.events,'DOM observers, handlers and timers retain registration sequence');
 assert.deepEqual(bundled.logs,[]);
 assert.deepEqual(isolated.logs,[]);
});

test('compiler refuses scripts with unsafe top-level assumptions or external asset dependencies',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v66-js-bundle-'));
 try{
  fs.mkdirSync(path.join(temp,'public'));
  for(const [group,files] of Object.entries(GROUPS)){
   for(const f of files)fs.copyFileSync(path.join(root,'public',f),path.join(temp,'public',f));
  }
  assert.doesNotThrow(()=>compile(temp,Object.keys(GROUPS)[0]));
  const file=GROUPS[Object.keys(GROUPS)[0]][0];
  fs.writeFileSync(path.join(temp,'public',file),'let dangerousTopLevel=1;');
  assert.throws(()=>compile(temp,Object.keys(GROUPS)[0]),/IIFE|module|unsafe/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
