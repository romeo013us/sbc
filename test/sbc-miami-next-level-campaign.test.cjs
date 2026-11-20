'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Miami Next Level campaign landing is original, responsive, accurate and mirrored',()=>{
 const html=read('public/miami-next-level.html');
 assert.equal(html,read('browser_public/miami-next-level.html'));
 for(const phrase of ['MIAMI IS IN THE SPOTLIGHT','YOUR BUSINESS SHOULD BE NEXT','Successful By Choice','Because Why Not?','$199','$499','sbcmia.com/contact.php','utm_campaign=miami_next_level_2026'])
  assert(html.includes(phrase),phrase);
 assert.match(html,/name="viewport"/);
 assert.match(html,/@media\s*\(max-width:/);
 assert.match(html,/@media\s*\(prefers-reduced-motion/);
 assert.doesNotMatch(html,/rockstargames\.com|<img[^>]+gta|GTA VI OFFICIAL|official Rockstar partner/i);
 assert.doesNotMatch(html,/guaranteed (?:sales|ranking|results)|limited time discount/i);
 assert.match(html,/not affiliated/i);
});
test('Marketing Hub offers a reusable trend-to-revenue brief and Miami launch preset',()=>{
 const js=read('public/sbc-v6567-marketing-hub.js');
 assert.equal(js,read('browser_public/sbc-v6567-marketing-hub.js'));
 new vm.Script(js);
 for(const text of ['Trend Lab','Miami Next Level','data-action="draft-trend-campaign"','SBC Miami Next Level','miami_next_level_2026'])
  assert(js.includes(text),text);
 assert.match(js,/original creative/i);
 assert.match(js,/reviewed by the owner/i);
});
