'use strict';
const crypto=require('node:crypto');
// Legacy client link: 24 random bytes represented as exact hexadecimal, never executable HTML.
const TOKEN=/^[a-f0-9]{48}$/i;
function validToken(value){return typeof value==='string'&&TOKEN.test(value);}
const STYLE='body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}.wrap{box-sizing:border-box;width:100%;max-width:900px;margin:40px auto;padding:20px;min-width:0}.card{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 8px 30px rgba(15,23,42,.06)}.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700}.step{padding:10px;border-bottom:1px solid #eef2f7}.done{color:#15803d}.logo{max-width:180px}.muted{color:#475569}';
function clientRuntime(token){
 'use strict';
 const root=document.getElementById('app');
 function el(tag,value,className){const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined&&value!==null)n.textContent=String(value);return n;}
 function card(){return el('section',null,'card');}
 function error(){root.replaceChildren();const c=card();c.append(el('h2','Client hub unavailable'),el('p','Please contact Successful By Choice if you need assistance.'));root.append(c);}
 function show(data){
  if(!data||data.error||!data.customer||!Array.isArray(data.projects)){error();return;}
  root.replaceChildren();
  const intro=card();intro.append(el('h1','Welcome, '+String(data.customer.contactName||'Customer')),el('p',data.customer.businessName||''));
  const company=data.company||{};
  intro.append(el('p',[company.name||'Successful By Choice',company.phone||'',company.email||''].filter(Boolean).join(' · '),'muted'));root.append(intro);
  for(const project of data.projects.slice(0,100)){
   const section=card();section.append(el('h2',project.packageName||'SBC service'),el('span',project.status||'Pending','badge'));
   for(const step of (Array.isArray(project.steps)?project.steps:[]).slice(0,150)){
    section.append(el('div',String(step.status==='Completed'?'✓ ':'')+String(step.name||'Step')+' — '+String(step.status||'Pending'),'step'+(step.status==='Completed'?' done':'')));
   }
   root.append(section);
  }
  const support=card();support.append(el('h2','Support'),el('p',String(Array.isArray(data.tickets)?data.tickets.length:0)+' support request(s) on file.'));root.append(support);
 }
 fetch('/api/public/client/'+encodeURIComponent(token),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
 .then(r=>{if(!r.ok)throw Error('unavailable');return r.json()}).then(show).catch(error);
}
function render(token){
 if(!validToken(token))throw Error('INVALID_CLIENT_HUB_TOKEN');
 const nonce=crypto.randomBytes(16).toString('base64');
 const script='('+clientRuntime.toString()+')('+JSON.stringify(token)+');';
 const csp="default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'nonce-"+nonce+"'; script-src 'nonce-"+nonce+"'";
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SBC Client Hub</title><style nonce="'+nonce+'">'+STYLE+'</style></head><body><main class="wrap"><img class="logo" src="/assets/sbc-logo.jpg" alt="Successful By Choice"><div id="app" aria-live="polite">Loading your SBC Client Hub…</div></main><script nonce="'+nonce+'">'+script+'</script></body></html>';
 return {html,csp};
}
module.exports={validToken,render};
