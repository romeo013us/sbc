'use strict';
const assert=require('node:assert/strict');
const {wrapPool}=require('../enterprise/v56133-mysql-query-guard');
function fixture(run,releaseThrows=false){const s={acquired:0,released:0,destroyed:0,active:0,calls:0};return{ s,pool:{async getConnection(){s.acquired++;s.active++;let done=false;return{async query(){s.calls++;return run(s)},release(){if(releaseThrows)throw Error('release failed');if(!done){done=true;s.released++;s.active--}},destroy(){if(!done){done=true;s.destroyed++;s.active--}}}}}}}
function noLeaks(s){assert.equal(s.active,0);assert.equal(s.released+s.destroyed,s.acquired)}
(async()=>{
 let f=fixture(async()=>{throw Object.assign(Error('invalid SQL'),{code:'ER_PARSE_ERROR'})});let g=wrapPool(f.pool);for(let i=0;i<10;i++)await assert.rejects(()=>g.query('SELECT invalid'));assert.equal(f.s.released,10);noLeaks(f.s);console.log('PASS ten non-transient errors: zero leaked leases');
 let calls=0;f=fixture(async()=>{if(++calls<3)throw Object.assign(Error('socket reset'),{code:'ECONNRESET'});return[{ok:1}]});await wrapPool(f.pool).query('SELECT retry');assert.equal(calls,3);assert.equal(f.s.destroyed,2);assert.equal(f.s.released,1);noLeaks(f.s);console.log('PASS transient retries: success on attempt three');
 f=fixture(async()=>{throw Object.assign(Error('socket reset'),{code:'ECONNRESET'})});await assert.rejects(()=>wrapPool(f.pool).query('SELECT exhaust'));assert.equal(f.s.acquired,3);assert.equal(f.s.destroyed,3);noLeaks(f.s);console.log('PASS retry exhaustion: broken leases destroyed');
 f=fixture(async()=>1,true);await wrapPool(f.pool).query('SELECT release failure');assert.equal(f.s.destroyed,1);noLeaks(f.s);console.log('PASS release failure escalates to destroy');
})().catch(e=>{console.error(e);process.exitCode=1});
