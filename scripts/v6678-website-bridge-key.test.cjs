'use strict';
// No GoDaddy calls, production credentials, HTTP writes, or real customer data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const bridge=require('../enterprise/v6660-website-bridge.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6678-'));
const file=path.join(temp,'sbc-website-bridge.key');
const link=path.join(temp,'bridge-symlink.key');
const original='a'.repeat(64),different='b'.repeat(64),nowSeconds=1793140000;
let serial=0;
function signed(key=original,route='/api/web-lead'){
  const nonce=(++serial).toString(16).padStart(32,'0'),at=String(nowSeconds);
  const body=Buffer.from('{"email":"example@example.invalid"}','utf8');
  const host='sbcmia.com',method='POST',signature=bridge.signature({key,host,method,path:route,at,nonce,body});
  return {headers:{
    'x-sbc-website-host':host,
    'x-sbc-website-timestamp':at,
    'x-sbc-website-nonce':nonce,
    'x-sbc-website-signature':signature
  },method,path:route,rawBody:body};
}
try{
  assert(!bridge.PRIVATE_BRIDGE_KEY_FILE.includes('/public/'));
  assert(!bridge.PRIVATE_BRIDGE_KEY_FILE.includes('/browser_public/'));
  fs.writeFileSync(file,original+'\n',{mode:0o600});
  fs.chmodSync(file,0o600);
  for(let i=1;i<=3;i++){
    assert.equal(bridge.resolveBridgeKey(undefined,file),original);
    assert.equal(bridge.verify(signed(),{key:undefined,keyFile:file,nowSeconds}).ok,true,'valid private file authorizes signed lead');
    assert.equal(bridge.verify(signed(original,'/api/portal/login'),{key:'',keyFile:file,nowSeconds}).ok,true,'portal request uses same credential');
    assert.equal(bridge.resolveBridgeKey(different,file),different,'nonempty env has precedence');
    assert.equal(bridge.verify(signed(different),{key:different,keyFile:file,nowSeconds}).ok,true,'configured env path works');
    assert.equal(bridge.verify(signed(original),{key:'short',keyFile:file,nowSeconds}).code,'SITE_BRIDGE_NOT_CONFIGURED','bad explicit key must not fall back');
    assert.equal(bridge.verify(signed(different),{key:undefined,keyFile:file,nowSeconds}).code,'SITE_BRIDGE_SIGNATURE_INVALID','wrong key is rejected');
    fs.chmodSync(file,0o644);
    assert.equal(bridge.verify(signed(),{key:undefined,keyFile:file,nowSeconds}).code,'SITE_BRIDGE_NOT_CONFIGURED','world-readable credential refused');
    fs.chmodSync(file,0o600);
    fs.rmSync(file);
    fs.symlinkSync(path.join(temp,'missing-target'),link);
    assert.equal(bridge.resolveBridgeKey(undefined,link),null,'credential symlinks rejected');
    fs.rmSync(link);
    assert.equal(bridge.verify(signed(),{key:undefined,keyFile:file,nowSeconds}).code,'SITE_BRIDGE_NOT_CONFIGURED','missing file refuses requests');
    fs.writeFileSync(file,'not-a-valid-key\n',{mode:0o600});
    assert.equal(bridge.resolveBridgeKey(undefined,file),null,'weak key refused');
    fs.writeFileSync(file,original+'\n',{mode:0o600});
    console.log('[SBC V6678] PASS '+i+'/3: persistent private key, auth precedence, portal parity, fail-closed file policy');
  }
  const snapshot=fs.readFileSync(file,'utf8');
  assert.equal(snapshot,original+'\n','audit is read-only and leaves credential unchanged');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
