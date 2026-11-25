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
// Host log scrubbers redact uninterrupted digests. Group these non-secret
// checksums so an operator can compare source and deployed bytes safely.
const displayDigest=value=>value.match(/.{1,8}/g).join(':');
const shaPattern=/^[0-9a-f]{64}$/;
function verifyStagedInventory(root,identity){
  const filename='SBC-STAGED-INVENTORY.json';
  const inventoryPath=path.join(root,filename);
  const hasFile=fs.existsSync(inventoryPath);
  const hasAnchor=Object.prototype.hasOwnProperty.call(identity||{},'stagedInventorySha256');
  if(identity?.frontendLayout==='canonical-public-v1'&&(!hasFile||!hasAnchor))throw Error('[SBC STAGED INVENTORY] canonical frontend requires anchored inventory');
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
  const layout=identity.frontendLayout??'mirrored-v1';
  const manifestLayout=manifest.frontendLayout??'mirrored-v1';
  if(!['mirrored-v1','canonical-public-v1'].includes(layout)||!['mirrored-v1','canonical-public-v1'].includes(manifestLayout))
    throw Error('[SBC STAGED INVENTORY] frontend layout invalid');
  if(layout!==manifestLayout)throw Error('[SBC STAGED INVENTORY] frontend layout mismatch');
  if(layout==='canonical-public-v1'){
    if(Object.keys(manifest.files).some(n=>n==='browser_public'||n.startsWith('browser_public/')))
      throw Error('[SBC STAGED INVENTORY] mixed frontend layout');
    // An overlay can leave old files behind. Fail closed, never delete them here.
    try{fs.lstatSync(path.join(root,'browser_public'));throw Error('[SBC STAGED INVENTORY] stale frontend mirror; clean staged directory required');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const required=['server.js','package.json','public/app.js','public/index.html',
    'enterprise/financial-governor-v56-25-3.js','enterprise/sbc-margin-policy.cjs',
    'sbc-godaddy-flat-entrypoint.cjs','scripts/v6611-verify-stage-inventory.cjs'];
  for(const name of required)if(!manifest.files[name])throw Error('[SBC STAGED INVENTORY] required asset omitted: '+name);
  let checked=0;
  for(const [name,expected] of Object.entries(manifest.files)){
    if(!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(x=>!x||x==='..'||x==='.')||
       !shaPattern.test(String(expected)))
      throw Error('[SBC STAGED INVENTORY] invalid path or checksum');
    const parts=name.split('/');let parent=root;
    for(const directory of parts.slice(0,-1)){
      parent=path.join(parent,directory);
      const dirStat=fs.lstatSync(parent);
      if(!dirStat.isDirectory()||dirStat.isSymbolicLink())throw Error('[SBC STAGED INVENTORY] symlink or not a regular directory: '+name);
    }
    const full=path.join(root,name);
    const stat=fs.lstatSync(full);
    if(!stat.isFile())throw Error('[SBC STAGED INVENTORY] not a regular file: '+name);
    const bytes=fs.readFileSync(full);
    const actual=sha256(bytes);
    if(actual!==expected){
      let jsonKeys='';
      if(name==='.airo/config.json'){
        try{jsonKeys=' jsonKeys='+Object.keys(JSON.parse(bytes.toString('utf8')))
          .filter(key=>/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)).sort().join(',');}catch{}
      }
      throw Error('[SBC STAGED INVENTORY] asset checksum mismatch: '+name+
        ' (expected digest '+displayDigest(expected)+' actual digest '+displayDigest(actual)+
        ' bytes='+bytes.length+jsonKeys+')');
    }
    checked++;
  }
  if(checked<100)throw Error('[SBC STAGED INVENTORY] suspiciously incomplete release: '+checked);
  return {legacy:false,checked,sourceCommit:manifest.sourceCommit,frontendLayout:layout};
}
if(require.main===module){
  const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
  const identity=JSON.parse(fs.readFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
  const result=verifyStagedInventory(root,identity);
  console.log('[SBC STAGED INVENTORY] PASS '+JSON.stringify(result));
}
module.exports={verifyStagedInventory};
