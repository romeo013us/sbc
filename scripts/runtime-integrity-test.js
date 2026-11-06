'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'..');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const pool = fs.readFileSync(path.join(root,'config','mysql-pool.js'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const release = require('../config/release-identity');
const checks = [];
function check(name, ok, detail=''){ checks.push({name,ok,detail}); }
check('package-version', pkg.version === release.RELEASE_VERSION, pkg.version);
check('authoritative-release', release.RELEASE_VERSION === pkg.version, release.RELEASE_VERSION);
check('server-uses-authoritative-release', /BUILD_VERSION\s*=\s*RELEASE_VERSION/.test(server));
check('server-no-callback-mysql-connection-hook', !/mysqlPool\.on\(['"]connection['"]/.test(server));
check('promise-driver', /require\(['"]mysql2\/promise['"]\)/.test(server) && /require\(['"]mysql2\/promise['"]\)/.test(pool));
check('pool-keeps-promise-query-interface', /createPool\(/.test(pool) && !/mysql2['"]\)/.test(pool));
check('no-v62-2-0-literal', !/62\.2\.0/.test(server));
check('release-endpoint', /\/api\/release-identity/.test(server));
check('livez-endpoint', /\/livez/.test(server));
check('readyz-endpoint', /\/readyz/.test(server));
// Execute the actual registered handlers with a database that throws on access.
// Recovery must reject before either a read or mutation, regardless of guard order.
const vm = require('node:vm');
const routes = [ ['post','/api/customers'], ['put','/api/customers/:id'],
  ['post','/api/customers/:id/account-notes'], ['delete','/api/customers/:id'],
  ['post','/api/customers/bulk-delete'] ];
(async()=>{
for(const [method,url] of routes){
  const line=server.split('\n').find(x=>x.startsWith(`app.${method}('${url}',`));
  if(!line){check(method+' '+url,false,'route missing');continue;}
  for(const mode of ['recovery','read-only','shutdown','no-pool','not-evaluated']){
    let handler,code,body;
    const context={app:{[method](_url,...args){handler=args.at(-1)}},auth(){},ownerOnly(){},
      SBC_RUNTIME_READ_ONLY:mode==='read-only',sbcShutdownStarted:mode==='shutdown',
      mysqlPool:mode==='no-pool'?null:{},MYSQL_RECOVERY_EVALUATED:mode!=='not-evaluated',
      MYSQL_RECOVERY_REQUIRED:mode==='recovery',
      db:new Proxy({},{get(){throw Error('Blocked request accessed database')}})};
    try{
      vm.runInNewContext(line,context,{timeout:1000});
      const res={status(n){code=n;return this},json(x){body=x;return this}};
      await handler({body:{},params:{id:'fixture'},user:{role:'owner'}},res);
      check(method+' '+url+' '+mode,code===423&&body?.readOnly===true&&body?.error===(mode==='recovery'?'MYSQL_RECOVERY_REQUIRED':'CRM_RELATIONAL_WRITER_UNAVAILABLE'));
    }catch(e){check(method+' '+url+' '+mode,false,e.message)}
  }
}
const ok=checks.every(x=>x.ok);
console.log(JSON.stringify({ok,version:release.RELEASE_VERSION,checks},null,2));
process.exitCode=ok?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
