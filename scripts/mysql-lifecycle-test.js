'use strict';
const assert = require('assert');
const {wrapPool,isTransientMySQLError} = require('../enterprise/v56133-mysql-query-guard');

function makeConnection(id, failQuery=false) {
  return {
    id,
    destroyed:false,
    async query(sql,args){
      if(failQuery){ const e=new Error('write EPIPE'); e.code='EPIPE'; throw e; }
      return [[{ok:1,id}]];
    },
    async execute(sql,args){ return this.query(sql,args); },
    async ping(){ if(this.failPing){const e=new Error('The client was disconnected by the server because of inactivity');e.code='PROTOCOL_CONNECTION_LOST';throw e;} return true; },
    async beginTransaction(){return true;}, async commit(){return true;}, async rollback(){return true;},
    release(){this.released=true;},
    destroy(){this.destroyed=true;}
  };
}

(async()=>{
  let next=0;
  const c1=makeConnection(++next,true);
  const c2=makeConnection(++next,false);
  let leases=0;
  const pool={
    async getConnection(){ return leases++===0 ? c1 : c2; }
  };
  const wrapped=wrapPool(pool,{attempts:2});
  const [rows]=await wrapped.query('SELECT 1');
  assert.strictEqual(rows[0].id,2,'retry must use a fresh connection');
  assert.strictEqual(c1.destroyed,true,'poisoned connection must be destroyed');
  assert.strictEqual(c2.released,true,'healthy connection must be released');
  assert.strictEqual(isTransientMySQLError(Object.assign(new Error('closed state'),{code:'ECONNRESET'})),true);

  let pingConn=makeConnection(++next,false); pingConn.failPing=true;
  const pool2={async getConnection(){return pingConn;}};
  const w2=wrapPool(pool2,{attempts:1});
  const c=await w2.getConnection();
  let failed=false; try{await c.ping()}catch{failed=true;}
  assert(failed && pingConn.destroyed,'guarded leased connection must self-destruct on ping failure');

  console.log(JSON.stringify({ok:true,version:'60.4.5',checks:[
    'fresh-connection-after-transient-query',
    'poisoned-socket-destroyed',
    'healthy-socket-released',
    'transient-error-classification',
    'leased-connection-ping-destroys-stale-socket'
  ].map(name=>({name,ok:true}))},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
