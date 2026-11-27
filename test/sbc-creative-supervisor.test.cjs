'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {runWorker}=require('../enterprise/creative-intelligence/worker-process.cjs');
test('supervisor processes work sequentially and stops on shutdown',async()=>{const controller=new AbortController();let calls=0;await runWorker({runner:{async runOnce(){if(++calls===3)controller.abort();return {status:'completed'};}}},{signal:controller.signal,intervalMs:100});assert.equal(calls,3);});
test('worker operation failure is reported without leaking internal errors',async()=>{const controller=new AbortController(),errors=[];await runWorker({runner:{async runOnce(){throw Error('internal private data');}}},{signal:controller.signal,intervalMs:100,onError:code=>{errors.push(code);controller.abort();}});assert.deepEqual(errors,['CREATIVE_WORKER_OPERATION_FAILED']);});
