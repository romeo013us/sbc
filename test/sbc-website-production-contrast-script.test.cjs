'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(p)=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

const sample={id:'lead-synthetic-17',businessName:'D K Auto Repair',
 verificationStatus:'Verified',leadIntelligence:{researchBrief:{googleBusinessPresence:'found',websitePresence:'not_found'}}};
const approved={customerId:sample.id,id:'demo-synthetic-17',slug:'demo-synthetic-17',status:'Approved',archived:false};

test('website script follows owner-approved John introduction, Google question, direct hook and Zoom close',()=>{
 const {createCallScript}=require('../enterprise/sbc-website-call-desk.cjs');
 const txt=createCallScript(sample,approved);
 assert.match(txt,/looking up your business on Google/i);
 assert.match(txt,/couldn.t find your website/i);
 assert.match(txt,/\[PAUSE[^\]]*\]/);
 assert.match(txt,/WELL, THE THING IS, I BUILT YOU ONE!/);
 assert.match(txt,/WELL, THE THING IS, I BUILT YOU ONE!/);
 assert.match(txt,/jump on a quick Zoom/i);
 assert.match(txt,/10 minutes/i);
 assert.match(txt,/Which works better for you, today or tomorrow/i);
 assert.match(txt,/today or tomorrow/i);
 assert.doesNotMatch(txt,/your real first and last name/i);
 assert.doesNotMatch(txt,/guaranteed customers|free website forever/i);
});

test('website script does not claim Google profile discovery when absent or site is unverified',()=>{
 const {createCallScript}=require('../enterprise/sbc-website-call-desk.cjs');
 const unknown={...sample,leadIntelligence:{researchBrief:{googleBusinessPresence:'not_checked',websitePresence:'not_checked'}}};
 const txt=createCallScript(unknown,approved);
 assert.doesNotMatch(txt,/I (?:was looking at|checked out) your Google Business Profile/i);
 assert.doesNotMatch(txt,/couldn.t find your website/i);
 assert.match(txt,/do you have a website/i);
 const notBuilt=createCallScript(sample,{...approved,status:'Draft'});
 assert.match(notBuilt,/WELL, THE THING IS, I BUILT YOU ONE!/);
 assert.match(notBuilt,/prepare the actual private concept before the presentation/i);
});

test('website script preserves a respectful existing-site branch, no pressure and refusal',()=>{
 const {createCallScript}=require('../enterprise/sbc-website-call-desk.cjs');
 const txt=createCallScript({...sample,leadIntelligence:{researchBrief:{googleBusinessPresence:'found',websitePresence:'found'}}},approved);
 assert.doesNotMatch(txt,/didn.t see a website linked/i);
 assert.match(txt,/IF THEY ALREADY HAVE A WEBSITE/i);
 assert.match(txt,/IF THEY DO NOT HAVE A WEBSITE/i);
 assert.match(txt,/do.not.contact request/i);
 assert.match(txt,/\$199/);
 assert.match(txt,/one-page Starter starts at \$199/i);
});

test('Website Production preview and copy use the refreshed script even for saved older sites',()=>{
 const code=read('public/sbc-website-production-v1.js');
 assert.equal(code,read('browser_public/sbc-website-production-v1.js'));
 assert.match(code,/SBC_WEBSITE_SALES_SCRIPT/);
 assert.match(code,/scriptForWebsite/);
 assert.match(code,/id="sbcFactoryPitch"/);
 assert.doesNotMatch(code,/esc\(demo\.salesScript\s*\|\|/);
 assert.doesNotMatch(code,/copyText\(demo\.salesScript\s*\|\|/);
 assert.match(code,/sbcFactoryMeetingConfirmed/);
 assert.match(code,/sbcFactoryCheckVisuals/);
 assert.match(code,/sbcFactoryApprove/);
});

test('white Website Production panels explicitly define accessible dark text with scoped strong contrast rules',()=>{
 const css=read('public/sbc-website-production-contrast-v1.css');
 assert.equal(css,read('browser_public/sbc-website-production-contrast-v1.css'));
 for(const selector of ['#modal .v6526-studio','.sbc-factory-light-panel','.sbc-website-hosting-guide','.sbc-website-walkthrough','.v6526-link-row','#sbcFactoryPitch','#sbcFactoryMeetingTime']){
  assert(css.includes(selector),'Missing selector '+selector);
 }
 assert.match(css,/color\s*:\s*#(?:14283f|172c43|15314b|18324a|17334d|11283d|162f47)/i);
 assert.match(css,/!important/);
 assert.match(css,/:focus-visible/);
 const ui=read('public/sbc-website-production-v1.js');
 assert.match(ui,/sbc-factory-light-panel/);
 assert.match(ui,/sbc-factory-pitch/);
 assert.match(ui,/sbc-factory-meeting-label/);
 assert.match(css,/label\.sbc-factory-meeting-label\s*\{\s*display:block!important/);
 for(const html of ['public/index.html','browser_public/index.html']){
  const page=read(html);
  assert.match(page,/sbc-v66-owner-ui-core\.[a-f0-9]{16}\.css/);
  assert.match(page,/sbc-website-sales-script-v1\.js/);
  const dir=html.split('/')[0],loader=read(dir+'/sbc-workstation-loader-v1.js');
  assert.match(loader,/'website-studio':Object\.freeze\(\['\/sbc-website-production-v1\.js\?v=[^']+'\]\)/);
  const script=page.indexOf('/sbc-website-sales-script-v1.js');
  const stub=page.indexOf('id="sbc-lazy-website-studio"');
  const boot=page.indexOf('/sbc-workstation-loader-v1.js');
  assert(script>=0&&stub>script&&boot>stub,'Sales script must initialize before any lazy Studio request');
  assert.doesNotMatch(page,/<script\b[^>]*\bsrc="\/sbc-website-production-v1\.js/);
 }
});

test('shared script logic is identical between server and browser static mirror',()=>{
 const publicFile=read('public/sbc-website-sales-script-v1.js');
 assert.equal(publicFile,read('browser_public/sbc-website-sales-script-v1.js'));
 const shared=require('../public/sbc-website-sales-script-v1.js');
 assert.equal(typeof shared.build,'function');
 const text=shared.build({businessName:'D K Auto Repair',googleVerified:true,websitePresence:'not_found',approved:true});
 assert.match(text,/jump on a quick Zoom/i);
 assert.match(text,/\[PAUSE/);
});
