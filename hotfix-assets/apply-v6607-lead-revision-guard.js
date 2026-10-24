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
    "const keys=Object.keys(body);\n   if(!keys.length)throw Object.assign(new Error('EMPTY_EDIT'),{code:'EMPTY_EDIT'});",
    "const keys=Object.keys(body).filter(key=>key!=='revision');\n   if(typeof body.revision!=='string'||!(/^[a-f0-9]{64}$/).test(body.revision))throw Object.assign(new Error('LEAD_REVISION_REQUIRED'),{code:'LEAD_REVISION_REQUIRED'});\n   if(!keys.length)throw Object.assign(new Error('EMPTY_EDIT'),{code:'EMPTY_EDIT'});",
    'require revisions and preserve approved keys');
  write = once(write,
    "const [matched]=await conn.query('SELECT id,assigned_to FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);",
    "const [matched]=await conn.query('SELECT id,assigned_to,contact_name,phone,email,status,notes,updated_at FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);",
    'read full locked lead');
  write = once(write,
    "const actor=String(req.user?.username||req.user?.name||'').trim();",
    "if(revisionOfLead(matched[0])!==req.body.revision){\n    await conn.rollback();tx=false;return deny(res,409,'LEAD_STALE_REVISION');\n   }\n   const actor=String(req.user?.username||req.user?.name||'').trim();",
    'reject stale form before mutation');
  write = once(write,
    "if(!Array.isArray(verified)||verified.length!==1||Number(verified[0].tenant_id)!==tenant)\n    throw Error('LEAD_EDIT_READBACK_FAILED');",
    "if(!Array.isArray(verified)||verified.length!==1||Number(verified[0].tenant_id)!==tenant)\n    throw Error('LEAD_EDIT_READBACK_FAILED');\n   for(const edit of edits){if(String(verified[0][edit.column]??'')!==edit.value)throw Error('LEAD_EDIT_READBACK_MISMATCH');}",
    'confirm durable fields');
  write = once(write,
    "data:verified[0],updatedFields:edits.map(x=>x.key)",
    "data:{...verified[0],revision:revisionOfLead(verified[0])},updatedFields:edits.map(x=>x.key)",
    'return updated revision');
  ui = once(ui,
    "let activeId=null;",
    "let activeId=null,activeRevision=null;",
    'editor revision variable');
  ui = once(ui,
    "dlg.addEventListener('close',()=>{activeId=null});",
    "dlg.addEventListener('close',()=>{activeId=null;activeRevision=null});",
    'clear revision on close');
  ui = once(ui,
    "activeId=button.dataset.sbcLeadEditId;",
    "activeId=button.dataset.sbcLeadEditId;activeRevision=null;",
    'clear revision on new record');
  ui = once(ui,
    "if(activeId!==requestedId||String(data.data.id)!==requestedId)throw Error('CRM_IDENTITY_MISMATCH');",
    "if(activeId!==requestedId||String(data.data.id)!==requestedId)throw Error('CRM_IDENTITY_MISMATCH');\n    if(typeof data.data.revision!=='string'||!(/^[a-f0-9]{64}$/).test(data.data.revision))throw Error('CRM_REVISION_MISSING');\n    activeRevision=data.data.revision;",
    'require server revision on load');
  ui = once(ui,
    "const response=await fetch('/api/v6606/crm/leads/'+encodeURIComponent(activeId),{",
    "if(!activeRevision)throw Error('CRM_REVISION_MISSING');\n    const response=await fetch('/api/v6606/crm/leads/'+encodeURIComponent(activeId),{",
    'deny saves without revision');
  ui = once(ui,
    "body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))",
    "body:JSON.stringify({...Object.fromEntries(new FormData(form).entries()),revision:activeRevision})",
    'send revision');
  ui = once(ui,
    "if(!response.ok||!result.ok||result.durable!==true)throw Error(response.status===423?'RECOVERY_LOCK_ACTIVE — record was not saved.':result.code||'SAVE_FAILED');",
    "if(!response.ok||!result.ok||result.durable!==true)throw Error(response.status===423?'RECOVERY_LOCK_ACTIVE — record was not saved.':response.status===409?'This lead changed elsewhere. Close and reopen to refresh; newer notes have not been overwritten.':result.code||'SAVE_FAILED');",
    'stale-save message');
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
