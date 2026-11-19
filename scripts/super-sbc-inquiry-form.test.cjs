'use strict';
// Synthetic Super SBC form acceptance. Never posts a customer inquiry, email, or payment.
const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'index.php'),'utf8');
function formHTML(id){
 const match=page.match(new RegExp('<form id="'+id+'"[^>]*>([\\s\\S]*?)<\\/form>'));
 assert(match,'missing '+id+' form');
 return match[1];
}
function assertNamed(form,id,name){
 const tag=form.match(new RegExp('<(?:input|textarea|select)\\b[^>]*\\bid="'+id+'"[^>]*>'));
 assert(tag,'missing #'+id);
 assert.match(tag[0],new RegExp('\\bname="'+name+'"'),'field #'+id+' needs name="'+name+'" for FormData');
}
function invalidPost(data){
 // Invalid payloads must be refused before any outbound bridge or mail.
 const php="$_SERVER['REQUEST_METHOD']='POST';$_POST=json_decode($argv[1],true);require 'index.php';";
 const result=cp.execFileSync('php',['-r',php,'--',JSON.stringify(data)],{cwd:root,encoding:'utf8',timeout:12000});
 return JSON.parse(result);
}
test('card brief includes every labeled answer in actual AJAX FormData',()=>{
 const html=formHTML('cardQuestionnaire');
 for(const [id,name] of [['qBusiness','business'],['qName','name'],['qPhone','phone'],['qEmail','email'],['qQty','qty'],['qColors','colors'],['qStyle','style'],['qDetails','details'],['qNotes','notes']])assertNamed(html,id,name);
 assert.match(page,/new FormData\(form\)/,'send action must submit FormData');
});
test('sign quote collects an actual follow-up contact channel',()=>{
 const html=formHTML('signForm');
 assert.match(html,/<input[^>]+name="phone"[^>]+type="tel"|<input[^>]+type="tel"[^>]+name="phone"/);
 assert.match(html,/<input[^>]+name="email"[^>]+type="email"|<input[^>]+type="email"[^>]+name="email"/);
 assert.match(page,/'phone'=>\$phone/,'sign CRM request must include callback phone');
 assert.match(page,/'email'=>\$email/,'sign CRM request must include callback email');
});
test('server refuses incomplete card and sign inquiries without callback details',()=>{
 const card=invalidPost({sbc_form:'card',business:'Test Shop',name:'Alex',phone:'',email:''});
 const sign=invalidPost({sbc_form:'sign',name:'Alex',sign_type:'Neon',details:'Test',phone:'',email:''});
 assert.equal(card.ok,false);assert.equal(sign.ok,false);
 assert.match(String(card.message),/phone|email/i);
 assert.match(String(sign.message),/phone|email/i);
});
test('website only emits a lead analytics signal after CRM acknowledges the inquiry',()=>{
 assert.match(page,/sbcTrackConfirmedWebsiteInquiry/);
 assert.match(page,/result\.ok\s*===\s*true\s*&&\s*result\.crmLead\s*===\s*true/);
 assert.match(page,/sbc_lead_accepted/);
 assert.doesNotMatch(page,/dataLayer\.push\(\{[^}]*\bemail\s*:/);
});
