'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {wrapPool,isReadOnlySql}=require('../enterprise/v56133-mysql-query-guard');
const err=code=>Object.assign(Error(code),{code});
function fixture({code='ECONNRESET',acquireFirst=false}={}){
 const s={leases:0,calls:0,writes:0,destroyed:0,released:0,commits:0};
 const pool={async getConnection(){s.leases++;if(acquireFirst&&s.leases===1)throw err(code);const run=async(sql)=>{s.calls++;if(!/^SELECT/i.test(typeof sql==='string'?sql:sql.sql))s.writes++;if(s.calls===1&&!acquireFirst)throw err(code);return [[{ok:1}]];};return{query:run,execute:run,async commit(){s.commits++;throw err(code);},release(){s.released++},destroy(){s.destroyed++}};}};
 return {s,guard:wrapPool(pool,{attempts:2})};
}
test('lost write acknowledgement never dispatches a second mutation',async()=>{
 for(const method of ['query','execute']){const {s,guard}=fixture();await assert.rejects(guard[method]('UPDATE credits SET remaining=remaining+1'),{code:'SBC_MYSQL_AMBIGUOUS_WRITE'});assert.equal(s.writes,1);assert.equal(s.leases,1);assert.equal(s.destroyed,1);}
});
test('safe read retries on a fresh connection',async()=>{const {s,guard}=fixture();await guard.query('SELECT id FROM credits WHERE id=?',[1]);assert.equal(s.calls,2);assert.equal(s.destroyed,1);assert.equal(s.released,1);});
test('failed acquisition before dispatch can retry a write',async()=>{const {s,guard}=fixture({acquireFirst:true});await guard.execute('INSERT INTO credits VALUES (?)',[1]);assert.equal(s.leases,2);assert.equal(s.writes,1);});
test('write lock failures remain explicit and are not blindly replayed',async()=>{for(const code of ['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT']){const {s,guard}=fixture({code});await assert.rejects(guard.query('DELETE FROM credits WHERE id=1'),{code});assert.equal(s.calls,1);}});
test('read classification is deliberately conservative',()=>{for(const sql of ['SELECT id FROM users WHERE id=?','SHOW TABLES','DESCRIBE users','EXPLAIN SELECT id FROM users'])assert.equal(isReadOnlySql(sql),true,sql);for(const sql of ['SELECT 1; UPDATE t SET n=1','SELECT 1 INTO OUTFILE "/tmp/x"','SELECT GET_LOCK(?,1)','SELECT * FROM t FOR UPDATE','SELECT @x:=1','SELECT * FROM t LOCK IN SHARE MODE','SELECT /* comment */ 1','CALL x()','WITH x AS (SELECT 1) SELECT * FROM x','EXPLAIN ANALYZE SELECT 1','EXPLAIN UPDATE t SET n=1','SELECT custom_function()','SELECT 1 -- comment','SELECT ?'])assert.equal(isReadOnlySql(sql,sql==='SELECT ?'?[{toSqlString:()=> '1; DELETE FROM t'}]:undefined),false,sql);assert.equal(isReadOnlySql({sql:'SELECT id FROM t WHERE id=?',values:[1]}),true);});
test('leased commit with lost acknowledgement is explicit and never replayed',async()=>{const {s,guard}=fixture();const conn=await guard.getConnection();await assert.rejects(conn.commit(),{code:'SBC_MYSQL_AMBIGUOUS_WRITE'});conn.release();assert.equal(s.commits,1);assert.equal(s.destroyed,1);assert.equal(s.released,0);});
