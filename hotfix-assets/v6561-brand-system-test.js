'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('canonical loaded stylesheet retains exact brand source, accessible theme tokens and mirror integrity',()=>{
 const index=read('public/index.html'),brand=read('public/sbc-v6561-brand-system.css');assert.equal(index,read('browser_public/index.html'));assert.equal(brand,read('browser_public/sbc-v6561-brand-system.css'));
 const link=index.match(/<link id="sbc-v6636-canonical-styles" rel="stylesheet" href="\/(sbc-v6636-styles\.([a-f0-9]{16})\.css)" data-sbc-v6636="([a-f0-9]{64})">/);assert(link,'active canonical stylesheet must be content-addressed');
 const css=read('public/'+link[1]);assert.equal(css,read('browser_public/'+link[1]));assert.equal(createHash('sha256').update(css).digest('hex'),link[3]);assert.equal(link[2],link[3].slice(0,16));assert(css.includes(brand),'canonical stylesheet must include exact brand rules');
 for(const token of ['#090B10','#1769E0','#F47721','#FFF','body[data-theme="dark"]','body[data-theme="light"]','prefers-reduced-motion','focus-visible'])assert(brand.includes(token),'missing brand/accessibility token '+token);
 assert(!index.includes('href="/sbc-v6561-brand-system.css'),'no redundant retired standalone stylesheet');
});
