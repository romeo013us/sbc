'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');

const VERSION='1.0.0';
const ROOT=path.resolve(__dirname,'..');
const SPOOL=path.join(ROOT,'runtime-spool','self-heal');
const INCIDENTS=path.join(SPOOL,'incidents.ndjson');
const PATCHES=path.join(SPOOL,'patches');
for(const d of [SPOOL,PATCHES]){try{fs.mkdirSync(d,{recursive:true});}catch{}}

function now(){return new Date().toISOString();}
function safe(v,n=500){return String(v??'').slice(0,n);}
function hash(s){return crypto.createHash('sha256').update(String(s)).digest('hex');}
function append(file,obj){fs.appendFileSync(file,JSON.stringify({...obj,ts:now()})+'\n');}
function readJsonLines(file){try{return fs.readFileSync(file,'utf8').trim().split(/\n+/).filter(Boolean).slice(-100).map(x=>JSON.parse(x));}catch{return[];}}
function fileVersion(file){try{return String(fs.readFileSync(file,'utf8').match(/55\.\d+\.\d+/)?.[0]||'');}catch{return'';}}
function backup(file,incidentId){const target=path.join(PATCHES,`${incidentId}-${path.basename(file)}`);fs.copyFileSync(file,target);return target;}
function runCheck(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:20000});return {ok:r.status===0,stdout:safe(r.stdout,3000),stderr:safe(r.stderr,5000),code:r.status};}
function repoScan(){
  const files=['server.js','public/app.js','public/v9.js','public/v10.js','public/index.html','package.json','VERSION'].map(x=>path.join(ROOT,x));
  const findings=[];
  const versions=files.map(f=>({file:path.relative(ROOT,f),version:fileVersion(f)})).filter(x=>x.version);
  const distinct=[...new Set(versions.map(x=>x.version))];
  if(distinct.length>1) findings.push({id:'VERSION_DRIFT',severity:'LOW',description:'SBC build references are not aligned.',files:versions});
  const app=fs.existsSync(files[1])?fs.readFileSync(files[1],'utf8'):'';
  if(!app.includes('training:typeof window.sbcCanonicalTrainingView===\'function\'?window.sbcCanonicalTrainingView')) findings.push({id:'TRAINING_ROUTER_DRIFT',severity:'MEDIUM',description:'Training route is not pinned to the canonical Academy renderer.',file:'public/app.js'});
  const required=['window.sbcCanonicalTrainingView','window.sbcOpenAcademyCourse'];
  for(const needle of required) if(!app.includes(needle)) findings.push({id:'TRAINING_CANONICAL_MISSING',severity:'MEDIUM',description:`Required Academy hook missing: ${needle}`,file:'public/app.js'});
  return {version:VERSION,generatedAt:now(),ok:findings.length===0,findings,protectedFiles:['server.js','database.sql','enterprise/training-system-v2.js'],autoFixPolicy:'Only allowlisted, reversible low-risk repairs may be automatic.'};
}
function repair(findings,actor='system'){
  const results=[];
  for(const f of findings||repoScan().findings){
    const id=f.id;
    if(!['VERSION_DRIFT','TRAINING_ROUTER_DRIFT'].includes(id)){results.push({id,status:'REQUIRES_REVIEW'});continue;}
    const incidentId=`SH-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    try{
      const target=id==='TRAINING_ROUTER_DRIFT'?path.join(ROOT,'public','app.js'):path.join(ROOT,'public','index.html');
      if(!fs.existsSync(target)) throw new Error('Target file not found');
      const original=fs.readFileSync(target,'utf8');
      const backupFile=backup(target,incidentId);
      let updated=original;
      if(id==='TRAINING_ROUTER_DRIFT'){
        const rx=/training:\s*typeof window\.trainingV2View==='function'\s*\?\s*window\.trainingV2View\s*:\s*VF\('training'\)/;
        if(!rx.test(updated)) throw new Error('Expected legacy Training router pattern not found; no automatic rewrite performed.');
        updated=updated.replace(rx,"training:typeof window.sbcCanonicalTrainingView==='function'?window.sbcCanonicalTrainingView:VF('training')");
      } else {
        const targetVersion=String(fs.readFileSync(path.join(ROOT,'VERSION'),'utf8')).trim();
        const candidates=['public/index.html','package.json','public/app.js','public/v9.js','public/v10.js'];
        for(const rel of candidates){const p=path.join(ROOT,rel);if(!fs.existsSync(p))continue;const before=fs.readFileSync(p,'utf8');const after=before.replace(/55\.\d+\.\d+/g,targetVersion);if(after!==before){const b=backup(p,incidentId);fs.writeFileSync(p,after);const check=rel.endsWith('.js')?runCheck(p):{ok:true};if(!check.ok){fs.writeFileSync(p,before);throw new Error(`Syntax validation failed for ${rel}`);}results.push({file:rel,status:'PATCHED',backup:b});}}
        append(INCIDENTS,{incidentId,type:id,actor,status:'PATCHED',results});
        continue;
      }
      fs.writeFileSync(target,updated);
      const check=runCheck(target);
      if(!check.ok){fs.copyFileSync(backupFile,target);throw new Error(`Syntax validation failed: ${check.stderr}`);}
      append(INCIDENTS,{incidentId,type:id,actor,status:'PATCHED',file:target,backup:backupFile,sha256:hash(updated)});
      results.push({id,status:'PATCHED',file:path.relative(ROOT,target),backup:backupFile,syntax:check.ok});
    }catch(e){append(INCIDENTS,{incidentId,type:id,actor,status:'FAILED',error:e.message});results.push({id,status:'FAILED',error:e.message});}
  }
  return {ok:results.every(x=>x.status==='PATCHED'||x.status==='REQUIRES_REVIEW'),results,incidents:readJsonLines(INCIDENTS)};
}
function observeError(error,context={}){const incidentId=`ERR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;append(INCIDENTS,{incidentId,type:'RUNTIME_ERROR',severity:'HIGH',error:safe(error?.stack||error?.message||error,8000),context});return incidentId;}
function status(){const scan=repoScan();return {engine:'SBC Autonomous Engineering & Self-Healing',engineVersion:VERSION,mode:'observe → diagnose → patch → test → verify',automaticPolicy:'LOW-RISK_ALLOWLIST_ONLY',scan,incidents:readJsonLines(INCIDENTS).slice(-20)};}
module.exports={VERSION,repoScan,repair,observeError,status};
