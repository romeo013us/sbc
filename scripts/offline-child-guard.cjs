'use strict';
// Inherited by each permitted Node child via NODE_OPTIONS.
// This is defense in depth, not a substitute for Docker --network none.
const cp=require('node:child_process');
const path=require('node:path');
if(process.env.SBC_COMPILER_SANDBOX_CONFIRMED!=='1')throw Error('Offline child guard must not run outside compilation sandbox');
const target=path.resolve(process.env.SBC_COMPILER_TARGET||'/work/target');
const allowed=(file,args,options)=>{
 if(file!==process.execPath||!Array.isArray(args)||!args.length)return false;
 if(args[0]==='--check')return args.length===2&&typeof args[1]==='string'&&args[1].startsWith(target+'/');
 if(typeof args[0]!=='string'||!args[0].startsWith(target+'/'))return false;
 if(args.some(a=>String(a).startsWith('/')&&!String(a).startsWith(target+'/')))return false;
 if(options?.cwd&&!path.resolve(options.cwd).startsWith(target))return false;
 return true;
};
const original=cp.spawnSync;
cp.spawnSync=(file,args,options)=>{
 if(!allowed(file,args,options))throw Error('OFFLINE_CHILD_PROCESS_DENIED '+String(file)+' '+JSON.stringify(args));
 const out=original.call(cp,file,args,options);
 if(out.error||out.status!==0)throw Error('OFFLINE_CHILD_FAILED '+String(out.error?.message||out.status)+' '+JSON.stringify(args));
 return out;
};
for(const name of ['spawn','exec','execSync','execFile','execFileSync','fork'])cp[name]=()=>{throw Error('OFFLINE_CHILD_PROCESS_DENIED '+name)};
module.exports={allowed};
