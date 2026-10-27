const fs=require('fs'); const path=require('path');
const root=path.join(__dirname,'..','public'); const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(idx.includes('sbc-kim-canonical-v6424.js?v='+require('../config/release-identity.js').RELEASE_VERSION),'canonical Kim JS not loaded');
ok(idx.includes('sbc-kim-canonical-v6424.css?v='+require('../config/release-identity.js').RELEASE_VERSION),'canonical Kim CSS not loaded');
const js=fs.readFileSync(path.join(root,'sbc-kim-canonical-v6424.js'),'utf8');
ok(js.includes("window.openSbcAI=open"),'canonical open bridge missing');
ok(js.includes("window.closeSbcAI=close"),'canonical close bridge missing');
ok(js.includes('sbcAiInput')&&js.includes('sbcAiSend'),'canonical composer missing');
ok(js.includes('ckResize'),'canonical resize missing');
console.log('V64.2.28 canonical Kim integrity: PASS');
