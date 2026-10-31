'use strict';
/*
 * SBC V66.11 — reject mixed or tampered staged GoDaddy ZIPs before runtime state opens.
 * This is a source-artifact integrity check, not an authentication/signature system.
 * The legacy pinned release (no staged inventory) is left unchanged.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const shaPattern=/^[0-9a-f]{64}$/;
function verifyStagedInventory(root,identity){
  const filename='SBC-STAGED-INVENTORY.json';
  const inventoryPath=path.join(root,filename);
  const hasFile=fs.existsSync(inventoryPath);
  const hasAnchor=Object.prototype.hasOwnProperty.call(identity||{},'stagedInventorySha256');
  if(!hasFile&&!hasAnchor)return {legacy:true,checked:0};
  if(!hasFile||!hasAnchor||!shaPattern.test(String(identity.stagedInventorySha256||'')))
    throw Error('[SBC STAGED INVENTORY] missing inventory or release identity anchor '+
      '(file='+hasFile+' anchor='+hasAnchor+' hashValid='+
      shaPattern.test(String(identity?.stagedInventorySha256||''))+
      ' source='+String(identity?.sourceCommit||'unknown').slice(0,12)+')');
  const original=fs.readFileSync(inventoryPath);
  if(sha256(original)!==identity.stagedInventorySha256)
    throw Error('[SBC STAGED INVENTORY] inventory checksum mismatch');
  const manifest=JSON.parse(original.toString('utf8'));
  if(manifest.schema!==1||manifest.sourceCommit!==identity.sourceCommit||
     !manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))
    throw Error('[SBC STAGED INVENTORY] incompatible manifest');
  const required=['server.js','package.json','public/app.js','public/index.html',
    'enterprise/financial-governor-v56-25-3.js','enterprise/sbc-margin-policy.cjs',
    'sbc-godaddy-flat-entrypoint.cjs','scripts/v6611-verify-stage-inventory.cjs'];
  for(const name of required)if(!manifest.files[name])throw Error('[SBC STAGED INVENTORY] required asset omitted: '+name);
  let checked=0;
  for(const [name,expected] of Object.entries(manifest.files)){
    if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(x=>x==='..'||x==='.')||
       !shaPattern.test(String(expected)))
      throw Error('[SBC STAGED INVENTORY] invalid path or checksum');
    const full=path.join(root,name);
    const stat=fs.lstatSync(full);
    if(!stat.isFile())throw Error('[SBC STAGED INVENTORY] not a regular file: '+name);
    if(sha256(fs.readFileSync(full))!==expected)
      throw Error('[SBC STAGED INVENTORY] asset checksum mismatch: '+name);
    checked++;
  }
  if(checked<100)throw Error('[SBC STAGED INVENTORY] suspiciously incomplete release: '+checked);
  return {legacy:false,checked,sourceCommit:manifest.sourceCommit};
}
if(require.main===module){
  const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
  const identity=JSON.parse(fs.readFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
  const result=verifyStagedInventory(root,identity);
  console.log('[SBC STAGED INVENTORY] PASS '+JSON.stringify(result));
}
module.exports={verifyStagedInventory};
