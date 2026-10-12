'use strict';
const fs=require('fs');
const path=require('path');
const MARKER='SBC_V6523_READ_QUERY_CANCEL';
function apply(root){
 const file=path.join(root,'enterprise','v56133-mysql-query-guard.js');
 if(!fs.existsSync(file)) throw new Error(MARKER+': missing mysql query guard');
 let s=fs.readFileSync(file,'utf8');
 if(!s.includes(MARKER)){
  const anchor="const TRANSIENT_CODES = new Set([";
  if(s.split(anchor).length!==2) throw new Error(MARKER+': guard anchor mismatch');
  s=s.replace(anchor,"// "+MARKER+": cancel timed-out read-only work by destroying its leased connection.\n"+anchor);
  const old=String.raw`        const result = await guardedConn[method](...args);
        releaseQuietly(guardedConn);
        return result;`;
  const next=String.raw`        const sqlArg = args[0];
        const sqlText = typeof sqlArg === 'string' ? sqlArg : String(sqlArg?.sql || '');
        const normalizedSql = sqlText.replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, ' ').trim();
        const isReadOnly = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(normalizedSql);
        let result;
        if (isReadOnly) {
          let timer;
          try {
            result = await Promise.race([
              guardedConn[method](...args),
              new Promise((_, reject) => { timer = setTimeout(() => {
                const error = Object.assign(new Error('SBC_MYSQL_READ_QUERY_TIMEOUT: read-only query exceeded 5000ms; leased connection destroyed.'), { code: 'SBC_MYSQL_READ_QUERY_TIMEOUT', sbcNoRetry: true });
                try { guardedConn.destroy(); } catch {}
                reject(error);
              }, 5000); })
            ]);
          } finally { clearTimeout(timer); }
        } else {
          result = await guardedConn[method](...args);
        }
        releaseQuietly(guardedConn);
        return result`;
  if(s.split(old).length!==2) throw new Error(MARKER+': query execution anchor mismatch');
  s=s.replace(old,next);
  const old2='        const transient = isTransientMySQLError(error);';
  if(s.split(old2).length!==2) throw new Error(MARKER+': retry anchor mismatch');
  s=s.replace(old2,'        const transient = !error?.sbcNoRetry && isTransientMySQLError(error);');
  fs.writeFileSync(file,s);
 }
 const sourcePkgPath=path.join(root,'package.json'); const sourcePkg=JSON.parse(fs.readFileSync(sourcePkgPath,'utf8')); if(!sourcePkg.scripts['test:all'].includes('v6523-read-query-cancel-test.js')) sourcePkg.scripts['test:all'] += ' && node hotfix-assets/v6523-read-query-cancel-test.js'; fs.writeFileSync(sourcePkgPath,JSON.stringify(sourcePkg,null,2)+'\n');
 const testSource=path.join(__dirname,'v6523-read-query-cancel-test.js'); const testDest=path.join(root,'hotfix-assets','v6523-read-query-cancel-test.js'); if(fs.existsSync(testSource)){fs.mkdirSync(path.dirname(testDest),{recursive:true});fs.copyFileSync(testSource,testDest);}
 const pkgPath=path.join(root,'package.json'); const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
 if(pkg.name!=='sbc-business-command-center') throw new Error(MARKER+': unexpected package identity');
 pkg.version='65.1.23'; pkg.description='SBC OS V65.1.23 bounded and cancelled read-only MySQL queries';
 fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const ver=path.join(root,'VERSION'); if(fs.existsSync(ver)) fs.writeFileSync(ver,fs.readFileSync(ver,'utf8').replace(/65\.1\.22/g,'65.1.23'));
 const identity=path.join(root,'config','release-identity.js'); if(fs.existsSync(identity)){let x=fs.readFileSync(identity,'utf8').replace(/65\.1\.22/g,'65.1.23').replace(/patch:\s*22\b/,'patch:23');fs.writeFileSync(identity,x);}
 for(const dir of ['public','scripts']){const d=path.join(root,dir);if(fs.existsSync(d))for(const n of fs.readdirSync(d)){if(!/\.(js|html|css)$/.test(n))continue;const f=path.join(d,n);let x=fs.readFileSync(f,'utf8').replace(/65\.1\.22/g,'65.1.23').replace(/65\\.1\\.22/g,'65\\\\.1\\\\.23');if(x!==fs.readFileSync(f,'utf8'))fs.writeFileSync(f,x);}}
 // Version assertion regexes must use escaped dots, not literal backslashes.
 const scriptsDir=path.join(root,'scripts'); if(fs.existsSync(scriptsDir)) for(const name of fs.readdirSync(scriptsDir)){if(!name.endsWith('.js'))continue;const f=path.join(scriptsDir,name);let x=fs.readFileSync(f,'utf8');x=x.split('65\\\\.1\\\\.23').join('65\\.1\\.23').split('patch:22').join('patch:23').split('patch===22').join('patch===23');fs.writeFileSync(f,x);}
 return {marker:MARKER,version:'65.1.23'};
}
module.exports={apply,MARKER};
