'use strict';
// Regression for production ReferenceError: demoBootstrapData is not defined.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const bootstrapImport="const {demoBootstrapData}=req"+"uire('./enterprise/sbc-demo-bootstrap.cjs');";

test('demo-role bootstrap responds from isolated synthetic data, without a ReferenceError or CRM access',async()=>{
  const start=source.indexOf("app.get('/api/bootstrap',auth,async(req,res)=>{");
  const end=source.indexOf("if(req.user.role==='owner'&&!MYSQL_RECOVERY_REQUIRED)",start);
  assert(start>=0&&end>start,'demo bootstrap handler must be found');
  let handler;
  const context={
    app:{get(_path,_auth,fn){handler=fn}},auth:()=>{},
    CATALOG:{packages:[]},CALL_SCRIPTS:{},storageMode:'TEST',BUILD_VERSION:'66.0.0',
    MYSQL_RECOVERY_REQUIRED:false,SBC_ROLE_PERMISSIONS:{demo:['dashboard']},
    require(name){assert.equal(name,'./enterprise/sbc-demo-bootstrap.cjs');return require(path.join(root,'enterprise/sbc-demo-bootstrap.cjs'))}
  };
  const load=(source.includes(bootstrapImport)?bootstrapImport+'\n':'')+source.slice(start,end)+'\n});';
  vm.runInNewContext(load,context,{filename:'server-demo-bootstrap-excerpt.js',timeout:2000});
  assert.equal(typeof handler,'function');
  const output={status:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},json(data){this.body=data;return this}};
  await handler({user:{id:'demo-user',username:'synthetic',name:'Synthetic Demo',role:'demo'}},output);
  assert.equal(output.headers['Cache-Control'],'no-store');
  assert.equal(output.body.user.role,'demo');
  assert.equal(output.body.settings.office,'DEMO MODE');
  for(const field of ['customers','activities','callReports','quotes','orders','renewals','appointments','sequences','sequenceEnrollments','emailTemplates','tasks','portalAccounts','portalMessages']){
    assert(Array.isArray(output.body[field]),field+' must be an array');
  }
  assert.doesNotMatch(JSON.stringify(output.body),/PRIVATE_CRM_SENTINEL|SENSITIVE_REAL_CUSTOMER/i);
  assert(output.body.customers.every(c=>c.demoOnly===true && !c.phone && !c.email), 'demo contacts must not be usable for real outreach');
});

test('synthetic demo dataset is regenerated without mutable cross-request state',()=>{
  const {demoBootstrapData}=require('../enterprise/sbc-demo-bootstrap.cjs');
  const first=demoBootstrapData();
  first.customers.push({businessName:'PRIVATE_CRM_SENTINEL'});
  assert.equal(demoBootstrapData().customers.some(c=>c.businessName==='PRIVATE_CRM_SENTINEL'),false);
});
