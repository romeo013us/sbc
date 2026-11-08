'use strict';
/* Static, no-AI, no-server-side demo inquiry. Illustrative interaction only. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function buildInquiry(c={},services=[]){
 const business=esc(c.business||'Your Business');
 const opts=(Array.isArray(services)?services:[]).slice(0,8).map(x=>esc(x?.name||x?.title||'Service inquiry')).filter(Boolean);
 const options=(opts.length?opts:['General inquiry']).map(s=>'<option>'+s+'</option>').join('');
 return '<section id="request" class="section"><div class="wrap">'+
  '<div class="sectionhead"><div class="meta">INTERACTIVE CUSTOMER JOURNEY · SAMPLE ONLY</div><div>'+
  '<h2>Request the next step.</h2><p class="lead">See how a visitor could reach '+business+
  '. This concept form does not send or save personal information.</p></div></div>'+
  '<form id="sbcDemoRequest" class="aboutbox" autocomplete="off" style="max-width:760px;display:grid;gap:16px">'+
  '<label style="display:grid;gap:7px">Your name<input name="visitor" required maxlength="70" style="padding:13px;border-radius:10px;border:1px solid #bbb"></label>'+
  '<label style="display:grid;gap:7px">Service of interest<select name="service" style="padding:13px;border-radius:10px;border:1px solid #bbb">'+options+'</select></label>'+
  '<label style="display:grid;gap:7px">Question<textarea name="question" maxlength="600" rows="3" style="padding:13px;border-radius:10px;border:1px solid #bbb" placeholder="Describe your question"></textarea></label>'+
  '<button type="submit" class="btn btn-main" style="background:var(--p);color:#fff;border:0;cursor:pointer;justify-self:start">Preview inquiry</button>'+
  '<p id="sbcDemoRequestFeedback" role="status" aria-live="polite" style="white-space:pre-wrap;color:#364055;font-size:14px"></p>'+
  '<small style="color:#667">Demo only. No message, appointment, payment, or personal data is transmitted.</small>'+
  '</form></div></section><script src="/sbc-demo-interactive-v1.js" defer></script>';
}
module.exports={buildInquiry};
