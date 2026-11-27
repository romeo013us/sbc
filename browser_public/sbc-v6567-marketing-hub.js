(function(){
'use strict';
const KEY='sbc.marketingHub.v6567';
const MARKER='SBC_V6567_MARKETING_HUB';
if(window.__SBC_V6567_MARKETING_HUB__)return;window.__SBC_V6567_MARKETING_HUB__=true;
const stateDefault={items:[],activeTab:'overview',notice:'',draft:{title:'',platform:'facebook',offer:'SBC Business Packages',body:'',mediaUrl:'',ctaUrl:'',cta:'Learn more',scheduledAt:''},prospect:{businessName:'',industry:'Local small business',offer:'SBC Business Packages',cta:'Book a call',body:''}};
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&Array.isArray(v.items)?v:stateDefault}catch(_){return stateDefault}}
let state=load();let root=null;let previousFocus=null;const pendingServerActions=new Set();if(!state.prospect)state.prospect={...stateDefault.prospect};
const offers=['Miami Next Level','SBC Business Packages','Florida Notary Public Services','Office Box','Print & Business Cards','New Look Pressure'];
let hubPublisher='unknown';
const tabs=[['overview','Overview'],['trend','Trend Lab'],['studio','Content Studio'],['queue','Approval Queue'],['calendar','Calendar'],['receipts','Publication receipts'],['integrations','Integrations'],['prospect','Prospect Preview'],['analytics','Analytics']];
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch(_){notice('Browser storage is unavailable. Your latest changes may not persist.');return false}}
function notice(s){state.notice=s;render()}
function id(){return 'mh-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function itemStatus(x){return x.status==='approved'?'Approved':x.status==='scheduled'?'Scheduled':x.status==='published'?'Published':x.status==='publishing'?'Publishing':x.status==='failed'?'Publish failed':x.status==='pending'?'Awaiting approval':x.status==='rejected'?'Needs edits':'Draft'}
function badge(status){const cls=status==='approved'||status==='published'?'good':status==='scheduled'?'blue':status==='rejected'?'warn':'neutral';return '<span class="mh-badge '+cls+'">'+esc(itemStatus({status}))+'</span>'}
function navButton(){let nav=document.querySelector('.sidebar nav, aside nav, .sidebar .nav, #sidebar nav, nav[aria-label="Main navigation"]');if(!nav)nav=document.querySelector('.sidebar');if(!nav)return false;if(document.getElementById('sbcMarketingHubNav'))return true;const b=document.createElement('button');b.id='sbcMarketingHubNav';b.type='button';b.className='mh-nav-button';b.innerHTML='<span aria-hidden="true">◈</span><span>Marketing Hub</span>';b.addEventListener('click',openHub);nav.appendChild(b);return true}
function closeHub(){if(!root)return;root.hidden=true;const prior=previousFocus;previousFocus=null;if(prior&&prior.isConnected&&typeof prior.focus==='function')prior.focus()}
function openHub(){previousFocus=document.activeElement;if(root){root.hidden=false;render();root.querySelector('.mh-close')?.focus();return}root=document.createElement('section');root.id='sbcMarketingHubV6567';root.setAttribute('aria-label','SBC Marketing Hub');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.innerHTML='<div class="mh-shell"><header class="mh-header"><div><div class="mh-eyebrow">SUCCESSFUL BY CHOICE · GROWTH SYSTEM</div><h1>Marketing Hub</h1><p>Plan content, route approvals, and prepare official-channel publishing.</p></div><button type="button" class="mh-close" aria-label="Close Marketing Hub">Back to Command Center</button></header><div class="mh-truth"><strong>Publishing safeguard</strong><span>Drafting and approval work here. Live posting stays locked until official API credentials and server-side publishing checks are verified.</span></div><nav class="mh-tabs" aria-label="Marketing Hub sections"></nav><div class="mh-notice" role="status" aria-live="polite"></div><div class="mh-content"></div><footer>SBC database sync is used when the published writer API is ready; browser-local fallback is clearly indicated. Live publishing remains gated.</footer></div>';
document.body.appendChild(root);root.querySelector('.mh-close').addEventListener('click',closeHub);root.querySelector('.mh-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){state.activeTab=b.dataset.tab;persist();render();root.querySelector('.mh-tabs [data-tab="'+state.activeTab+'"]')?.focus();if(state.activeTab==='analytics')loadMarketingAnalytics();if(state.activeTab==='receipts')void loadReceipts();if(state.activeTab==='creatives')void loadCreatives()}});root.addEventListener('click',handleClick);
root.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();closeHub();return}
 if(e.key!=='Tab')return;
 const controls=Array.from(root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
 if(!controls.length)return;
 const first=controls[0],last=controls[controls.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
root.addEventListener('submit',handleSubmit);render();root.querySelector('.mh-close')?.focus();loadIntegrationStatus();loadHubData();if(state.activeTab==='receipts')void loadReceipts();if(state.activeTab==='creatives')void loadCreatives()}
function loadMarketingAnalytics(){window.__SBC_V6567_ANALYTICS_LOADING__=true;state.notice='Loading verified provider insights…';render();fetch('/api/marketing/analytics',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw new Error(d.error||('HTTP '+r.status));window.__SBC_V6567_ANALYTICS__=d;state.notice='Provider insights refreshed from official APIs.'}).catch(e=>{window.__SBC_V6567_ANALYTICS__={ok:false,error:String(e.message||'Analytics unavailable')};state.notice='Provider metrics unavailable: '+String(e.message||'API error')}).finally(()=>{window.__SBC_V6567_ANALYTICS_LOADING__=false;render()})}
function renderProviderInsights(data){if(!data||!data.platforms)return '<section class="mh-panel"><h2>Platform insights</h2><p>Load verified metrics from Meta and Google Business Profile. Missing credentials or permissions are shown as unavailable, not as zero.</p><button data-action="refresh-analytics">Refresh provider insights</button></section>';return '<section class="mh-panel"><h2>Provider insights</h2><p>Period: '+(data.periodDays?esc(data.periodDays+' days'):'provider-specific')+'. Missing values indicate unavailable API metrics.</p><div class="mh-integrations">'+[['facebook','Facebook Page'],['instagram','Instagram Professional'],['google','Google Business Profile']].map(([k,n])=>{const p=data.platforms[k]||{},m=p.metrics;return '<article class="mh-integration"><div class="mh-integration-copy"><strong>'+n+'</strong><small>'+(p.verified?'Verified API response':esc(p.errorCode||'Metrics unavailable'))+'</small>'+(m?'<div class="mh-metric-list">'+Object.entries(m).map(([key,val])=>'<span><b>'+esc(key.replaceAll('_',' '))+'</b>: '+esc(val===null?'Unavailable':Number(val).toLocaleString())+'</span>').join('')+'</div>':'<small>No verified metrics returned.</small>')+'</div></article>'}).join('')+'</div><button class="secondary" data-action="refresh-analytics">Refresh provider insights</button></section>'}
function mapServerItem(x){const raw=String(x.status||'draft').toLowerCase();const status=raw==='pending_approval'?'pending':raw;return {...x,status,durable:true,serverId:x.id};}
async function loadHubData(){try{const r=await fetch('/api/marketing/content',{credentials:'same-origin',headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();hubPublisher=d.publisher==='internal'?'internal':'windsor';const remote=(d.items||[]).map(mapServerItem);const local=state.items.filter(x=>!x.durable&&!remote.some(y=>y.id===x.id));state.items=remote.concat(local);state.notice='Content sync checked against the SBC database.';persist();render()}catch(_){state.notice='Server-side content storage is not ready in this runtime. Drafts can still be prepared locally, but they will not sync across devices.';render()}}
function loadIntegrationStatus(){const cards=[['facebook','Facebook Page'],['instagram','Instagram Professional'],['google','Google Business Profile']];Promise.all(cards.map(async ([key])=>{try{const r=await fetch('/api/marketing/integrations/status?platform='+encodeURIComponent(key),{credentials:'same-origin',headers:{Accept:'application/json'}});if(!r.ok)return [key,'not_configured'];const d=await r.json();return [key,{status:d.status==='connected'&&d.verified===true?'connected':d.configured===true?'configured':'not_configured',missingSecrets:d.missingSecrets||[],verificationErrorCode:d.verificationErrorCode||''}]}catch(_){return [key,'not_configured']}})).then(rows=>{window.__SBC_V6567_INTEGRATIONS__=Object.fromEntries(rows);if(root&&!root.hidden&&state.activeTab==='integrations')render()})}
function platformName(p){return ({facebook:'Facebook Page',instagram:'Instagram Professional',google:'Google Business Profile'})[p]||p}
let creativeData=null,creativeBusy=false,creativeError='';
async function loadCreatives(){
 if(creativeBusy)return;
 creativeBusy=true;creativeError='';render();
 try{
  const r=await fetch('/api/marketing/creative-inventory',{credentials:'same-origin',headers:{Accept:'application/json'}});
  const d=await r.json();if(!r.ok||d.ok!==true||!Array.isArray(d.assets)||!Array.isArray(d.slots))throw Error('Creative inventory unavailable.');
  creativeData=d;
 }catch(e){creativeData=null;creativeError='Creative inventory unavailable. Database migration and writer readiness may be required.';}
 finally{creativeBusy=false;render();}
}
async function approveCreative(sha){
 if(creativeBusy||!creativeData?.canApprove||!(/^[a-f0-9]{64}$/.test(sha)))return;
 if(!confirm('Approve this exact artwork and caption for the existing authorized publisher? This does not publish a post.'))return;
 creativeBusy=true;render();
 try{
  const r=await fetch('/api/marketing/creative-inventory/'+sha+'/approve',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:'{}'});
  const d=await r.json();if(!r.ok||d.ok!==true||d.approved!==true)throw Error('Approval not confirmed.');
  creativeBusy=false;await loadCreatives();
 }catch{creativeBusy=false;creativeError='Approval could not be verified. Refresh before trying again.';render();}
}
function creativePanel(){
 const d=creativeData;
 let html='<section class="mh-panel"><h2>Creative inventory</h2><p>Seven-day artwork buffer · 10 AM and 10 PM Eastern. Approval prepares artwork only; the existing external publisher remains in control.</p><button type="button" data-action="refresh-creatives">Refresh inventory</button>';
 if(creativeBusy)html+='<p role="status">Checking creative inventory…</p>';
 if(creativeError)html+='<p role="alert">'+esc(creativeError)+'</p>';
 if(!d)return html+'<p>Inventory not loaded. No approved stock is assumed.</p></section>';
 html+='<div class="mh-metrics">'+card('Approved future slots',d.approved,'14 target')+card('Draft slots',d.drafts,'Owner review')+card('Missing slots',d.missing.length,'Replenishment needed')+'</div>';
 if(d.low)html+='<p role="alert">Approved inventory below six creatives.</p>';
 if(!d.canApprove)html+='<p>Read-only environment. Approval requires the published writer.</p>';
 const future=new Set(d.slots.map(s=>s.key));
 for(const a of d.assets.filter(a=>future.has(a.slot_key))){
  if(!/^[a-f0-9]{64}$/.test(a.sha256))continue;
  const url='/api/marketing/creative-inventory/'+a.sha256+'/artwork';
  html+='<article class="mh-item"><strong>'+esc(a.service)+' · '+esc(a.state)+'</strong><p>'+esc(a.slot_key)+'</p><img loading="lazy" src="'+url+'" alt="'+esc(a.service+' SBC creative')+'" style="width:100%;max-width:340px;height:auto;border-radius:8px"><p>'+esc(a.caption)+'</p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Review full-size artwork</a>';
  if(d.canApprove&&a.state==='DRAFT')html+=' <button type="button" data-action="approve-creative" data-sha="'+a.sha256+'" '+(creativeBusy?'disabled':'')+'>Approve exact creative</button>';
  html+='</article>';
 }
 return html+'</section>';
}
let receiptReport, receiptDay='', receiptBusy=false, receiptError='', receiptRequest=0;
function receiptUrl(suffix='') {
  return '/api/marketing/publication-receipts'+suffix+(receiptDay?'?day='+encodeURIComponent(receiptDay):'');
}
async function loadReceipts() {
  const sequence=++receiptRequest;
  receiptBusy=true;receiptError='';render();
  try {
    const r=await fetch(receiptUrl(),{credentials:'same-origin',headers:{Accept:'application/json'}});
    const data=await r.json();
    if(!r.ok || data.ok!==true || !Array.isArray(data.channels)) throw Error('Receipt report unavailable.');
    if(sequence===receiptRequest){receiptReport=data;receiptDay=data.day;}
  } catch {
    if(sequence===receiptRequest){receiptReport=null;receiptError='Receipt report unavailable. Refresh to check again.';}
  } finally {if(sequence===receiptRequest){receiptBusy=false;render();}}
}
async function saveReceipt(suffix,body) {
  if(receiptBusy)return;
  receiptBusy=true;receiptError='';render();
  try {
    const r=await fetch(receiptUrl(suffix),{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
    const data=await r.json();
    if(!r.ok||data.ok!==true)throw Error(data.error||'Receipt could not be saved.');
    await loadReceipts();
  } catch(e) {receiptError=String(e.message);receiptBusy=false;render();}
}
function receiptPanel() {
  const report=receiptReport;
  const helper='<p>10 AM and 10 PM Eastern · two image posts per channel. The Windsor automation publishes these posts.</p>';
  let html='<section class="mh-panel"><h2>Publication receipts</h2>'+helper+
    '<form id="mh-receipt-day"><label>Eastern date <input type="date" name="day" required value="'+esc(receiptDay)+'"></label> <button type="submit">View date</button></form>'+
    '<button type="button" class="secondary" data-action="refresh-receipts">Refresh receipts</button>';
  if(receiptBusy)html+='<p role="status">Checking receipts…</p>';
  if(receiptError)html+='<p role="alert">'+esc(receiptError)+'</p>';
  if(!report)return html+'</section>';
  const messages={ACCESS_UNCONFIGURED:'The server needs its SBC Windsor API key.',PROVIDER_UNAVAILABLE:'Provider readback unavailable.',
    NO_READBACK:'No matching provider record returned yet.',INCONCLUSIVE:'Returned records lack required evidence.'};
  for(const channel of report.channels) {
    const saved=(report.slots||[]).filter(row=>row.platform===channel.platform);
    const ids=new Set(channel.receipts.map(row=>row.id));
    for(const row of saved)if(row.verified_at)ids.add(row.provider_id);
    html+='<article class="mh-item"><strong>'+esc(channel.name)+'</strong><p>'+ids.size+' of 2 verified image posts</p>';
    if(messages[channel.status])html+='<small>'+messages[channel.status]+'</small>';
    for(const row of channel.receipts)html+='<p><a href="'+esc(row.link)+'" target="_blank" rel="noopener noreferrer">'+esc(row.id)+'</a> · '+esc(new Date(row.publishedAt).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}))+' ET</p>';
    for(const row of saved){
      const label=row.verified_at?'Verified and saved':row.provider_id?'Provider acceptance recorded':'Attempt recorded';
      html+='<p>'+esc(row.slot)+' · '+label+(row.provider_id?' · '+esc(row.provider_id):'')+'</p>';
    }
    html+='</article>';
  }
  if(report.slots===null)html+='<p>Saved slot history is unavailable.</p>';
  if(report.canRecord)html+='<form id="mh-receipt-form"><label>Channel <select name="platform">'+report.channels.map(c=>'<option value="'+esc(c.platform)+'">'+esc(c.name)+'</option>').join('')+'</select></label> <label>Slot <select name="slot"><option value="AM">10 AM</option><option value="PM">10 PM</option></select></label> <label>Provider post ID <input name="postId" maxlength="225" placeholder="Leave blank for an attempt"></label> <button type="submit">Record receipt</button></form><button type="button" class="secondary" data-action="reconcile-receipts">Verify saved receipts</button>';
  return html+'</section>';
}

function renderTrendLab(){
 const t=state.trend||{topic:'Miami Next Level',source:'https://www.rockstargames.com/newswire/article/39akk424a9oo53/grand-theft-auto-vi-now-available',expiry:'2026-12-06',sector:'Miami-area small businesses'};
 return '<section class="mh-panel"><h2>Trend Lab · Turn attention into customers</h2>'+
  '<p>Build an original creative campaign around a relevant, verified cultural moment. The event is research context, not permission to copy anyone else’s artwork, logo, music, characters, or endorsement.</p>'+
  '<p><strong>SBC Miami Next Level:</strong> Original SBC campaign for business websites, branding and visibility. <a href="/miami-next-level.html" target="_blank" rel="noopener noreferrer">Preview SBC campaign landing</a>.</p>'+
  '<form id="mh-trend-form"><div class="mh-form-grid">'+
  '<label>Trend or campaign topic<input name="topic" maxlength="90" required value="'+esc(t.topic||'')+'"></label>'+
  '<label>Audience<input name="sector" maxlength="100" value="'+esc(t.sector||'Miami-area small businesses')+'" required></label>'+
  '<label>Research source (verified by owner)<input name="source" type="url" required value="'+esc(t.source||'')+'" placeholder="https://official-source.example/news"></label>'+
  '<label>Campaign review/expiry date<input name="expiry" type="date" required value="'+esc(t.expiry||'')+'"></label></div>'+
  '<p class="mh-muted">Use only verified non-sensitive trends. Avoid tragedies, disasters, political persuasion, false endorsements, unlicensed creative assets, and unapproved discounts. Original creative is reviewed by the owner before any public posting.</p>'+
  '<button type="button" data-action="draft-trend-campaign">Prepare SBC campaign draft</button></form>'+
  '<p class="mh-muted">Nothing posts from Trend Lab. Your draft opens in Content Studio, where existing approval and publishing gates apply.</p></section>';
}
function card(title,value,sub){return '<article class="mh-card"><div class="mh-card-label">'+esc(title)+'</div><div class="mh-card-value">'+esc(value)+'</div><div class="mh-card-sub">'+esc(sub)+'</div></article>'}
function rows(items){if(!items.length)return '<div class="mh-empty"><strong>No items yet</strong><span>Create content in the Studio, then submit it for owner approval.</span></div>';return '<div class="mh-items">'+items.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).map(x=>'<article class="mh-item"><div class="mh-item-top"><div><strong>'+esc(x.title||'Untitled post')+'</strong><small>'+esc(platformName(x.platform))+' · '+esc(x.offer||'SBC')+'</small></div>'+badge(x.status)+'</div><p>'+esc(x.body)+'</p><div class="mh-item-meta">'+(x.scheduledAt?'Scheduled: '+esc(new Date(x.scheduledAt).toLocaleString()):'Updated: '+esc(new Date(x.updatedAt||Date.now()).toLocaleString()))+'</div><div class="mh-item-actions">'+(x.status==='draft'?'<button data-action="submit-approval" data-id="'+esc(x.id)+'">Submit for approval</button>':'')+(x.status==='pending'?'<button data-action="approve" data-id="'+esc(x.id)+'">Approve</button><button class="secondary" data-action="reject" data-id="'+esc(x.id)+'">Request edits</button>':'')+(x.status==='approved'?(hubPublisher==='internal'?'<button data-action="publish" data-id="'+esc(x.id)+'">Publish now</button>':'')+'<button data-action="schedule" data-id="'+esc(x.id)+'">Schedule</button>':'')+'<button class="secondary" data-action="edit" data-id="'+esc(x.id)+'">Edit</button><button class="danger" data-action="delete" data-id="'+esc(x.id)+'">Delete</button></div></article>').join('')+'</div>'}
function render(){if(!root||root.hidden)return;
const canReadMarket=window.state?.me?.role==='owner'&&typeof window.SBCMarketIntelligence?.mount==='function';
if(state.activeTab==='market'&&!canReadMarket)state.activeTab='overview';
const canReadCreatives=window.state?.me?.role==='owner';
if(state.activeTab==='creatives'&&!canReadCreatives)state.activeTab='overview';
const visibleTabs=[...tabs,...(canReadMarket?[['market','Market Intelligence']]:[]),...(canReadCreatives?[['creatives','Creative Inventory']]:[])];
root.querySelector('.mh-tabs').innerHTML=visibleTabs.filter(([key])=>key!=='receipts'||hubPublisher!=='internal').map(([k,n])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(state.activeTab===k)+'" class="'+(state.activeTab===k?'active':'')+'">'+n+'</button>').join('');root.querySelector('.mh-notice').textContent=state.notice||'';const content=root.querySelector('.mh-content'),items=state.items;const pending=items.filter(x=>x.status==='pending'),scheduled=items.filter(x=>x.status==='scheduled'||(x.status==='approved'&&x.scheduledAt)),drafts=items.filter(x=>x.status==='draft');
if(state.activeTab==='market'){window.SBCMarketIntelligence.mount(content);return;}
if(state.activeTab==='overview'){content.innerHTML='<div class="mh-metrics">'+card('Content items',items.length,'Drafts and planned posts')+card('Awaiting approval',pending.length,'Owner review required')+card('Scheduled',scheduled.length,'Prepared calendar items')+card('Published',items.filter(x=>x.status==='published').length,'Marketing Hub records')+'</div><div class="mh-two"><section class="mh-panel"><h2>Recommended next steps</h2><ol><li>Create a platform-specific post in Content Studio.</li><li>Submit it to the approval queue.</li><li>Approve the copy and schedule it.</li><li>Connect and verify official APIs before publishing.</li></ol></section><section class="mh-panel"><h2>Campaign focus</h2><p>Use clear offers and calls to action for SBC business packages, Florida notary services, Office Box, and print products.</p><button data-tab="studio">Create content</button></section></div><section class="mh-panel"><h2>Recent content</h2>'+rows(items.slice(0,3))+'</section>'}
else if(state.activeTab==='receipts'){content.innerHTML=receiptPanel();}
else if(state.activeTab==='creatives'){content.innerHTML=creativePanel();}
else if(state.activeTab==='trend'){content.innerHTML=renderTrendLab();}
 else if(state.activeTab==='studio'){const d=state.draft;content.innerHTML='<section class="mh-panel"><h2>Content Studio</h2><p>Draft copy for an official channel. Saving here does not publish anything.</p>'+ (canReadCreatives?'<details style="margin:12px 0"><summary style="font-weight:700;cursor:pointer">Create media</summary><p>Private SBC graphics and short commercials. Review and use the existing approval process before publishing.</p><iframe title="SBC Creative Studio for marketing" loading="lazy" referrerpolicy="no-referrer" data-creative-src="/api/marketing/creative-studio" style="display:block;width:100%;height:740px;border:0;border-radius:8px"></iframe></details>':'') +'<form id="mh-draft-form"><div class="mh-form-grid"><label>Post title<input name="title" required maxlength="120" value="'+esc(d.title)+'" placeholder="Campaign or post title"></label><label>Channel<select name="platform"><option value="facebook" '+(d.platform==='facebook'?'selected':'')+'>Facebook Page</option><option value="instagram" '+(d.platform==='instagram'?'selected':'')+'>Instagram Professional</option><option value="google" '+(d.platform==='google'?'selected':'')+'>Google Business Profile</option></select></label><label>Offer<select name="offer">'+offers.map(o=>'<option '+(d.offer===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label><label>CTA destination URL<input name="ctaUrl" type="url" value="'+esc(d.ctaUrl||'')+'" placeholder="https://your-site.example/book"></label><label>Public image URL<input name="mediaUrl" type="url" value="'+esc(d.mediaUrl||'')+'" placeholder="https://public-site.example/image.jpg (required for Instagram)"></label><label>Call to action<select name="cta">'+['Learn more','Call now','Book an appointment','Get a quote','Send a message','Visit website'].map(o=>'<option '+(d.cta===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label></div><label>Post copy<textarea name="body" required maxlength="5000" rows="7" placeholder="Write clear, accurate copy. Do not include claims you cannot substantiate.">'+esc(d.body)+'</textarea></label><div class="mh-form-actions"><span class="mh-muted">Owner approval required before scheduling. Publishing requires a verified provider connection.</span><div><button type="button" class="secondary" data-action="generate-kim">Draft with Kim</button> <button type="submit">Save draft</button></div></div></form></section><section class="mh-panel"><h2>Saved drafts</h2>'+rows(drafts)+'</section>'}
else if(state.activeTab==='queue'){content.innerHTML='<section class="mh-panel"><h2>Approval Queue</h2><p>Review each draft before it can be scheduled. Approval here is a workflow record in this browser, not an external-platform publish.</p>'+rows(pending)+'</section><section class="mh-panel"><h2>Recently reviewed</h2>'+rows(items.filter(x=>['approved','rejected'].includes(x.status)))+'</section>'}
else if(state.activeTab==='calendar'){content.innerHTML='<section class="mh-panel"><h2>Content Calendar</h2><p>Approved items can be assigned a planned date and time. '+(hubPublisher==='internal'?'The internal publisher checks approved posts at their planned time.':'SBC uses this calendar for planning. Windsor owns the two daily publishing slots.')+'</p>'+rows(scheduled.concat(items.filter(x=>x.status==='approved'&&!x.scheduledAt)))+'</section>'}
else if(state.activeTab==='integrations'){const statuses=window.__SBC_V6567_INTEGRATIONS__||{};content.innerHTML='<section class="mh-panel"><h2>Official channel connections</h2><p>Credentials are not required to build drafts. Add them later in the existing secrets area, then configure and verify each official API integration.</p><div class="mh-integrations">'+[['facebook','Facebook Page','Meta Graph API'],['instagram','Instagram Professional','Meta Graph API'],['google','Google Business Profile','Google Business Profile API']].map(([k,n,api])=>'<article class="mh-integration"><div class="mh-integration-icon">'+(k==='facebook'?'f':k==='instagram'?'◎':'G')+'</div><div class="mh-integration-copy"><strong>'+n+'</strong><span>'+api+'</span><small>'+(statuses[k]?.status==='connected'?'Verified connection response received':statuses[k]?.status==='configured'?'Credentials found · verification pending':'Not connected · required credentials missing'+(statuses[k]?.missingSecrets?.length?' ('+statuses[k].missingSecrets.join(', ')+')':''))+'</small></div><span class="mh-badge '+(statuses[k]?.status==='connected'?'good':'warn')+'">'+(statuses[k]?.status==='connected'?'Verified':statuses[k]?.status==='configured'?'Unverified':'Not connected')+'</span></article>').join('')+'</div><div class="mh-callout">No tokens are read or displayed in the browser. A connection is considered verified only when the server returns an explicit verified status. Publishing requires a verified official provider connection and owner-approved content. '+(hubPublisher==='internal'?'Scheduled client posts use the internal publisher.':'SBC publication receipts are available in the Publication receipts tab.')+'</div><button class="secondary" data-action="refresh-integrations">Refresh connection status</button></section>'}
else if(state.activeTab==='prospect'){const p=state.prospect||stateDefault.prospect;content.innerHTML='<section class="mh-panel"><h2>Prospect Preview Generator</h2><p>Create a personalized example for a business prospect. This is a preview only: it does not create a CRM record, send a message, or publish content.</p><form id="mh-prospect-form"><div class="mh-form-grid"><label>Prospect business name<input name="businessName" maxlength="140" value="'+esc(p.businessName)+'" placeholder="Example: Midtown Barber Studio" required></label><label>Business type<select name="industry">'+['Local small business','Barber shop','Hair salon','Notary service','Contractor','Professional service','Retail shop','Other'].map(o=>'<option '+(p.industry===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label><label>Offer<select name="offer">'+offers.map(o=>'<option '+(p.offer===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label><label>Call to action<select name="cta">'+['Book a call','Get a quote','Visit website','Send a message','Learn more'].map(o=>'<option '+(p.cta===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label></div><label>Preview message<textarea name="body" rows="5" maxlength="4000" placeholder="Generate with Kim or enter your own draft.">'+esc(p.body)+'</textarea></label><div class="mh-form-actions"><span class="mh-muted">No contact is made. Review every claim before using this copy.</span><button type="submit">Generate with Kim</button></div></form></section>'+(p.body?'<section class="mh-panel"><h2>Prospect-facing preview</h2><div class="mh-item"><div class="mh-item-top"><strong>'+esc(p.businessName||'Business prospect')+'</strong><span class="mh-badge blue">Preview only</span></div><small>'+esc(p.industry)+' · '+esc(p.offer)+'</small><p>'+esc(p.body)+'</p><div class="mh-item-meta">Suggested next step: '+esc(p.cta)+'</div></div></section>':'')}
else {const totals=items.length,approved=items.filter(x=>x.status==='approved'||x.status==='scheduled'||x.status==='published').length,a=window.__SBC_V6567_ANALYTICS__;content.innerHTML='<div class="mh-metrics">'+card('Total created',totals,'SBC content records')+card('Approval rate',totals?Math.round(approved/totals*100)+'%':'—','Approved or further along')+card('Scheduled',scheduled.length,'Planned posts')+card('Hub publish records',items.filter(x=>x.status==='published').length,'Recorded publish events')+'</div>'+(window.__SBC_V6567_ANALYTICS_LOADING__?'<section class="mh-panel"><p>Loading provider insights…</p></section>':renderProviderInsights(a&&a.ok?a:null))+'<section class="mh-panel"><h2>Attribution readiness</h2><p>Platform views and engagement are sourced from verified provider APIs. Leads, conversions, CAC and ROAS require UTM and conversion attribution; they are not estimated here.</p></section>'}
const creativeFrame=state.activeTab==='studio'&&canReadCreatives?content.querySelector?.('iframe[data-creative-src]'):null;if(creativeFrame){const drawer=creativeFrame.closest('details');drawer?.addEventListener('toggle',()=>{if(drawer.open){if(!creativeFrame.hasAttribute('src'))creativeFrame.src=creativeFrame.dataset.creativeSrc;}else creativeFrame.removeAttribute('src');});}
content.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.activeTab=b.dataset.tab;persist();render()}))}
async function generateProspectPreview(form){const f=new FormData(form),p={businessName:String(f.get('businessName')||'').trim(),industry:String(f.get('industry')||'Local small business'),offer:String(f.get('offer')||offers[0]),cta:String(f.get('cta')||'Book a call'),body:String(f.get('body')||'').trim()};if(!p.businessName){state.notice='Enter the prospect business name first.';render();return}if(!p.body){const prompt='Draft a concise, respectful first-touch marketing message for Successful By Choice LLC to a prospective business. Business name: '+p.businessName+'. Business type: '+p.industry+'. Offer: '+p.offer+'. Desired next step: '+p.cta+'. Do not invent a relationship, customer results, prices, guarantees, or facts about this prospect. Use a clear value proposition and low-pressure CTA. Return only the message body. This is a preview, not a message to send.';try{state.notice='Kim is generating a prospect preview…';root.querySelector('.mh-notice').textContent=state.notice;const r=await fetch('/api/ai/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:prompt})});if(!r.ok)throw new Error('Kim API HTTP '+r.status);const d=await r.json();const candidate=d.reply||d.response||d.text||d.message||d.data?.reply||d.data?.text||d.result?.text;const generated=typeof candidate==='string'?candidate:(candidate&&typeof candidate.content==='string'?candidate.content:'');if(!generated.trim())throw new Error('No draft text returned');p.body=generated.trim()}catch(e){state.notice='Kim preview unavailable ('+String(e.message||'API error')+'). Enter the message manually and submit again.';state.prospect=p;persist();render();return}}state.prospect=p;state.notice='Prospect preview ready. No CRM record was created and nothing was sent.';persist();render()}
async function serverAction(x,action,payload={}){
 if(!x.durable)return null;
 const key=String(x.id);
 if(pendingServerActions.has(key)){state.notice='An action for this item is already in progress. Check its result before trying again.';render();return false}
 pendingServerActions.add(key);
 try{
  const r=await fetch('/api/marketing/content/'+encodeURIComponent(x.id)+'/'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok!==true)throw new Error(d.error||('UNCONFIRMED_ACTION_HTTP_'+r.status));
  if(action==='publish'){
   if(d.published!==true||d.status!=='PUBLISHED'||typeof d.providerPostId!=='string'||!d.providerPostId.trim())throw new Error('MISSING_VERIFIED_PUBLISH_RECEIPT');
   x.providerPostId=d.providerPostId.trim();
  }
  return true;
 }catch(e){
  state.notice='SBC '+action+' was not verified ('+String(e.message||'API error')+'). Status unchanged. For publishing, check the provider before retrying to avoid duplicates.';
  render();return false;
 }finally{pendingServerActions.delete(key)}
}
async function saveItemToServer(x){try{const r=await fetch('/api/marketing/content',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(x)});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true||!d.item)throw new Error(d.error||('HTTP '+r.status));Object.assign(x,mapServerItem(d.item));x.durable=true;state.notice='Draft saved to the SBC database.'}catch(e){x.durable=false;state.notice='Draft saved in this browser only. Server sync is unavailable ('+String(e.message||'API error')+').'}persist();render()}
function handleSubmit(e){
 if(e.target.id==='mh-receipt-day'){e.preventDefault();receiptDay=String(new FormData(e.target).get('day')||'');receiptReport=null;void loadReceipts();return;}
 if(e.target.id==='mh-receipt-form'){e.preventDefault();const f=new FormData(e.target);void saveReceipt('',{platform:f.get('platform'),slot:f.get('slot'),postId:String(f.get('postId')||'').trim()});return;}
 if(e.target.id==='mh-prospect-form'){e.preventDefault();void generateProspectPreview(e.target);return}if(e.target.id!=='mh-draft-form')return;e.preventDefault();const f=new FormData(e.target),d={title:String(f.get('title')||'').trim(),platform:String(f.get('platform')||'facebook'),offer:String(f.get('offer')||offers[0]),cta:String(f.get('cta')||'Learn more'),ctaUrl:String(f.get('ctaUrl')||'').trim(),mediaUrl:String(f.get('mediaUrl')||'').trim(),body:String(f.get('body')||'').trim()};if(!d.title||!d.body){notice('A title and post copy are required.');return}const existing=state.draft.id;const now=new Date().toISOString();let item;if(existing){const i=state.items.findIndex(x=>x.id===existing);if(i>=0){item={...state.items[i],...d,updatedAt:now,status:'draft'};state.items[i]=item}else{item={...d,id:id(),status:'draft',createdAt:now,updatedAt:now};state.items.unshift(item)}}else{item={...d,id:id(),status:'draft',createdAt:now,updatedAt:now};state.items.unshift(item)}state.draft={...stateDefault.draft};state.notice='Saving draft…';persist();render();void saveItemToServer(item)}
async function handleClick(e){const b=e.target.closest('[data-action]');if(!b)return;const x=state.items.find(i=>i.id===b.dataset.id);switch(b.dataset.action){case'refresh-creatives':void loadCreatives();return;case'approve-creative':void approveCreative(b.dataset.sha);return;case'refresh-receipts':void loadReceipts();return;case'reconcile-receipts':void saveReceipt('/reconcile',{});return;case'draft-trend-campaign':{
 const form=root.querySelector('#mh-trend-form');if(!form){notice('Trend form unavailable.');return;}
 const fields=new FormData(form);
 const topic=String(fields.get('topic')||'').trim().slice(0,90);
 const sector=String(fields.get('sector')||'').trim().slice(0,100);
 const source=String(fields.get('source')||'').trim();
 const expiry=String(fields.get('expiry')||'').trim();
 let url;try{url=new URL(source)}catch{url=null}
 if(!topic||!sector||!url||url.protocol!=='https:'||!/^20\d\d-\d\d-\d\d$/.test(expiry)||
   Date.parse(expiry+'T23:59:59Z')<Date.now()){
  notice('Provide a topic, audience, an HTTPS research source and a future review/expiry date.');return;
 }
 state.trend={topic,sector,source,expiry};
 const isMiami=/^miami next level$/i.test(topic);
 const topicLabel='trend_'+topic.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,55).replace(/_+$/,'');
 const campaign=isMiami?'miami_next_level_2026':'super_sbc_growth';
 state.draft={...stateDefault.draft,
  title:'SBC | '+topic,platform:'facebook',offer:isMiami?'Miami Next Level':'SBC Business Packages',
  cta:'Send a message',
  ctaUrl:'https://sbcmia.com/contact.php?utm_source=facebook&utm_medium=organic_social&utm_campaign='+encodeURIComponent(campaign)+'&utm_content='+encodeURIComponent(isMiami?'general':topicLabel),
  body:isMiami
   ?'🌴 MIAMI IS IN THE SPOTLIGHT. YOUR BUSINESS SHOULD BE NEXT.\n\nDoes your business have a website that makes it easy for customers to find your services and contact you?\n\nSuccessful By Choice helps Miami businesses with websites from $199, business visibility, printing and branding.\n\nWant a quick website consultation? Message SBC with LEVEL UP or visit sbcmia.com.\n\nBecause Why Not?'
   :'The world keeps moving. Your business can keep growing.\n\nSuccessful By Choice helps local owners build a clearer online presence with websites, business visibility and professional branding.\n\nAsk us about a website consultation at sbcmia.com. Because Why Not?'
 };
 state.activeTab='studio';state.notice='Trend draft prepared. Research details are not a public claim. Review copy, rights and expiry before submission.';
 persist();render();return;
}case'generate-kim':generateWithKim();return;case'publish':if(x){if(!x.durable){state.notice='Publish is disabled for browser-local drafts. Save and sync the draft to the SBC database first.';render();return}if(!confirm('Publish this owner-approved post to '+platformName(x.platform)+' now? This creates a public post.'))return;const ok=await serverAction(x,'publish');if(ok===false)return;x.status='published';x.publishedAt=new Date().toISOString();state.notice='Provider-confirmed publish recorded: '+String(x.providerPostId)+'.'}break;case'submit-approval':if(x){const ok=await serverAction(x,'submit');if(ok===false)return;x.status='pending';x.updatedAt=new Date().toISOString();state.notice=ok?'Submitted to the SBC owner approval queue.':'Submitted to the browser-local approval queue only; not synced to SBC.'}break;case'approve':if(x){const ok=await serverAction(x,'approve');if(ok===false)return;x.status='approved';x.updatedAt=new Date().toISOString();state.notice=ok?'Approved in the SBC database for scheduling.':'Approved locally only; not synced to SBC.'}break;case'reject':if(x){const ok=await serverAction(x,'reject');if(ok===false)return;x.status='rejected';x.updatedAt=new Date().toISOString();state.notice=ok?'Returned for edits in the SBC database.':'Marked for edits locally only; not synced to SBC.'}break;case'schedule':if(x){const value=prompt('Enter the planned date and local time, for example 2026-11-24T22:00.');if(value){const d=new Date(value);if(Number.isNaN(d.getTime())||d.getTime()<=Date.now()){state.notice='Choose a valid future date and time.';break}if(!confirm((hubPublisher==='internal'?'Schedule public publishing at ':'Save this planned time for ' )+d.toLocaleString()+'?'))return;const ok=await serverAction(x,'schedule',{scheduledAt:d.toISOString()});if(ok===false)return;x.scheduledAt=d.toISOString();x.status='scheduled';x.updatedAt=new Date().toISOString();state.notice=ok?'Planned time saved in the SBC database.':'Date saved locally only. It will not publish automatically.'}}break;case'edit':if(x){state.draft={...x};state.activeTab='studio'}break;case'delete':if(x&&confirm('Delete this marketing draft?')){if(x.durable){try{const r=await fetch('/api/marketing/content/'+encodeURIComponent(x.id),{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status)}catch(e){state.notice='Server delete was not confirmed; item was kept.';render();return}}state.items=state.items.filter(i=>i.id!==x.id);state.notice=x.durable?'Draft deleted from SBC.':'Local draft deleted.'}break;case'refresh-integrations':loadIntegrationStatus();state.notice='Checking official integration status.';break;case'refresh-analytics':loadMarketingAnalytics();return}persist();render()}
async function generateWithKim(){const form=root&&root.querySelector('#mh-draft-form');if(!form)return;const title=form.elements.title.value.trim(),platform=form.elements.platform.value,offer=form.elements.offer.value,cta=form.elements.cta.value;const box=form.elements.body;const button=root.querySelector('[data-action="generate-kim"]');if(button){button.disabled=true;button.textContent='Kim is drafting…'}state.notice='Asking Kim to draft content. Nothing will be published.';root.querySelector('.mh-notice').textContent=state.notice;const prompt='Create one accurate social marketing draft for Successful By Choice LLC. Offer: '+offer+'. Channel: '+platformName(platform)+'. Post title: '+(title||'Create a clear campaign headline')+'. Call to action: '+cta+'. Requirements: concise, compelling, professional; do not invent prices, guarantees, testimonials, customer results, or unsupported claims; do not mention unverified integrations; include a clear CTA; return only the post copy.';try{const r=await fetch('/api/ai/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:prompt})});if(!r.ok)throw new Error('Kim API returned HTTP '+r.status);const d=await r.json();const candidate=d.reply||d.response||d.text||d.message||d.data?.reply||d.data?.text||d.result?.text;const generated=typeof candidate==='string'?candidate:(candidate&&typeof candidate.content==='string'?candidate.content:'');if(!generated.trim())throw new Error('Kim response did not contain draft text');box.value=generated.trim();state.notice='Kim drafted copy. Review it, edit as needed, and save it as a draft.';root.querySelector('.mh-notice').textContent=state.notice}catch(e){state.notice='Kim drafting is unavailable right now: '+String(e.message||'API error')+'. You can still write and save a draft manually.';root.querySelector('.mh-notice').textContent=state.notice}finally{if(button){button.disabled=false;button.textContent='Draft with Kim'}}}
window.SBCMarketingHub=Object.freeze({open:openHub,close:closeHub});
function injectNav(){if(navButton())return;let tries=0;const t=setInterval(()=>{tries++;if(navButton()||tries>=20)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectNav,{once:true});else injectNav();
})();