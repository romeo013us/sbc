'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {writeBackup}=require('./mysql-backup.js');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-backup-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const out=path.join(dir,'backup.sql'),events=[];
 const db={async query(sql){events.push(sql);if(sql==='SHOW TABLES')return [[{table:'sbc_customers'}]];
 if(sql.startsWith('SHOW CREATE TABLE'))return [[{'Create Table':'CREATE TABLE '+String.fromCharCode(96)+'sbc_customers'+String.fromCharCode(96)+' (id INT) ENGINE=InnoDB'}]];
 if(sql.startsWith('SELECT *'))return [[{id:1}]];return [[]];},
 async commit(){events.push('COMMIT')},async rollback(){events.push('ROLLBACK')}};
 return {dir,out,db,events};
}
test('complete backup is privately permissioned and does not replace an existing file',async t=>{
 const f=fixture(t);
 const result=await writeBackup(f.db,f.out,{escape:String});
 assert.equal(result.tables,1);assert.equal(result.rows,1);
 assert.equal(fs.statSync(f.out).mode&0o777,0o600);
 const content=fs.readFileSync(f.out,'utf8');assert.match(content,/INSERT INTO/);assert.match(content,/SET FOREIGN_KEY_CHECKS=1;/);
 assert(f.events.includes('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY'));
 await assert.rejects(writeBackup(f.db,f.out,{escape:String}),/EEXIST/);
 assert.equal(fs.readFileSync(f.out,'utf8'),content);
 assert.deepEqual(fs.readdirSync(f.dir),['backup.sql']);
});
test('failed database read rolls back and leaves no completed or partial export',async t=>{
 const f=fixture(t),query=f.db.query;
 f.db.query=async sql=>{if(sql.startsWith('SELECT *'))throw Error('synthetic database failure');return query(sql)};
 await assert.rejects(writeBackup(f.db,f.out,{escape:String}),/synthetic database failure/);
 assert(f.events.includes('ROLLBACK'));assert.deepEqual(fs.readdirSync(f.dir),[]);
});
test('failed snapshot commit cannot publish a backup',async t=>{
 const f=fixture(t);f.db.commit=async()=>{throw Error('synthetic commit failure')};
 await assert.rejects(writeBackup(f.db,f.out,{escape:String}),/synthetic commit failure/);
 assert(f.events.includes('ROLLBACK'));assert.deepEqual(fs.readdirSync(f.dir),[]);
});
test('unsafe table names are refused without creating a backup',async t=>{
 const f=fixture(t);const query=f.db.query;f.db.query=async sql=>sql==='SHOW TABLES'?[[{table:'invalid table'}]]:query(sql);
 await assert.rejects(writeBackup(f.db,f.out,{escape:String}),/BACKUP_TABLE_NAME_INVALID/);
 assert.deepEqual(fs.readdirSync(f.dir),[]);
});

test('encrypted backup authenticates before publishing a private recovery file',async t=>{
 const {decryptBackup}=require('./mysql-backup.js'),crypto=require('node:crypto');
 const f=fixture(t),key=crypto.randomBytes(32),encrypted=f.out+'.enc',recovered=path.join(f.dir,'restored.sql');
 await writeBackup(f.db,encrypted,{escape:String,encryptionKey:key});
 const bytes=fs.readFileSync(encrypted);
 assert(!bytes.includes(Buffer.from('INSERT INTO')));
 assert.equal(fs.statSync(encrypted).mode&0o777,0o600);
 assert.throws(()=>decryptBackup(encrypted,recovered,crypto.randomBytes(32)),/BACKUP_AUTHENTICATION_FAILED/);
 assert(!fs.existsSync(recovered));
 decryptBackup(encrypted,recovered,key);
 assert.match(fs.readFileSync(recovered,'utf8'),/INSERT INTO/);
 assert.equal(fs.statSync(recovered).mode&0o777,0o600);
 assert.throws(()=>decryptBackup(encrypted,recovered,key),/EEXIST/);
 const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;
 const damaged=path.join(f.dir,'damaged.enc'),output=path.join(f.dir,'damaged.sql');fs.writeFileSync(damaged,corrupted);
 assert.throws(()=>decryptBackup(damaged,output,key),/BACKUP_AUTHENTICATION_FAILED/);
 assert(!fs.existsSync(output));
 assert(!fs.readdirSync(f.dir).some(n=>n.endsWith('.partial')));
});
test('invalid encryption key is rejected before opening a database snapshot or output',async t=>{
 const f=fixture(t);
 await assert.rejects(writeBackup(f.db,f.out,{escape:String,encryptionKey:Buffer.alloc(31)}),/BACKUP_ENCRYPTION_KEY_INVALID/);
 assert.deepEqual(f.events,[]);assert.deepEqual(fs.readdirSync(f.dir),[]);
});
