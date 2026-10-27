'use strict';
// V66.75: Chromium computed-color WCAG check, no live network or DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('readonly CI required');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const match=html.match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/);
assert(match,'canonical CSS bundle missing');
const css=fs.readFileSync(path.join(root,'public',match[1]),'utf8');
const playwright=require(path.resolve(process.env.SBC_PLAYWRIGHT_PATH||'.sbc-browser/node_modules/playwright'));
const server=http.createServer((req,res)=>{if(req.url==='/style.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(css);return;}res.writeHead(404);res.end('not found')});
const fixture='<div class="rc90-stat"><div class="rc90-label">COLLECTED</div><div class="rc90-value">$1</div><div class="rc90-sub">Observed revenue</div></div><div class="rc90-panel"><div class="rc90-panel-head"><div><h3>Sales Funnel</h3><span>Observed Command Center state</span></div></div><div class="rc90-funnel"><div><b>499</b><span>Prospects</span></div></div><div class="rc90-ai-list"><div><span>OpenAI</span><b>CONNECTED</b></div></div><div class="rc90-math"><div><b>144</b><span>Additional customers</span></div></div><div class="rc90-offer"><div><strong>SBC Business Starter</strong><span>starter</span></div><b>$199</b></div></div><div class="rc90-hero-badge"><strong>CAMPAIGN_COMPLETE</strong><span>0.0% complete</span></div>';
const testHtml=theme=>'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body data-theme="'+theme+'"><div id="app" class="app"><main class="main"><div class="content"><section class="rc90-wrap">'+fixture+'</section></div></main></div></body></html>';
function luminance(rgb){const values=rgb.match(/[\d.]+/g);assert(values&&values.length>=3,'expected rgb '+rgb);const [r,g,b]=values.slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;try{
 browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const samples=[['.rc90-stat .rc90-value','.rc90-stat'],['.rc90-stat .rc90-label','.rc90-stat'],['.rc90-stat .rc90-sub','.rc90-stat'],['.rc90-panel h3','.rc90-panel'],['.rc90-funnel b','.rc90-funnel>div'],['.rc90-funnel span','.rc90-funnel>div'],['.rc90-ai-list b','.rc90-ai-list>div'],['.rc90-ai-list span','.rc90-ai-list>div'],['.rc90-math b','.rc90-math>div'],['.rc90-math span','.rc90-math>div'],['.rc90-offer strong','.rc90-offer'],['.rc90-offer span','.rc90-offer'],['.rc90-offer b','.rc90-offer'],['.rc90-hero-badge strong','.rc90-hero-badge']];
 for(const theme of ['dark','light'])for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/test',route=>route.fulfill({status:200,contentType:'text/html',body:testHtml(theme)}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/test',{waitUntil:'load'});
  for(const [textSel,bgSel] of samples){
   const c=await page.evaluate(([t,b])=>({fg:getComputedStyle(document.querySelector(t)).color,bg:getComputedStyle(document.querySelector(b)).backgroundColor}),[textSel,bgSel]);
   const contrast=ratio(c.fg,c.bg);assert(contrast>=4.5,theme+' '+width+' '+textSel+' contrast '+contrast.toFixed(2)+' ('+c.fg+' on '+c.bg+')');
  }
  console.log('[SBC V6675 CHROMIUM] PASS '+theme+' '+width+' '+samples.length+' pairs >= 4.5:1');await page.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error('[SBC V6675 CHROMIUM] FAIL',e.stack||e);process.exitCode=1});
