'use strict';
// Private operator staging CLI. Does not publish, schedule posts, or mutate CRM/MySQL.
const fs=require('node:fs'),path=require('node:path');
const E=require('../enterprise/sbc-social-asset-engine.cjs');
const [command,dirArg,value]=process.argv.slice(2);
const root=path.resolve(__dirname,'..');
if(!dirArg||!['generate','inventory','approve'].includes(command))throw Error('Usage: node scripts/sbc-social-assets.cjs generate PRIVATE_DIRECTORY YYYY-MM-DD | inventory PRIVATE_DIRECTORY | approve PRIVATE_DIRECTORY SHA256');
const dir=path.resolve(dirArg);
if(dir===root||dir.startsWith(root+path.sep))throw Error('PRIVATE_DIRECTORY_OUTSIDE_REPOSITORY_REQUIRED');
if(command==='generate'){
 const current=E.inventory(dir);
 const logo=fs.readFileSync(path.join(root,'public/assets/sbc-logo.jpg'));
 const rows=E.generate({startDay:value,logo,history:current.assets});
 E.stage(dir,rows);
}
if(command==='approve'){
 if(!value)throw Error('REVIEWED_SHA256_REQUIRED');
 E.approve(dir,value);
}
console.log(JSON.stringify(E.inventory(dir),null,2));
