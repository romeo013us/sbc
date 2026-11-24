'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const {recordSlot,listSlots,reconcileSlots} = require('../routes/sbc-marketing-receipts.cjs');

test('MySQL serializes competing slot assignments and retains independently matched receipts',async t=>{
  const pool=mysql.createPool({host:'127.0.0.1',user:'root',database:'sbc_v6682_ci',password:process.env.SBC_V6682_CI_MYSQL_PASSWORD});
  t.after(()=>pool.end());
  const tenant=117,day='2026-11-24',input={platform:'instagram',slot:'AM'};
  await recordSlot(pool,tenant,day,input);
  const [attempt]=await listSlots(pool,tenant,day);
  assert.equal(attempt.provider_id,null);
  const claims=await Promise.allSettled(['101','102'].map(postId=>recordSlot(pool,tenant,day,{...input,postId})));
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(claims.find(x=>x.status==='rejected').reason.status,409);
  const [{provider_id:id}]=await listSlots(pool,tenant,day);
  await recordSlot(pool,tenant,day,{...input,postId:id});
  await assert.rejects(recordSlot(pool,tenant,day,{...input,slot:'PM',postId:id}),{status:409});
  assert.equal((await listSlots(pool,tenant,day)).length,1);
  const proof={id,link:'https://www.instagram.com/p/test/',publishedAt:'2026-11-24T15:00:00.000Z'};
  await reconcileSlots(pool,tenant,{day,channels:[{platform:'facebook',receipts:[proof]}]});
  assert.equal((await listSlots(pool,tenant,day))[0].verified_at,null);
  await reconcileSlots(pool,tenant,{day,channels:[{platform:'instagram',receipts:[proof]}]});
  await reconcileSlots(pool,tenant,{day,channels:[]});
  const [saved]=await listSlots(pool,tenant,day);
  assert(saved.verified_at);assert.equal(saved.permalink,proof.link);
  assert.deepEqual(await listSlots(pool,tenant+1,day),[]);
});
