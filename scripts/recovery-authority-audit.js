'use strict';
const fs=require('fs');
const zlib=require('zlib');
const crypto=require('crypto');
const file=process.argv[2];
if(!file||!fs.existsSync(file)){console.error('USAGE: node scripts/recovery-authority-audit.js <backup.sql|backup.sql.gz>');process.exit(2)}
const raw=fs.readFileSync(file);
let text='';
try{text=file.toLowerCase().endsWith('.gz')?zlib.gunzipSync(raw).toString('utf8'):raw.toString('utf8')}catch(e){console.error('AUDIT FAIL: cannot decode backup:',e.message);process.exit(1)}
const tables=['sbc_customers','sbc_quotes','sbc_orders','sbc_renewals','sbc_activities'];
const out={file,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex'),format:file.toLowerCase().endsWith('.gz')?'sql.gz':'sql',recognized:/SBC logical backup|mysqldump|CREATE TABLE/i.test(text),tables:{}};
for(const t of tables){const create=new RegExp("CREATE TABLE(?: IF NOT EXISTS)? `?"+t+"`?",'i').test(text);const inserts=(text.match(new RegExp("INSERT INTO `?"+t+"`?",'gi'))||[]).length;out.tables[t]={create,inserts};}
const core=Object.values(out.tables);out.authoritativeCandidate=out.recognized&&core.every(x=>x.create)&&core.some(x=>x.inserts>0);
console.log(JSON.stringify(out,null,2));process.exit(out.authoritativeCandidate?0:3);
