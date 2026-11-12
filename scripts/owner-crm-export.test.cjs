'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const stage = require('./stage-owner-crm-export.cjs');

const read = name => fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const server = read('server.js');
const browser = read('public/app.js');
const compiled = stage.patchServer(server);
const compiledBrowser = stage.patchApp(browser);
assert.equal(browser,read('browser_public/app.js'));
assert.equal(stage.patchServer(compiled),compiled);
assert.equal(stage.patchApp(compiledBrowser),compiledBrowser);
assert(!compiledBrowser.includes("$('#importFile')"));
assert(!compiledBrowser.includes('Download a complete JSON backup'));
assert(compiledBrowser.includes('Download CRM JSON'));
new vm.Script(compiled,{filename:'compiled-server.js'});
new vm.Script(compiledBrowser,{filename:'compiled-app.js'});
if (process.argv.includes('--staged')) {
  assert.equal(compiled,server);
  assert.equal(compiledBrowser,browser);
}

const records = {
  settings:{crmApiKey:'TOP_LEVEL_SECRET'},
  users:[{passwordHash:'TOP_LEVEL_SECRET'}],
  customers:[null,{id:'c1',tenantId:1,businessName:'SBC Customer',email:'qa@example.test',accountNotes:[{token:'CUSTOMER_SECRET'}]},
    {id:'foreign',tenantId:2,businessName:'OTHER_TENANT'}, {id:'orphan',businessName:'UNSCOPED'}],
  quotes:[{id:'q1',tenantId:1,customerId:'c1',total:49,paymentUrl:'QUOTE_SECRET',items:[{name:'Office Box',qty:1,unitPrice:49,token:'QUOTE_SECRET'}]}],
  orders:[{id:'o1',tenantId:1,customerId:'c1',price:49,fulfillmentStatus:'Completed',notes:'ORDER_METADATA'},
    {id:'o2',tenantId:2,notes:'OTHER_TENANT'}],
  renewals:[{id:'r1',tenantId:1,customerId:'c1',amount:49}],
  activities:[{id:'a1',tenantId:1,type:'crm',message:'Lead added',meta:{token:'ACTIVITY_SECRET'}},
    {id:'a2',tenantId:2,message:'OTHER_TENANT'}]
};
const before = JSON.stringify(records);
const auth = () => {};
const ownerOnly = () => {};
const handlers = {};
const register = (name,authentication,authorization,handler) => {
  assert.equal(authentication,auth);
  assert.equal(authorization,ownerOnly);
  handlers[name] = handler;
};
const context = {
  auth,ownerOnly,db:records,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,
  app:{get:register,post:register},
  requireRequestTenant(req) {
    assert.equal(req.tenantId,1);
    return req.tenantId;
  },
  tenantFilter(req,rows) { return rows.filter(row => Number(row.tenantId) === req.tenantId); },
  saveData() { throw new Error('CRM export and retired import must never persist'); }
};
vm.createContext(context);
const start = compiled.indexOf(stage.marker);
vm.runInContext(compiled.slice(start,compiled.indexOf(stage.nextRoute,start)),context);

function call(route,req) {
  const result = {status:200,headers:{}};
  handlers[route](req,{
    setHeader(key,value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(value) { result.body = JSON.parse(JSON.stringify(value)); }
  });
  assert.equal(result.headers['Cache-Control'],'no-store');
  return result;
}

const download = call('/api/export',{tenantId:1,query:{tenantId:2}});
assert.equal(download.status,200);
assert.match(download.headers['Content-Disposition'],/^attachment; filename="sbc-crm-export-\d{4}-\d{2}-\d{2}\.json"$/);
assert.equal(download.body.kind,'sbc-crm-export');
for (const key of ['customers','quotes','orders','renewals','activities']) {
  assert.equal(download.body[key].length,1);
  assert.equal(download.body[key][0].tenantId,1);
}
assert.deepEqual(download.body.quotes[0].items,[{name:'Office Box',qty:1,unitPrice:49}]);
assert.equal(download.body.orders[0].fulfillmentStatus,'Completed');
assert.equal(download.body.customers[0].businessName,'SBC Customer');
assert(!/SECRET|OTHER_TENANT|UNSCOPED|ORDER_METADATA/.test(JSON.stringify(download.body)));

context.MYSQL_RECOVERY_REQUIRED = true;
assert.equal(call('/api/export',{tenantId:1}).status,503);
context.MYSQL_RECOVERY_REQUIRED = false;
context.MYSQL_RECOVERY_EVALUATED = false;
assert.equal(call('/api/export',{tenantId:1}).status,503);
const retired = call('/api/import',{tenantId:1,body:{customers:[],users:[],settings:{}}});
assert.equal(retired.status,410);
assert.equal(retired.body.error,'LEGACY_WORKSPACE_IMPORT_RETIRED');
assert.equal(context.db,records);
assert.equal(JSON.stringify(context.db),before);
console.log('PASS owner CRM export scope, private fields, cache control, recovery state and retired import');
