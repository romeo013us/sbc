'use strict';
const mysql=require('mysql2/promise');
(async()=>{
  if(!(process.env.DB_HOST&&process.env.DB_USER&&process.env.DB_NAME)){throw new Error('DB_HOST, DB_USER and DB_NAME are required; this audit performs SELECTs only.')}
  const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306)});
  const [[counts]]=await db.query(`SELECT COUNT(*) total,SUM(status IN ('VERIFIED','OWNER_VERIFIED','SALES_READY')) verified_status,SUM(phone_normalized REGEXP '^\\+[1-9][0-9]{7,14}$') e164_phone,SUM(email REGEXP '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') valid_email,SUM(updated_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR) fresh_24h FROM sbc_lead_mesh`);
  const [statuses]=await db.query(`SELECT status,COUNT(*) count FROM sbc_lead_mesh GROUP BY status ORDER BY count DESC,status`);
  const [[schema]]=await db.query(`SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION SEPARATOR ',') columns FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sbc_lead_mesh'`);
  const [rows]=await db.query(`SELECT id,status,phone_normalized,email,updated_at FROM sbc_lead_mesh ORDER BY id DESC LIMIT 243`);
  const promotionReady=rows.filter(r=>['VERIFIED','OWNER_VERIFIED','SALES_READY'].includes(String(r.status||''))&&/^\+[1-9][0-9]{7,14}$/.test(String(r.phone_normalized||''))&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email||''))&&new Date(r.updated_at).getTime()>=Date.now()-86400000).length;
  console.log(JSON.stringify({readOnly:true,table:'sbc_lead_mesh',schema:(schema?.columns||'').split(',').filter(Boolean),counts,statuses,promotionReady,records:rows.map(r=>({id:Number(r.id),status:r.status,phoneE164:/^\+[1-9][0-9]{7,14}$/.test(String(r.phone_normalized||'')),emailValid:/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email||'')),fresh24h:new Date(r.updated_at).getTime()>=Date.now()-86400000}))},null,2));
  await db.end();
})().catch(e=>{console.error('PROVENANCE AUDIT FAIL:',e.message);process.exit(1)});
