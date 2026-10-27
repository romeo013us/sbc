'use strict';
// Version-agnostic dashboard boot / recovery-guard integrity test.
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const master=fs.readFileSync(path.join(root,'public/sbc-master-control-theme-v56-25-3.js'),'utf8');
const need=(c,m)=>{if(!c)throw new Error(m)};
need(/SBC V\d+\.\d+\.\d+ CANONICAL DASHBOARD LOCK/.test(html),'dashboard lock missing');
need(html.includes('window.sbcFlowView=window.dashboard'),'canonical dashboard binding missing');
need(master.includes('/api/owner/recovery/status'),'server-authoritative recovery status check missing');
need(master.includes('Automation stays OFF'),'fail-closed automation guard missing');
need(master.includes('recovery?.required'),'recovery-required guard missing');
need(/sw\.disabled=recovery/.test(master),'master switch is not locked during recovery');
console.log('Dashboard boot/state integrity (version-agnostic): PASS');
