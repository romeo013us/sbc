'use strict';
// Post-reconstruction P1 guard: never create leads outside the authenticated
// tenant, and serialize duplicate checks across concurrently creating writers.
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6609_SAFE_LEAD_CREATE';
function once(content,from,to,why){
 const count=content.split(from).length-1;
 if(count!==1)throw Error(MARKER+' '+why+' expected exactly one anchor, observed '+count);
 return content.replace(from,to);
}
function apply(root){
 const file=path.join(root,'routes/crm.js');
 const before=fs.readFileSync(file,'utf8');
 if(before.includes(MARKER))return {marker:MARKER,changed:false};
 if(!before.includes('function tenantForRead(req)'))throw Error(MARKER+' requires v6605 authenticated tenant guard');
 let next=once(before,
  'const tenantId = positiveTenantId(req.tenantId);',
  'const tenantId = tenantForRead(req); // '+MARKER+': only server-authenticated AsyncLocalStorage is authoritative.',
  'tenant source for creation');
 next=once(next,
  '    let conn = null;\n    let transactionStarted = false;\n    try {\n      const tenantId = tenantForRead(req);',
  '    let conn = null;\n    let transactionStarted = false;\n    let leadLockHeld = false;\n    let leadLockName = null;\n    try {\n      const tenantId = tenantForRead(req);',
  'create-handler lock state');
 next=once(next,
  '      conn = await ctx.mysqlPool.getConnection();\n      await conn.ping();\n      await conn.beginTransaction();',
  "      conn = await ctx.mysqlPool.getConnection();\n      await conn.ping();\n      // Connection-scoped MySQL named mutex prevents simultaneous duplicate inserts\n      // even when matching email/business/phone has no unique SQL index.\n      // Only holds during one tenant's short duplicate-check + insert transaction.\n      leadLockName = 'sbc_crm_create_tenant_' + tenantId;\n      const [leadLockResult] = await conn.query('SELECT GET_LOCK(?, 6) AS acquired', [leadLockName]);\n      if(Number(leadLockResult?.[0]?.acquired)!==1)throw Object.assign(new Error('LEAD_CREATE_BUSY'),{code:'LEAD_CREATE_BUSY'});\n      leadLockHeld = true;\n      await conn.beginTransaction();",
  'connection-scoped duplicate serialization');
 next=once(next,
  "      const statusCode = code === 'VALID_TENANT_CONTEXT_REQUIRED' || code === 'TENANT_DATABASE_ID_INVALID' ? 403 : 503;",
  "      const statusCode = ['VALID_TENANT_CONTEXT_REQUIRED','TENANT_CONTEXT_MISSING','TENANT_CONTEXT_MISMATCH','TENANT_DATABASE_ID_INVALID'].includes(code) ? 403 : code === 'LEAD_CREATE_BUSY' ? 409 : 503;",
  'explicit tenant and contention error codes');
 next=once(next,
  "    } finally {\n      try { conn?.release(); } catch (_) {}\n    }\n  });\n};",
  "    } finally {\n      // Always relinquish the connection-scoped mutex *before* pool reuse.\n      // On failed RELEASE_LOCK destroy the connection so MySQL cannot retain\n      // the mutex in a pooled idle connection and stall future lead creation.\n      let safeToPool = true;\n      if(conn && leadLockHeld){\n        try {\n          const [released] = await conn.query('SELECT RELEASE_LOCK(?) AS released',[leadLockName]);\n          if(Number(released?.[0]?.released)!==1)safeToPool=false;\n        }catch(_){safeToPool=false;}\n      }\n      try {\n        if(conn){if(safeToPool)conn.release();else conn.destroy();}\n      } catch (_) {}\n    }\n  });\n};",
  'release lock safely');
 fs.writeFileSync(file,next);
 return {marker:MARKER,changed:true};
}
module.exports={MARKER,apply};
