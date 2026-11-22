'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function source(p){return fs.readFileSync(path.join(root,p),'utf8');}
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.parentElement=null;this.dataset={};this.className='';this.classList={add:()=>{}};this._listeners={};}
 appendChild(child){return this.insertBefore(child,null);}
 insertBefore(child,reference){
  if(reference!==null&&reference!==undefined&&reference.parentElement!==this)throw new Error('NotFoundError: insertBefore reference is not a direct child');
  if(child.parentElement){const previous=child.parentElement;previous.children=previous.children.filter(x=>x!==child)}
  const index=reference==null?this.children.length:this.children.indexOf(reference);
  if(index<0)throw new Error('NotFoundError');
  this.children.splice(index,0,child);child.parentElement=this;return child;
 }
 get nextSibling(){if(!this.parentElement)return null;return this.parentElement.children[this.parentElement.children.indexOf(this)+1]||null;}
 get nextElementSibling(){return this.nextSibling;}
 get previousElementSibling(){if(!this.parentElement)return null;return this.parentElement.children[this.parentElement.children.indexOf(this)-1]||null;}
 addEventListener(type,cb){this._listeners[type]=cb;}
 querySelector(selector){
  const m=selector.match(/\[data-view=["']([^"']+)["']\]/);
  if(!m)return null;
  const visit=node=>{for(const el of node.children){if(el.dataset.view===m[1])return el;const descendant=visit(el);if(descendant)return descendant}return null};
  return visit(this);
 }
}
function fixture(){
 const nav=new Element('nav'),group=new Element('div'),home=new Element('button'),other=new Element('button');
 home.dataset.view='dashboard';other.dataset.view='crm';group.appendChild(home);group.appendChild(other);nav.appendChild(group);
 const body=new Element('body');const document={readyState:'complete',body,
  querySelector(selector){return selector==='.sidebar nav'?nav:null},
  querySelectorAll(){return []},
  getElementById(id){if(id==='v322Nav')return nav.querySelector('[data-view="ops360"]');return null},
  createElement(tag){return new Element(tag)},addEventListener(){} };
 const window={state:{view:'settings'},dashboard9:null};
 const context={document,window,state:window.state,MutationObserver:class{observe(){}},setTimeout(){},clearTimeout(){},console:{log(){}}};
 context.window.window=context.window;return {nav,group,home,other,context};
}
test('legacy Operations 360 installs safely when Dashboard sits inside a grouped nav',()=>{
 const f=fixture();assert.doesNotThrow(()=>vm.runInNewContext(source('public/v32-2-upgrade.js'),f.context));
 assert.equal(f.nav.querySelector('[data-view="ops360"]').parentElement,f.nav);
});
test('Owner Workspace binds navigation safely and remains idempotent with grouped nav',()=>{
 const f=fixture();vm.runInNewContext(source('public/v56-13-3-owner-workspace-fix.js'),f.context);
 assert.doesNotThrow(()=>f.context.window.SBC_OWNER_WORKSPACE_FIX.bind());
 assert.equal(f.nav.querySelector('[data-view="training"]').parentElement,f.nav);
 assert.doesNotThrow(()=>f.context.window.SBC_OWNER_WORKSPACE_FIX.bind());
 assert.equal(f.nav.children.filter(x=>x.dataset.view==='training').length,1);
});
test('agentic files declare only public access terms; private APIs stay undiscoverable',()=>{
 const llms=source('public/llms.txt'),manifest=JSON.parse(source('public/.well-known/ard.json'));
 assert.match(llms,/^#\s+.+/m);assert.match(llms,/\[[^\]]+\]\(https:\/\/[^)]+\)/);
 assert.match(llms,/private|authentication/i);
 assert.deepEqual(manifest.entries,[]);
 const html=source('public/index.html');assert.match(html,/rel="ard"[^>]*href="\/\.well-known\/ard\.json"/);
 const route=require('../routes/sbc-public-discovery-v1.cjs');
 assert.equal(typeof route.register,'function');
});
test('login contrast improvements are scoped and mirror safe',()=>{
 const css=source('public/sbc-light-contrast-v6601.css');
 assert.match(css,/#login:not\(\.hidden\) \.login-card/);
 assert.match(css,/#login:not\(\.hidden\) \.login-card p/);
 assert.match(css,/#login:not\(\.hidden\) \.login-card label/);
 for(const pathSuffix of ['v32-2-upgrade.js','v56-13-3-owner-workspace-fix.js','sbc-light-contrast-v6601.css'])
  assert.equal(source('public/'+pathSuffix),source('browser_public/'+pathSuffix));
});
