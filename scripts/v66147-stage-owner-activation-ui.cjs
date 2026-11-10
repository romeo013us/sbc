'use strict';
/* V66.147 adds owner-initiated review candidates and paid-order preflight to
 * existing Acceptance Desk; stage only in isolated GitHub build.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66147_OWNER_SALES_DELIVERY_REVIEW_UI';
const SECTION_ANCHOR="'<section class=\"card\"><div class=\"card-body\"><h3>📦 Delivery acceptance</h3>'+";
const SCRIPT_ANCHOR='async function sbcAcceptOrderLookup(){';
const SECTION="\n'<section class=\"card\"><div class=\"card-body\"><h3>🎯 Owner sales and delivery activation</h3>'+\n'<p class=\"mini\">Review up to 20 existing CRM prospects for source, phone and DNC verification. No automatic calling, email, SMS or lead-status changes. Separately inspect genuine payment-record candidates excluding internal QA.</p>'+\n'<button type=\"button\" class=\"btn\" onclick=\"sbcAcceptActivationReview()\">Review next 20 leads &amp; paid orders</button>'+\n'<div id=\"sbcAcceptActivationResult\" role=\"status\" aria-live=\"polite\" class=\"mini\" style=\"margin-top:10px\"></div></div></section>'+\n";
const SCRIPT="\n/* SBC_V66147_OWNER_SALES_DELIVERY_REVIEW_UI */\nasync function sbcAcceptActivationReview(){\n if(state.me?.role!=='owner')return;\n const out=document.getElementById('sbcAcceptActivationResult');\n if(!out)return;\n out.textContent='Reading CRM and stored Square evidence…';\n try{\n  const d=await api('/api/owner/revenue/activation-review?limit=20',{timeoutMs:20000});\n  if(!out.isConnected)return;\n  const leads=Array.isArray(d.leadShortlist)?d.leadShortlist:[];\n  const paid=Array.isArray(d.paidOrderCandidates)?d.paidOrderCandidates:[];\n  state.sbcV66147LeadIds=leads.map(x=>String(x.id||''));\n  state.sbcV66147OrderIds=paid.map(x=>String(x.orderId||''));\n  const heads='<p><strong>'+esc(String(d.counts?.reviewEligible??0))+\n   ' eligible for human verification review</strong> · '+esc(String(d.counts?.needsSourceVerification??0))+\n   ' not yet verified · '+esc(String(d.counts?.missingCallablePhone??0))+\n   ' missing usable phone in active leads</p>'+\n   (d.projectionMatchesSql===false?\n    '<p>⚠ Loaded CRM and MySQL counts differ. This shortlist may omit SQL-only records. Investigate CRM integrity first.</p>':'')+\n   '<p class=\"mini\">These are NOT approved calling tasks. Check source, decision maker, number ownership, DNC/consent, time zone and owner approval on each record.</p>';\n  const leadsHtml=leads.map((c,i)=>\n   '<div style=\"padding:7px 0;border-bottom:1px solid #ddd\"><strong>'+\n   esc(c.businessName||'Unknown')+'</strong> · '+esc(c.temperature||'unranked')+\n   ' · Phone ending '+esc(c.phoneLast4||'—')+\n   '<div>Source: '+esc(c.source||'not recorded')+\n   ' · '+esc(c.reviewReason||'REVIEW_REQUIRED')+'</div>'+\n   '<div>ID '+esc(c.id||'')+' · <button type=\"button\" class=\"btn small\" onclick=\"sbcV66147ReviewLeadAt('+i+')\">Open CRM record for review</button></div></div>'\n  ).join('');\n  const paidHtml=paid.map((o,i)=>\n   '<div style=\"padding:7px 0;border-bottom:1px solid #ddd\"><strong>'+\n   esc(o.product||'Unnamed service')+'</strong> · $'+esc(String(o.recordedAmount??0))+\n   '<div>ID '+esc(o.orderId||'')+\n   ' · SBC-recorded Square payment only · <button type=\"button\" class=\"btn small\" onclick=\"sbcV66147ReviewOrderAt('+i+')\">Check delivery evidence</button></div></div>'\n  ).join('');\n  out.innerHTML=heads+'<h4>Leads to verify manually ('+leads.length+')</h4>'+\n   (leadsHtml||'<p>No source-review candidates found. No call tasks were created.</p>')+\n   '<h4>Recorded paid customer-order candidates ('+esc(String(d.paidOrderCandidateCount??0))+')</h4>'+\n   (paidHtml||'<p>No non-QA Square-capture orders observed in loaded CRM. This does NOT prove no external sale occurred.</p>')+\n   '<p class=\"mini\">Internal QA orders excluded: '+esc(String(d.excludedQaOrders??0))+\n   '. Status-only paid labels needing proof: '+esc(String(d.statusOnlyOrdersNeedIndependentPaymentProof??0))+'.</p>'+\n   '<p class=\"mini\">Read-only preview; no lead was verified, contacted or changed. Provider settlement and delivery remain independently unverified.</p>';\n }catch(e){if(out.isConnected)out.textContent='Activation review unavailable: '+String(e?.message||e);}\n}\nfunction sbcV66147ReviewLeadAt(i){\n if(state.me?.role!=='owner')return;\n const id=state.sbcV66147LeadIds?.[i];\n if(!id)return toast('No lead selected');\n editCustomer(id);\n}\nfunction sbcV66147ReviewOrderAt(i){\n if(state.me?.role!=='owner')return;\n const id=state.sbcV66147OrderIds?.[i],input=document.getElementById('sbcAcceptOrder');\n if(!id||!input)return toast('No order selected');\n input.value=id;\n return sbcAcceptOrderLookup();\n}\n";
function once(s,a,b,kind){
 const n=s.split(a).length-1;
 if(n!==1)throw Error('ACTIVATION_UI_ANCHOR_'+kind+'_'+n);
 return s.replace(a,()=>b);
}
function patchApp(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI'))throw Error('ACTIVATION_REQUIRES_OWNER_CRM_DIAGNOSTICS');
 s=once(s,SECTION_ANCHOR,SECTION+SECTION_ANCHOR,'section');
 s=once(s,SCRIPT_ANCHOR,SCRIPT+'\n'+SCRIPT_ANCHOR,'script');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const names=['public/app.js','browser_public/app.js'];
 const source=names.map(n=>fs.readFileSync(path.join(root,n),'utf8'));
 if(source[0]!==source[1])throw Error('ACTIVATION_UI_SOURCE_MIRROR_MISMATCH');
 const output=source.map(patchApp);
 if(output[0]!==output[1])throw Error('ACTIVATION_UI_OUTPUT_MIRROR_MISMATCH');
 if(apply){
  if(process.env.SBC_V66147_ISOLATED_STAGE!=='YES')throw Error('ACTIVATION_UI_DISPOSABLE_STAGE_ONLY');
  names.forEach((n,i)=>fs.writeFileSync(path.join(root,n),output[i]));
 }
 return {changed:output[0]!==source[0],bytes:output[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('ACTIVATION_UI_NOT_STAGED');
 console.log('[V66.147] Owner activation UI '+(r.changed?'READY_TO_STAGE':'COMPILED_PRESENT'));
}
module.exports={MARK,patchApp,patchFiles};
