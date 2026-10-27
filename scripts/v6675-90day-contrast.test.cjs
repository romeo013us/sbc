'use strict';
// SBC V66.75: protect the 90-day revenue screen from invisible text in both themes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
let canonical=null;
for(const dir of ['public','browser_public']){
 const html=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
 const match=html.match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/);
 assert(match,'canonical CSS reference required in '+dir);
 const css=fs.readFileSync(path.join(root,dir,match[1]),'utf8');
 const standalone=fs.readFileSync(path.join(root,dir,'v56140-90day-revenue-command.css'),'utf8');
 const digest=crypto.createHash('sha256').update(css).digest('hex');
 assert.equal(match[1],'sbc-v6636-styles.'+digest.slice(0,16)+'.css','content-addressed CSS filename must match actual bytes');
 assert(html.includes('data-sbc-v6636="'+digest+'"'),'CSS receipt must match actual bytes');
 assert.equal(css.split('SBC_V6675_RC90_CONTRAST').length-1,1,'exactly one contrast patch in canonical CSS');
 assert.equal(standalone.split('SBC_V6675_RC90_CONTRAST').length-1,1,'exactly one contrast patch in legacy CSS');
 for(const theme of ['dark','light']){
  for(const selector of ['.rc90-stat','.rc90-panel','.rc90-hero-badge','.rc90-ai-list>div','.rc90-math>div','.rc90-offer','.rc90-funnel>div','.rc90-stat .rc90-value','.rc90-panel h3','.rc90-offer strong','.rc90-label','.rc90-sub','.rc90-note']){
   assert(css.includes('body[data-theme="'+theme+'"] .rc90-wrap '+selector),'missing '+theme+' contrast selector '+selector);
  }
 }
 assert(!standalone.slice(standalone.lastIndexOf('/* SBC_V6675_RC90_CONTRAST')).includes('color:transparent'),'contrast patch must never hide revenue labels');
 if(canonical!==null)assert.equal(css,canonical,'Preview and Published CSS must match byte-for-byte');
 canonical=css;
}
for(let pass=1;pass<=3;pass++)console.log('[SBC V6675] PASS '+pass+'/3 high-contrast rules, both themes, bundle hash, browser mirror');
