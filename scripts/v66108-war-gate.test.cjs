'use strict';
/* SBC V66.108 — red/green/retake tests for the offline war gate itself. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const audit=require('./predeploy-war-test.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-war-gates-'));
const put=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,v)};
try{
 put('app.js','requ'+'ire('+JSON.stringify('./missing-module.js')+');');
 assert.equal(audit.auditModules(root).ok,false,'must reject unresolved active require');
 put('missing-module.js',"module.exports=true;\n");
 assert.equal(audit.auditModules(root).ok,true,'fix -> passes');
 put('public/index.html','<script src="/missing-script.js"></script>');
 assert.equal(audit.auditAssets(root,['public/index.html']).ok,false,'must fail missing browser asset');
 put('public/missing-script.js','console.log("synthetic");');
 assert.equal(audit.auditAssets(root,['public/index.html']).ok,true,'browser asset repaired');
 put('server.js','synthetic release');
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
 const identity={sourceCommit:'fixed-sha',sourceFingerprint:'fingerprint',serverSha256:hash};
 const receipt={sourceCommit:'fixed-sha',sourceFingerprint:'fingerprint',artifactSha256:hash,buildBranch:'a-sbc-master',deployBranch:'a-sbc-master'};
 put('SBC-FLAT-RELEASE-IDENTITY.json',JSON.stringify(identity));
 put('SBC-DEPLOY-RECEIPT.json',JSON.stringify(receipt));
 assert.equal(audit.auditRelease(root).ok,true,'matching current receipt should pass');
 put('server.js','tampered synthetic release');
 assert.equal(audit.auditRelease(root).ok,false,'tampered compiled server must fail');
 put('server.js','synthetic release');
 assert.equal(audit.auditRelease(root).ok,true,'restore and re-check should pass');
 const real=path.resolve(__dirname,'..');
 const sourceDeps=audit.auditModules(real);
 assert.equal(sourceDeps.ok,true,'active source must resolve: '+sourceDeps.missing.slice(0,30).join(' | '));
 assert.equal(audit.auditAssets(real).ok,true,'actual employee assets exist');
 assert.equal(audit.auditRelease(real).ok,true,'verified GitHub candidate receipt must match server');
 // Audit the exact shipped Square wiring in isolation, then deliberately corrupt each boundary.
 const squarePath='routes/sbc-square-webhook-v1.cjs';
 const server=fs.readFileSync(path.join(real,'server.js'),'utf8');
 const square=fs.readFileSync(path.join(real,squarePath),'utf8');
 const squareRoot=path.join(root,'square-contract');
 const squarePut=(name,body)=>put(path.join('square-contract',name),body);
 const squarePass=()=>!audit.auditContracts(squareRoot).failed.includes('Square signed webhook');
 squarePut('server.js',server);squarePut(squarePath,square);
 assert.equal(squarePass(),true,'extracted signed webhook must pass the release contract');
 const negative=(name,file,original,changed)=>{
  assert.notEqual(changed,original,name+' fixture must change');
  squarePut(file,changed);
  assert.equal(squarePass(),false,name);
  squarePut(file,original);
 };
 negative('wrong route delegation must fail','server.js',server,server.replace('return SBC_SQUARE_WEBHOOK(req,res)','return res.sendStatus(200)'));
 negative('missing injected signature verifier must fail','server.js',server,server.replace('createSquareWebhook(()=>({squareSignatureValid,','createSquareWebhook(()=>({safeJsonParse,'));
 negative('missing constant-time comparison must fail','server.js',server,server.replace('crypto.timingSafeEqual(supplied,wanted)','supplied.equals(wanted)'));
 negative('invalid signatures must be rejected',squarePath,square,square.replace('if(!squareSignatureValid(raw,sig))','if(false)'));
 negative('durable receipt must be awaited',squarePath,square,square.replace('try{await saveData()}','try{saveData()}'));
 negative('duplicate event lookup must be present',squarePath,square,square.replace('events.find(x=>x.eventId===eventId)','null'));
 fs.unlinkSync(path.join(squareRoot,squarePath));
 assert.equal(squarePass(),false,'missing webhook module must fail closed');
 squarePut(squarePath,square);
 assert.equal(squarePass(),true,'restored contract passes');
 assert.equal(audit.auditContracts(real).ok,true,'core financial and role protections must remain wired');
 console.log('[SBC V66.108] PASS: red/green red/green replay, missing local require/assets fail, tampered deploy receipt fails, actual source contracts unchanged');
}finally{fs.rmSync(root,{recursive:true,force:true})}
