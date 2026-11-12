'use strict';

const fs = require('node:fs');
const path = require('node:path');

const exportStart = "app.get('/api/export',auth,ownerOnly,";
const nextRoute = "app.post('/api/activities',auth,ownerOnly,";
const marker = '// SBC_OWNER_CRM_EXPORT_SCOPE';
const routes = [marker, `app.get('/api/export',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED){
    return res.status(503).json({ok:false,error:'CRM_EXPORT_UNAVAILABLE',message:'Wait until the workspace data is ready to export.'});
  }
  const tenantId = requireRequestTenant(req);
  const createdAt = new Date().toISOString();
  const fields = (record, keys) => Object.fromEntries(keys.flatMap(key => {
    const value = record?.[key];
    return value === null || ['string','number','boolean'].includes(typeof value) ? [[key,value]] : [];
  }));
  const base = ['id','createdAt','updatedAt'];
  const sale = ['customerId','customerName','status','notes'];
  const rows = (name, keys) => tenantFilter(req,(db[name] || []).filter(Boolean))
    .map(record => ({...fields(record,[...base,...keys]),tenantId}));
  const quotes = tenantFilter(req,(db.quotes || []).filter(Boolean)).map(quote => ({
    ...fields(quote,[...base,...sale,'quoteNumber','validUntil','subtotal','discount','taxRate','tax','total']),
    tenantId,
    items: Array.isArray(quote.items) ? quote.items.map(item => fields(item,['id','name','category','qty','unitPrice'])) : []
  }));
  const result = {
    version:1,kind:'sbc-crm-export',createdAt,tenantId,
    customers:rows('customers',['businessName','contactName','phone','email','status','source','followUp','notes','website','websiteStatus','industry','assignedTo','verificationStatus','address','city','region','zip']),
    quotes,
    orders:rows('orders',[...sale.filter(key => key !== 'notes'),'product','quantity','cost','price','paymentStatus','fulfillmentStatus','fulfillmentUpdatedAt']),
    renewals:rows('renewals',[...sale,'service','dueDate','amount']),
    activities:rows('activities',['type','message'])
  };
  res.setHeader('Content-Disposition','attachment; filename="sbc-crm-export-'+createdAt.slice(0,10)+'.json"');
  return res.json(result);
});

app.post('/api/import',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  return res.status(410).json({ok:false,error:'LEGACY_WORKSPACE_IMPORT_RETIRED',message:'Use the CRM lead importer for new leads. For database recovery, restore a MySQL backup into a separate database first.'});
});
`].join('\n');

function replaceOnce(source, previous, next) {
  if (source.split(previous).length !== 2) throw new Error('Unexpected owner CRM export stage anchor: '+previous.slice(0,80));
  return source.replace(previous, () => next);
}

function patchServer(source) {
  if (source.includes(routes)) return source;
  const start = source.indexOf(exportStart);
  const end = source.indexOf(nextRoute,start);
  const oldRoutes = source.slice(start,end);
  if (start < 0 || end < 0 || !oldRoutes.includes('JSON.stringify(db,null,2)') ||
      !oldRoutes.includes('const incoming=normalize(req.body);db=incoming;')) {
    throw new Error('Unexpected legacy export or import route');
  }
  return replaceOnce(source,oldRoutes,routes);
}

const recoveryHint = 'Use GoDaddy Hosted Database to export MySQL for recovery. Test the restore in a separate database first.';
function patchApp(source) {
  if (source.includes(recoveryHint)) return source;
  let next = replaceOnce(source,'<h2>Export your business data</h2><span class="badge green">Backup</span>','<h2>Export CRM data</h2>');
  next = replaceOnce(next,'Download a complete JSON backup of customers, quotes, orders, renewals, settings and activity. Keep a copy somewhere safe.','Download the loaded customers, quotes, orders, renewals and recent activity for this workspace.');
  next = replaceOnce(next,'Download SBC backup','Download CRM JSON');
  next = replaceOnce(next,'Download backup</a><label class="btn" style="cursor:pointer">Import backup<input id="importFile" type="file" accept="application/json" hidden></label></div>','Download CRM JSON</a></div><p class="mini">'+recoveryHint+'</p>');
  const start = next.indexOf(";const imp=$('#importFile');");
  const end = next.indexOf("toast('Import failed: '+x.message)}}",start);
  if (start < 0 || end < 0) throw new Error('Unexpected legacy import UI handler');
  return replaceOnce(next,next.slice(start,end+"toast('Import failed: '+x.message)}}".length),'');
}

if (require.main === module) {
  const root = path.resolve(__dirname,'..');
  const files = ['server.js','public/app.js','browser_public/app.js'].map(name => path.join(root,name));
  const sources = files.map(file => fs.readFileSync(file,'utf8'));
  if (sources[1] !== sources[2]) throw new Error('Owner CRM export UI mirrors differ');
  const compiled = [patchServer(sources[0]),patchApp(sources[1]),patchApp(sources[2])];
  if (process.argv.includes('--apply')) {
    if (process.env.SBC_OWNER_CRM_EXPORT_ISOLATED_STAGE !== 'YES') throw new Error('Owner CRM export can only be applied in isolated release staging');
    files.forEach((file,index) => fs.writeFileSync(file,compiled[index]));
  }
  if (process.argv.includes('--verify-staged') && compiled.some((source,index) => source !== sources[index])) {
    throw new Error('Owner CRM export must be compiled');
  }
}

module.exports = {marker,nextRoute,patchServer,patchApp};
