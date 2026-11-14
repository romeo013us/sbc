'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('draft owners see art-directed site preview first with classic escape hatch',()=>{
 const src=read('public/sbc-website-production-v1.js');
 assert.equal(src,read('browser_public/sbc-website-production-v1.js'),'both deployed frontends must be synchronized');
 assert.match(src,/const smartDraft=currentRole\(\)==='owner'&&!isApproved\(demo\)/);
 assert.match(src,/studioBase\(demo\)\+'\/auto-preview'/);
 assert.match(src,/src="'\+esc\(smartDraft\?smartUrl:pageUrl\(demo,'home'\)\)/);
 assert.match(src,/id="sbcFactoryClassicMode"/);
 assert.match(src,/id="sbcFactorySmartMode"/);
 assert.match(src,/smartUrl\+\(page==='home'/);
 assert.match(src,/switchPreview\(previewMode,page\)/);
 assert.match(src,/No public URL or outbound message is available before owner approval/);
 assert.doesNotMatch(src,/setTimeout\([^)]*publish|autoPublish/i);
});
test('new auto-preview keeps owner-only and tenant guards in website production routes',()=>{
 const routes=read('enterprise/website-studio/studio-owner-routes.cjs');
 assert.match(routes,/app\.get\(ROOT\+'\/auto-preview',auth,ownerOnly/);
 assert.match(routes,/site\.status==='Approved'\|\|site\.archived===true/);
 assert.match(routes,/const profile=fetchApproved\(site\)/);
});

test('owner Visual Studio editing UI and mirrored browser script use versioned private endpoints',()=>{
 const src=read('public/sbc-website-production-v1.js');
 assert.match(src,/id="sbcStudioVisualForm"/);
 assert.match(src,/studioBase\(demo\)\+'\/visual'/);
 assert.match(src,/expectedVersion:Number\(form\.dataset\.version\|\|0\)/);
 assert.match(src,/id="sbcStudioVisualStatus"/);
 assert.match(src,/studioVisualPanel\(demo\)/);
 assert.match(src,/private smart previews only/i);
 assert.equal(src,read('browser_public/sbc-website-production-v1.js'));
});
