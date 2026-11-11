'use strict';
/* V66.155: validate precisely the files about to be zipped, not the whole repo. */
const fs=require('node:fs'),path=require('node:path');
const {excludedReleasePath}=require('../enterprise/v66155-public-asset-policy.cjs');
const required=['VERSION','package.json','package-lock.json','server.js','sbc-godaddy-flat-entrypoint.cjs',
 'SBC-FLAT-RELEASE-IDENTITY.json','SBC-DEPLOY-RECEIPT.json','.airo/config.json','public/index.html',
 'browser_public/index.html','public/app.js','browser_public/app.js','public/v10.js','browser_public/v10.js',
 'public/v32-2-upgrade.js','browser_public/v32-2-upgrade.js'];
const parity=['index.html','app.js','v10.js','v32-2-upgrade.js'];
const tokens=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['stripe-live',/\bsk_live_[a-zA-Z0-9]{20,}/],
 ['square-token',/\bsq0atp-[a-zA-Z0-9_-]{20,}/],
 ['github-token',/\b(?:ghp_|gho_|github_pat_)[a-zA-Z0-9_-]{30,}/],
 ['sendgrid-token',/\bSG\.[a-zA-Z0-9_-]{18,}\.[a-zA-Z0-9_-]{18,}/]
];
function verify(root,files,zipName){
 if(!Array.isArray(files)||files.length<100)throw Error('SBC_RELEASE_SELECTION_EMPTY');
 const selected=new Set(files);if(selected.size!==files.length)throw Error('SBC_RELEASE_DUPLICATE');
 for(const name of files){if(excludedReleasePath(name))throw Error('SBC_RELEASE_FORBIDDEN_MEMBER: '+name);
  const stat=fs.lstatSync(path.join(root,name));
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('SBC_RELEASE_BAD_FILE: '+name)}
 for(const f of required)if(!selected.has(f))throw Error('SBC_RELEASE_REQUIRED_MISSING: '+f);
 const ver=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const ident=JSON.parse(fs.readFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
 if(!/^\d+\.\d+\.\d+$/.test(ver)||ver!==pkg.version||ver!==ident.version)throw Error('SBC_RELEASE_VERSION_DRIFT');
 if(zipName!=='SBC-V'+ver.split('.')[0]+'-QUOTE-SAFETY-STAGING.zip')throw Error('SBC_RELEASE_ZIP_VERSION_DRIFT');
 for(const file of parity){const a=fs.readFileSync(path.join(root,'public',file));
  const b=fs.readFileSync(path.join(root,'browser_public',file));
  if(!a.equals(b))throw Error('SBC_RELEASE_MIRROR_DRIFT: '+file)}
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 let refs=0;for(const m of html.matchAll(/\b(?:src|href)=["'](\/[^"']+)["']/g)){
  const f=m[1].split(/[?#]/)[0].slice(1);
  if(!/\.(?:js|css|webmanifest|jpg|jpeg|png|svg|woff2?|ico)$/i.test(f))continue;
  refs++;if(!selected.has('public/'+f))throw Error('SBC_RELEASE_BROKEN_ASSET: '+f)}
 if(refs<10)throw Error('SBC_RELEASE_INCOMPLETE_BROWSER_REFS');
 let scanned=0;
 for(const f of files){if(!(f==='server.js'||f.startsWith('public/')||f.startsWith('browser_public/')||
    f.startsWith('config/')||f.startsWith('.airo/')))continue;
  if(!/\.(?:js|cjs|json|html|css|txt)$/i.test(f))continue;
  const bytes=fs.readFileSync(path.join(root,f));if(bytes.length>10000000)throw Error('SBC_RELEASE_LARGE_ASSET: '+f);
  const body=bytes.toString('utf8');scanned++;
  for(const [kind,re] of tokens)if(re.test(body))throw Error('SBC_RELEASE_SENSITIVE_MATERIAL: '+kind+' in '+f);
 }
 return {ok:true,files:files.length,staticReferences:refs,secretChecked:scanned,version:ver};
}
if(require.main===module){
 const mode=process.argv[2],root=path.resolve(process.argv[3]||'.');let data;
 if(mode==='--paths-stdin'){data=JSON.parse(fs.readFileSync(0,'utf8'))}
 else if(mode==='--inventory'){const inv=JSON.parse(fs.readFileSync(path.join(root,'SBC-STAGED-INVENTORY.json'),'utf8'));
  data={files:[...Object.keys(inv.files),'package-lock.json','SBC-FLAT-RELEASE-IDENTITY.json'],zipName:'SBC-V66-QUOTE-SAFETY-STAGING.zip'}}
 else throw Error('Usage --paths-stdin [root] or --inventory [root]');
 console.log('[SBC RELEASE HYGIENE] '+JSON.stringify(verify(root,data.files,data.zipName)));
}
module.exports={verify,required};
