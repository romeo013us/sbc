'use strict';
const {AutonomousBusinessFabric}=require('./autonomous-business-fabric');
const CashMatrixCore=require('./cash-matrix-core');
const MerchantSettlementMatrix=require('./merchant-settlement-matrix');
const StatelessFulfillmentGateway=require('./stateless-fulfillment-gateway');
const ChargebackDefenseGasket=require('./chargeback-defense-gasket');
const VendorPayoutLedger=require('./vendor-payout-ledger');

class AutonomousCashFabric{
 constructor(){this.fabric=new AutonomousBusinessFabric();this.core=new CashMatrixCore();this.merchant=new MerchantSettlementMatrix();this.fulfillment=new StatelessFulfillmentGateway();this.defense=new ChargebackDefenseGasket();this.payout=new VendorPayoutLedger()}
 async preflight(event={}){const gate=this.fabric.preflight({tenantId:event.tenantId||'system',authorized:true,dependencies:event.dependencies||[],rollbackPlan:event.rollbackPlan||true});const decision=this.fabric.decide({action:event.action||'observe_cash_event',confidence:Number(event.confidence??0.99),risk:event.risk||'normal',irreversible:Boolean(event.irreversible)});return {ok:gate.ok&&!decision.requiresHuman,gate,decision,handshake:this.fabric.handshake({eventType:event.type,tenantId:event.tenantId,orderId:event.orderId})}}
 async intake(){const leads=await this.core.extractHighValueTargets();this.fabric.emit('lead.discovery.completed',{count:leads.length,leads:leads.slice(0,25)},'cash-matrix');return {count:leads.length,leads}}
 async checkout(lead){const out=await this.merchant.createCheckoutSession({lead,amount:lead.valueBracket==='enterprise_premium'?149900:49900});this.fabric.emit('checkout.created',{leadId:lead.leadId,status:out.status,provider:out.mode,checkoutUrlPresent:Boolean(out.checkoutUrl)},'cash-matrix');return out}
 async paymentWebhook(payload){const result=this.merchant.processWebhook(payload);this.fabric.emit(`payment.${payload.type.includes('succeeded')||payload.type.includes('completed')?'verified':'event'}`,{id:payload.id,type:payload.type},'merchant');return result}
 async routeFulfillment(order){const pre=await this.preflight({type:'fulfillment.requested',tenantId:order.tenantId||'system',orderId:order.orderId,action:'route_fulfillment',confidence:0.99,risk:'normal',dependencies:order.dependencies||[]});if(!pre.gate.ok)return {...pre,blocked:true};const route=await this.fulfillment.routeStatelessOrder(order);this.fabric.emit('fulfillment.route.selected',route,'fulfillment');return {...pre,route}}
 async dispute(payload){const r=await this.defense.interceptDisputeEvent(payload);this.fabric.emit('payment.dispute.detected',{chargeId:payload.chargeId,bundleId:r.bundle.bundleId},'chargeback-gasket');return r}
 async margin(tx,gross,cost,policy={}){const r=await this.payout.splitMargins(tx,gross,cost,policy);this.fabric.emit('margin.calculated',{transactionId:tx,grossCents:gross,costCents:cost,netSpreadCents:r.netSpreadCents,payoutAuthorized:r.payoutAuthorized},'payout-ledger');return r}
 summary(){return {...this.fabric.summary(),cash:{liveMerchant:this.merchant.live,targetConfig:true,vendorRoutes:true}}}
}
module.exports=AutonomousCashFabric;
