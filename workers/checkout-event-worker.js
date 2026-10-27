'use strict';
const crypto=require('node:crypto');

/**
 * V58.3 checkout.paid consumer.
 * Uses the immutable economic snapshot captured by StorefrontCheckoutEventHandler.
 * No refund/payment mutation is performed here.
 */
class CheckoutEventWorker {
  constructor({ pool } = {}) {
    if (!pool) throw new Error('CheckoutEventWorker requires pool');
    this.pool = pool;
  }

  async process(job) {
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : (job.payload || {});
    const tenantId = String(payload.tenant_id || '');
    if (!tenantId) throw new Error('CHECKOUT_TENANT_CONTEXT_REQUIRED');

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT * FROM sbc_checkout_event_ledger
          WHERE id = ? AND tenant_id = ?
          LIMIT 1 FOR UPDATE`,
        [payload.checkout_ledger_id, tenantId]
      );
      if (!rows.length) {
        await connection.rollback();
        return { status: 'SKIPPED_NO_CHECKOUT_LEDGER' };
      }

      const checkout = rows[0];
      const [catalogRows]=await connection.query(`SELECT sku,product_name,product_type,vendor_cost,metadata FROM sbc_product_catalog WHERE tenant_id=? AND sku=? AND active=1 AND economic_status='ACTIVE' LIMIT 1 FOR UPDATE`,[tenantId,checkout.sku]);
      if(!catalogRows.length)throw new Error('CHECKOUT_CATALOG_ROW_NO_LONGER_ACTIVE');
      const catalog=catalogRows[0];let metadata={};try{metadata=typeof catalog.metadata==='string'?JSON.parse(catalog.metadata||'{}'):(catalog.metadata||{});}catch{metadata={};}
      const rawVendor=String(metadata.fulfillmentVendor||metadata.vendor||metadata.provider||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
      const type=String(catalog.product_type||'').toLowerCase();
      const vendorMap={godaddy:'godaddy',godaddyapi:'godaddy','4over4':'fourOverFour',fouroverfour:'fourOverFour',vistaprint:'vistaPrint',internal:'internal',sbcinternal:'internal'};
      const vendor=vendorMap[rawVendor]||(/domain|hosting|wordpress|microsoft|email/.test(type)?'godaddy':/print|card|flyer|brochure/.test(type)?'fourOverFour':/service|internal|website|seo|onboarding/.test(type)?'internal':'');
      const mappingRequired=!vendor,canonicalVendor=vendor||'internal',orderReferenceMissing=!checkout.order_id;
      if (Number(checkout.vendor_cost || 0) <= 0 || Number(checkout.margin_pct || 0) < 0.30) {
        await connection.query(
          `UPDATE sbc_checkout_event_ledger
              SET status = 'FROZEN_ECONOMIC_GUARD'
            WHERE id = ? AND tenant_id = ?`,
          [checkout.id, tenantId]
        );
        await connection.commit();
        return { status: 'FROZEN_ECONOMIC_GUARD', checkout_id: checkout.id };
      }

      const [existing] = await connection.query(
        `SELECT id FROM sbc_fulfillment_tasks
          WHERE checkout_ledger_id = ? AND tenant_id = ?
          LIMIT 1`,
        [checkout.id, tenantId]
      );

      let fulfillmentId = existing[0]?.id || null;
      if (!fulfillmentId) {
        const [created] = await connection.query(
          `INSERT INTO sbc_fulfillment_tasks
            (tenant_id, checkout_ledger_id, order_id, customer_id, lead_id, sku, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
          [tenantId, checkout.id, checkout.order_id, checkout.customer_id, checkout.lead_id, checkout.sku]
        );
        fulfillmentId = created.insertId;
      }

      // SBC_V65117_CANONICAL_WORK_ORDER: same-transaction, idempotent handoff to the primary job table.
      const checkoutPayload=(()=>{try{return JSON.parse(checkout.payload_json||'{}')}catch{return {}}})();
      const quantity=Math.max(1,Math.min(10000,Number(checkoutPayload.quantity||checkoutPayload.qty||1)||1));
      const idempotencyKey='sbc:checkout:'+crypto.createHash('sha256').update(String(tenantId)+'|'+String(checkout.id)+'|'+String(checkout.sku)).digest('hex').slice(0,48);
      const jobId='checkout_fulfill_'+crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0,40);
      const [tenantRows]=await connection.query('SELECT id FROM sbc_tenants WHERE CAST(id AS CHAR)=? OR slug=? LIMIT 1',[String(tenantId),String(tenantId)]);
      if(!tenantRows.length)throw new Error('CHECKOUT_TENANT_NOT_MAPPED_TO_SBC_TENANT');
      const needsOwner=mappingRequired||orderReferenceMissing;
      const requirements={checkoutLedgerId:Number(checkout.id),sku:String(checkout.sku),amount:Number(checkout.amount||0),currency:String(checkout.currency||'USD'),vendorCost:Number(checkout.vendor_cost||0),contributionMargin:Number(checkout.contribution_margin||0),marginPct:Number(checkout.margin_pct||0),catalogType:String(catalog.product_type||''),catalogMetadata:metadata,providerMappingRequired:mappingRequired,orderReferenceMissing};
      await connection.query(`INSERT INTO sbc_fulfillment_jobs (id,tenant_id,order_id,customer_id,customer_name,item_id,product,quantity,vendor,status,vendor_status,vendor_order_number,tracking_number,cost,value,requirements_json,attempts,last_error,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)`,[jobId,Number(tenantRows[0].id),String(checkout.order_id||''),String(checkout.customer_id||''),'',String(checkout.sku),String(catalog.product_name||checkout.sku),quantity,canonicalVendor,needsOwner?'owner_clearance_required':'ready',mappingRequired?'provider_mapping_required':orderReferenceMissing?'order_reference_required':'not_submitted','','',Number(checkout.vendor_cost||0),Number(checkout.amount||0),JSON.stringify(requirements),0,'',idempotencyKey,new Date().toISOString().slice(0,19).replace('T',' '),new Date().toISOString().slice(0,19).replace('T',' ')]);
      await connection.query(
        `UPDATE sbc_checkout_event_ledger
            SET status = 'FULFILLMENT_QUEUED'
          WHERE id = ? AND tenant_id = ?`,
        [checkout.id, tenantId]
      );

      await connection.commit();
      return { status: 'FULFILLMENT_QUEUED', checkout_id: checkout.id, fulfillment_id: fulfillmentId };
    } catch (err) {
      try { await connection.rollback(); } catch (_) {}
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = CheckoutEventWorker;
