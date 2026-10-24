'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6607_LEAD_REVISION_GUARD';
function once(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) throw Error(MARKER+': '+label+' expected one anchor, got '+count);
  return text.replace(oldValue, newValue);
}
function apply(root) {
  const crm = path.join(root, 'routes/crm.js');
  const edits = path.join(root, 'routes/crm-edits-v6606.js');
  const browser = path.join(root, 'public/sbc-lead-edit-v6606.js');
  const current = fs.readFileSync(edits, 'utf8');
  if (current.includes(MARKER)) return { marker: MARKER, changed: false };
  for (const name of ['crm-revision-v6607.cjs','v6607-lead-revision-test.js']) {
    if (!fs.existsSync(path.join(__dirname,name))) throw Error(MARKER+': missing '+name);
  }
  let read = fs.readFileSync(crm,'utf8');
  let write = current;
  let ui = fs.readFileSync(browser,'utf8');
  read = once(read,
    "const { requireTenantContext } = require('../enterprise/tenant-context.cjs');",
    "const { requireTenantContext } = require('../enterprise/tenant-context.cjs');\nconst { revisionOfLead } = require('../enterprise/crm-revision-v6607.cjs');",
    'CRM tenant dependency');
  read = once(read,
    "return res.json({ ok: true, version: '65.1.10', readOnly: true, data: customer });",
    "return res.json({ ok: true, version: '65.1.10', readOnly: true, data: { ...customer, revision: revisionOfLead(customer) } });",
    'lead GET revision');
  write = once(write,
    "const {positiveTenantId}=require('../enterprise/repositories/customer-repository.cjs');",
    "const {positiveTenantId}=require('../enterprise/repositories/customer-repository.cjs');\nconst {revisionOfLead}=require('../enterprise/crm-revision-v6607.cjs');\n// " + MARKER,
    'write dependency');
  write = once(write,
    "if(Object.keys(input).some(key=>!Object.hasOwn(FIELDS,key)))",
    "if(Object.keys(input).some(key=>key!=='revision'&&!Object.hasOwn(FIELDS,key)))",
    'allowed body keys');
  write = once(write,
    "if(!Object.keys(input).length)throw Object.assign(new Error('EMPTY_EDIT'),{code:'EMPTY_EDIT'});",
    "const suppliedRevision=input.revision;\n   if(typeof suppliedRevision!=='string'||!(/^[a-f0-9]{64}$/).test(suppliedRevision))throw Object.assign(new Error('LEAD_REVISION_REQUIRED'),{code:'LEAD_REVISION_REQUIRED'});\n   if(!Object.keys(input).some(key=>Object.hasOwn(FIELDS,key)))throw Object.assign(new Error('EMPTY_EDIT'),{code:'EMPTY_EDIT'});",
    'required revision');
  write = once(write,
    "const [matching]=await conn.query('SELECT id,assigned_to FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);",
    "const [matching]=await conn.query('SELECT id,assigned_to,contact_name,phone,email,status,notes,updated_at FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);",
    'locked lead snapshot');
  write = once(write,
    "if(role==='caller'&&(!actor||String(matching[0].assigned_to||'').trim()!==actor)){",
    "if(revisionOfLead(matching[0])!==req.body.revision){\n    await conn.rollback();transaction=false;return res.status(409).json({ok:false,code:'LEAD_STALE_REVISION',message:'Lead changed since you opened it. Reload before saving; no change was made.'});\n   }\n   if(role==='caller'&&(!actor||String(matching[0].assigned_to||'').trim()!==actor)){",
    'check revision under lock');
  write = once(write,
    "if(!Array.isArray(verified)||verified.length!==1||Number(verified[0].tenant_id)!==tenant)throw Object.assign(new Error('LEAD_EDIT_READBACK_FAILED'),{code:'LEAD_EDIT_READBACK_FAILED'});",
    "if(!Array.isArray(verified)||verified.length!==1||Number(verified[0].tenant_id)!==tenant)throw Object.assign(new Error('LEAD_EDIT_READBACK_FAILED'),{code:'LEAD_EDIT_READBACK_FAILED'});\n   for(const edit of edits){if(String(verified[0][edit.column]??'')!==edit.value)throw Object.assign(new Error('LEAD_EDIT_READBACK_MISMATCH'),{code:'LEAD_EDIT_READBACK_MISMATCH'});}",
    'verify all written values');
  write = once(write,
    "data:verified[0],updatedFields:edits.map(x=>x.key)",
    "data:{...verified[0],revision:revisionOfLead(verified[0])},updatedFields:edits.map(x=>x.key)",
    'return updated revision');
  ui = once(ui,
    "let activeId=null;",
    "let activeId=null,activeRevision=null;\n  dialog.addEventListener('close',()=>{activeId=null;activeRevision=null});",
    'editor state');
  ui = once(ui,
    "event.preventDefault();activeId=button.dataset.sbcLeadEditId;",
    "event.preventDefault();activeId=button.dataset.sbcLeadEditId;activeRevision=null;",
    'reset revision on open');
  ui = once(ui,
    "if(String(row.id)!==activeId)throw new Error('CRM_IDENTITY_MISMATCH');",
    "if(String(row.id)!==activeId)throw new Error('CRM_IDENTITY_MISMATCH');\n    if(typeof row.revision!=='string'||!(/^[a-f0-9]{64}$/).test(row.revision))throw new Error('CRM_REVISION_MISSING');\n    activeRevision=row.revision;",
    'store current revision');
  ui = once(ui,
    "const data=Object.fromEntries(new FormData(form).entries());",
    "const data=Object.fromEntries(new FormData(form).entries());\n    if(!activeRevision)throw new Error('CRM_REVISION_MISSING');\n    data.revision=activeRevision;",
    'send revision');
  ui = once(ui,
    "if(reply.status===423)throw new Error('RECOVERY_LOCK_ACTIVE — changes were not saved.');",
    "if(reply.status===423)throw new Error('RECOVERY_LOCK_ACTIVE — changes were not saved.');\n     if(reply.status===409)throw new Error('This lead was changed elsewhere. Close and reopen it to refresh; no newer notes were overwritten.');",
    'conflict message');
  // All anchors validated before touching reconstructed runtime.
  const revision = path.join(root,'enterprise/crm-revision-v6607.cjs');
  const test = path.join(root,'scripts/v6607-lead-revision-test.js');
  fs.writeFileSync(revision,fs.readFileSync(path.join(__dirname,'crm-revision-v6607.cjs')));
  fs.writeFileSync(test,fs.readFileSync(path.join(__dirname,'v6607-lead-revision-test.js')));
  // Earlier edit test exercised the superseded API; run the extended test in its place too.
  fs.writeFileSync(path.join(root,'scripts/v6606-crm-edits-test.js'),fs.readFileSync(path.join(__dirname,'v6607-lead-revision-test.js')));
  fs.writeFileSync(crm,read);
  fs.writeFileSync(edits,write);
  fs.writeFileSync(browser,ui);
  return {marker:MARKER,changed:true};
}
module.exports={MARKER,apply};
