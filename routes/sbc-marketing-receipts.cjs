'use strict';
const {CHANNELS,businessDate,validDay,createReadback} = require('../enterprise/sbc-marketing-readback.cjs');

const TABLE = 'sbc_marketing_slot_receipts';
const SCHEMA = `CREATE TABLE IF NOT EXISTS sbc_marketing_slot_receipts (
  tenant_id BIGINT NOT NULL, day_et CHAR(10) NOT NULL, platform VARCHAR(16) NOT NULL,
  slot CHAR(2) NOT NULL, provider_id VARCHAR(225) CHARACTER SET ascii COLLATE ascii_bin NULL,
  recorded_at DATETIME(3) NOT NULL, verified_at DATETIME(3) NULL, published_at CHAR(24) NULL,
  permalink VARCHAR(2048) NULL,
  PRIMARY KEY (tenant_id,day_et,platform,slot),
  UNIQUE KEY uq_sbc_marketing_receipt (tenant_id,platform,provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const SLOT_COLUMNS = 'day_et,platform,slot,provider_id,published_at,permalink,verified_at';
function error(code,status) { return Object.assign(Error(code), {code,status}); }
function validateInput({platform,slot,postId}) {
  if (!Object.hasOwn(CHANNELS,platform) || !['AM','PM'].includes(slot)) throw error('INVALID_SLOT',400);
  if (postId === '' || postId === null || postId === undefined) return null;
  if (typeof postId !== 'string' || postId.length > 225) throw error('INVALID_PROVIDER_ID',400);
  const formats = {
    facebook:/^1473280249199334_\d+$/, instagram:/^\d+$/, linkedin:/^urn:li:(?:share|ugcPost):\d+$/,
    google:/^accounts\/\d+\/locations\/3970405300470441047\/localPosts\/\d+$/
  };
  if (!formats[platform].test(postId)) throw error('INVALID_PROVIDER_ID',400);
  return postId;
}
async function listSlots(pool, tenant, day) {
  try {
    const [rows] = await pool.query('SELECT '+SLOT_COLUMNS+' FROM '+TABLE+' WHERE tenant_id=? AND day_et=? ORDER BY platform,slot',[tenant,day]);
    return rows;
  } catch (e) { if (e.code === 'ER_NO_SUCH_TABLE') return []; throw e; }
}
async function recordSlot(pool, tenant, day, input) {
  const postId = validateInput(input);
  const key = [tenant,day,input.platform,input.slot];
  await pool.query(SCHEMA);
  // Insert the slot without a remote ID. A duplicate-key update then targets only this slot.
  // InnoDB serializes concurrent writes. A conflicting remote ID rolls back the whole attempt.
  const tx = await pool.getConnection();
  try {
    await tx.beginTransaction();
    await tx.query('INSERT INTO '+TABLE+' (tenant_id,day_et,platform,slot,recorded_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE slot=slot',key);
    const where = ' WHERE tenant_id=? AND day_et=? AND platform=? AND slot=?';
    const [[row]] = await tx.query('SELECT provider_id FROM '+TABLE+where+' FOR UPDATE',key);
    if (postId && row.provider_id && row.provider_id !== postId) throw error('SLOT_ALREADY_HAS_ANOTHER_RECEIPT',409);
    if (postId && !row.provider_id) await tx.query('UPDATE '+TABLE+' SET provider_id=?'+where,[postId,...key]);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw error('RECEIPT_ALREADY_ASSIGNED',409);
    throw e;
  } finally { tx.release(); }
}
async function reconcileSlots(pool, tenant, report) {
  const slots = await listSlots(pool,tenant,report.day);
  for (const row of slots) {
    if (!row.provider_id || row.verified_at) continue;
    const channel = report.channels.find(item => item.platform === row.platform);
    const proof = channel?.receipts.find(item => item.id === row.provider_id);
    if (!proof) continue;
    await pool.query('UPDATE '+TABLE+' SET verified_at=UTC_TIMESTAMP(3),published_at=?,permalink=? WHERE tenant_id=? AND day_et=? AND platform=? AND slot=? AND provider_id=? AND verified_at IS NULL',
      [proof.publishedAt,proof.link,tenant,report.day,row.platform,row.slot,row.provider_id]);
  }
}
function registerMarketingReceipts(app, {auth,ownerOnly,tenantOf,corporateTenant,getPool,canWrite,getKey,clock=Date.now,request=fetch}) {
  const read = createReadback({getKey,clock,request});
  const base = '/api/marketing/publication-receipts';
  function mount(method,path,handler) {
    app[method](base+path,auth,ownerOnly,async (req,res) => {
      res.setHeader('Cache-Control','no-store');
      try {
        const tenant = tenantOf(req);
        if (tenant !== corporateTenant) return res.status(403).json({ok:false,error:'SBC_BUSINESS_ACCOUNT_REQUIRED'});
        const today = businessDate(clock());
        const day = req.query.day ?? today;
        if (!validDay(day) || day > today || Date.parse(day+'T00:00:00Z') < clock()-32*86400000) throw error('INVALID_REPORT_DATE',400);
        const pool = getPool();
        if (method !== 'get' && (!pool || !canWrite())) throw error('MARKETING_WRITER_UNAVAILABLE',423);
        const value = await handler({pool,tenant,day,input:req.body || {}});
        res.json({ok:true,...value});
      } catch (e) {
        const status = [400,409,423].includes(e.status) ? e.status : 503;
        res.status(status).json({ok:false,error:status===503?'RECEIPT_STORE_UNAVAILABLE':e.code});
      }
    });
  }
  mount('get','',async ({day,pool,tenant}) => {
    const [report,slots] = await Promise.all([read(day),pool ? listSlots(pool,tenant,day).catch(() => null) : null]);
    return {...report,slots,canRecord:Boolean(pool && canWrite())};
  });
  mount('post','',async ({day,pool,tenant,input}) => {
    await recordSlot(pool,tenant,day,input);
    return {recorded:true};
  });
  mount('post','/reconcile',async ({day,pool,tenant}) => {
    const report = await read(day);
    await reconcileSlots(pool,tenant,report);
    return {slots:await listSlots(pool,tenant,day)};
  });
}
module.exports = {registerMarketingReceipts,recordSlot,listSlots,reconcileSlots,validateInput};
