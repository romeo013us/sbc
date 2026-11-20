'use strict';
/**
 * Read-only, offline HTML asset and staff indexing gate for SBC products.
 * Does not touch production, customer data, environment variables or networks.
 * Static analysis is not a replacement for browser/tenant/payment/load testing.
 */
const fs=require('node:fs');
const path=require('node:path');
const fsExists=p=>{try{return fs.statSync(p).isFile()}catch{return false}};
const TARGETS={
 'sbc-business-command-center':[
  'index.html','lead-research.html','sbc-account-manager-v1.html','hr-workstation.html'
 ],
 'sbc-office-box':['index.html']
};
function audit(root){
 const errors=[],warnings=[],checked=[];
 const pkgPath=path.join(root,'package.json');
 if(!fsExists(pkgPath))return {errors:['missing package.json'],warnings,checked};
 let pkg;
 try{pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))}catch{return {errors:['invalid package.json'],warnings,checked}}
 const app=pkg.name||'';
 const files=TARGETS[app];
 if(!files)return {errors:[`unrecognized SBC product: ${app}`],warnings,checked};
 const publicRoot=path.resolve(root,'public');
 const main=(pkg.main||'server.js');
 if(!fsExists(path.join(root,main)))errors.push(`missing application entrypoint: ${main}`);
 for(const file of files){
  const filename=path.join(publicRoot,file);
  if(!fsExists(filename)){errors.push(`missing public screen: ${file}`);continue}
  checked.push(file);
  const html=fs.readFileSync(filename,'utf8');
  if(!/<html\b[^>]*\blang\s*=/.test(html))errors.push(`${file}: missing html language`);
  if(!/<meta\b[^>]*\bname\s*=\s*['"]viewport['"]/i.test(html))errors.push(`${file}: missing viewport meta`);
  if(app==='sbc-business-command-center' && file!=='index.html' && !/<meta\b[^>]*\bname\s*=\s*['"]robots['"][^>]*\bnoindex/i.test(html))errors.push(`${file}: missing noindex on private staff screen`);
  for(const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)){
   const val=match[2].trim();
   if(/^(https?:|\/\/|data:|blob:|mailto:|tel:|#)/i.test(val))continue;
   const asset=val.split(/[?#]/)[0];
   if(!/\.(?:css|m?js)$/i.test(asset))continue;
   const rel=asset.replace(/^\//,'');
   const resolved=path.resolve(asset.startsWith('/')?publicRoot:path.dirname(filename),rel);
   if(resolved!==publicRoot && !resolved.startsWith(publicRoot+path.sep)){
    errors.push(`${file}: unsafe asset path ${val}`);continue;
   }
   if(!fsExists(resolved))errors.push(`${file}: missing local asset ${val}`);
  }
 }
 warnings.push('STATIC ONLY: no production API, browser behavior, security penetration, payments, tenant isolation, UX contrast, speed or customer data tested');
 return {product:app,checked,errors,warnings};
}
if(require.main===module){
 const result=audit(process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'..'));
 console.log(JSON.stringify(result,null,2));
 process.exitCode=result.errors.length?1:0;
}
module.exports={audit};
