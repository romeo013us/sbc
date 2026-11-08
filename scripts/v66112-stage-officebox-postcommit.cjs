'use strict';
/* SBC V66.112: staged owner-only post-payment Office Box V2 reconcile route.
 * Never touches previously working Square checkout or Twilio routes.
 * Only runs in disposable GitHub packaging checkout.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION';
const root=path.resolve(__dirname,'..'),file=path.join(root,'server.js');
const route=[
 " // "+MARK,
 " app.post('/api/owner/officebox/reconcile/:orderId',auth,ownerOnly,async(req,res)=>{",
 "   try{",
 "     SBC_V6649_REQUIRE_WRITER();",
 "     const tenantId=requireRequestTenant(req),orderId=String(req.params.orderId||'');",
 "     // Refuse cross-tenant or missing in-memory projections BEFORE any external request.",
 "     const liveOrder=(db.orders||[]).find(o=>String(o.id)===orderId&&Number(o.tenantId)===Number(tenantId));",
 "     if(!liveOrder)return res.status(404).json({ok:false,error:'OFFICEBOX_ORDER_NOT_FOUND_IN_ACTIVE_TENANT'});",
 "     const handoff=await require('./enterprise/v66112-officebox-postcommit.cjs').reconcile({tenantId,orderId},{",
 "       pool:mysqlPool,squareApi,fetch:globalThis.fetch,baseUrl:process.env.SBC_OFFICE_BOX_URL,",
 "       secret:process.env.SBC_WEBHOOK_SECRET,locationId:process.env.SQUARE_LOCATION_ID",
 "     });",
 "     // A repeated handoff does not return a token. Recover only a previously committed, identical correlation.",
 "     const prior=orderParsed(liveOrder);",
 "     let activationUrl=handoff.activationUrl||null;",
 "     if(!activationUrl && handoff.duplicate && prior.officeBoxV2CorrelationId===handoff.correlationId){",
 "       try{const saved=new URL(String(prior.officeBoxActivationUrl||''));const origin=new URL(String(process.env.SBC_OFFICE_BOX_URL||''));",
 "         if(saved.protocol==='https:' && saved.origin===origin.origin && saved.searchParams.has('token'))activationUrl=saved.toString();",
 "       }catch(e){}",
 "     }",
 "     if(activationUrl){",
 "       updateOrderParsed(liveOrder,{officeBoxV2CorrelationId:handoff.correlationId,officeBoxV2Status:handoff.status,",
 "         officeBoxActivationUrl:activationUrl,officeBoxV2ReconciledAt:now()});",
 "       await saveData();",
 "     }",
 "     let notification='NOT_SENT';",
 "     if(activationUrl){",
 "       const customer=(db.customers||[]).find(c=>String(c.id)===handoff.customerId&&Number(c.tenantId)===Number(tenantId));",
 "       if(customer?.email&&orderParsed(liveOrder).officeBoxActivationSentAt){notification='ALREADY_SENT';}",
 "       else if(customer?.email){",
 "         try{await require('./enterprise/sbc-hosting-email-gateway.cjs').sendEmail({",
 "           to:customer.email,subject:'Activate your Successful By Choice Office Box',",
 "           text:'Your Office Box account is ready for secure activation. Use your private link: '+activationUrl+'\\n\\nThis is a single-use activation invitation.'",
 "         });",
 "           notification='SENT';",
 "           updateOrderParsed(liveOrder,{officeBoxActivationSentAt:now()});await saveData();",
 "         }catch(e){notification='HELD_EMAIL_DELIVERY_FAILED';addActivity('office_box_v2_notification_held','Office Box invitation email held for '+orderId,{orderId,reason:String(e.code||e.message).slice(0,120)});}",
 "       }else notification='HELD_CUSTOMER_EMAIL_UNAVAILABLE';",
 "     }",
 "     audit(req.user,'office_box_v2_reconciled','Verified Office Box paid handoff and durable invitation status',{orderId,tenantId,status:handoff.status,notification});",
 "     return res.json({ok:true,orderId,correlationId:handoff.correlationId,status:handoff.status,",
 "       activationUrl,notification});",
 "   }catch(e){",
 "     const status=Number(e?.status)||SBC_V6649_ERROR_STATUS(e);",
 "     return res.status(status>=400&&status<600?status:503).json({ok:false,error:String(e?.code||'OFFICEBOX_RECONCILIATION_FAILED')});",
 "   }",
 " });",
 ""
].join('\n');
function patchServer(s){
 if(s.includes(MARK))return s;
 const anchor="app.get('/api/fantastic4/summary',auth,";
 assert.equal(s.split(anchor).length-1,1,'must locate unique owner-safe Fantastic 4 anchor');
 assert(s.includes("function SBC_V6649_REQUIRE_WRITER()"),'writer guard must exist');
 assert(s.includes("async function sendBig3OfficeBoxHandoff("),'existing legacy flow must remain untouched');
 let out=s.replace(anchor,route+anchor);
 const postCommitAnchor="records.splice(5000); await saveData(); return {ok:true,orderId:order.id,status:rec.status,squarePaymentId:rec.squarePaymentId};";
 assert.equal(out.split(postCommitAnchor).length-1,1,'exact paid-order post-commit anchor required');
 const postCommit=[
   "records.splice(5000); await saveData();",
   "// SBC_V66112_PAID_ORDER_AUTO_V2: after committed Square capture, no new payments or vendor purchases.",
   "if(status==='COMPLETED' && sbcWriterLeaseReady && MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED){",
   "  const obv2=require('./enterprise/v66112-officebox-postcommit.cjs');",
   "  const details=orderParsed(order);",
   "  if(obv2.skuFor(details) && !details.sbcLaunchQa && !details.officeBoxV2CorrelationId){",
   "    try{",
   "      const handoff=await obv2.reconcile({tenantId:Number(order.tenantId||TENANT_DEFAULT_ID),orderId:order.id},{",
   "        pool:mysqlPool,squareApi,fetch:globalThis.fetch,baseUrl:process.env.SBC_OFFICE_BOX_URL,",
   "        secret:process.env.SBC_WEBHOOK_SECRET,locationId:process.env.SQUARE_LOCATION_ID",
   "      });",
   "      if(handoff.activationUrl){",
   "        updateOrderParsed(order,{officeBoxV2CorrelationId:handoff.correlationId,officeBoxV2Status:handoff.status,officeBoxActivationUrl:handoff.activationUrl,officeBoxV2ReconciledAt:now()});",
   "        await saveData();",
   "        const buyer=(db.customers||[]).find(c=>String(c.id)===handoff.customerId&&Number(c.tenantId)===Number(order.tenantId||TENANT_DEFAULT_ID));",
   "        if(buyer?.email && !orderParsed(order).officeBoxActivationSentAt){",
   "          try{",
   "            await require('./enterprise/sbc-hosting-email-gateway.cjs').sendEmail({to:buyer.email,subject:'Activate your Successful By Choice Office Box',text:'Your Office Box account is ready for secure activation. Your private, single-use link: '+handoff.activationUrl});",
   "            updateOrderParsed(order,{officeBoxActivationSentAt:now()});await saveData();",
   "          }catch(error){addActivity('office_box_v2_activation_email_held','Paid Office Box activation email needs delivery review for '+order.id,{orderId:order.id,reason:String(error?.code||'GATEWAY_DELIVERY_FAILED').slice(0,80)});}",
   "        }",
   "        addActivity('office_box_v2_postcommit_provisioned','Paid Office Box activation invitation created for '+order.id,{orderId:order.id,correlationId:handoff.correlationId});",
   "      }else addActivity('office_box_v2_replay_requires_reconcile','Office Box accepted an earlier V2 handoff; owner reconciliation needed for '+order.id,{orderId:order.id});",
   "    }catch(error){addActivity('office_box_v2_postcommit_retry_needed','Paid Office Box activation needs attention for '+order.id,{orderId:order.id,reason:String(error?.code||'OFFICEBOX_RECONCILE_FAILED').slice(0,120)});}",
   "  }",
   "}",
   "return {ok:true,orderId:order.id,status:rec.status,squarePaymentId:rec.squarePaymentId};"
 ].join('\n');
 out=out.replace(postCommitAnchor,postCommit);
 return out;
}
if(require.main===module){
 const existing=fs.readFileSync(file,'utf8');
 const patched=patchServer(existing);
 assert.equal(patchServer(patched),patched,'staging must be idempotent');
 if(process.argv.includes('--apply')){
   if(process.env.SBC_V66112_ISOLATED_STAGE!=='YES')throw Error('OFFICEBOX_REFUSE_NON_DISPOSABLE_STAGING');
   fs.writeFileSync(file,patched);
   console.log('[SBC V66.112] owner reconcile route staged: committed MySQL + provider readback + signed Office Box V2');
 }else console.log('[SBC V66.112] PASS dry-run safely anchored route');
}
module.exports={MARK,patchServer};
