'use strict';
const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const cinematic=fs.readFileSync(path.join(root,'public/v569-cinematic.js'),'utf8');
const notifications=fs.readFileSync(path.join(root,'public/sbc-unattended-notifications-v6504.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const checks={
 cinematic_inflight_guard:/if\(state\.inFlight\|\|state\.stopped\)return/.test(cinematic)&&/state\.inFlight=true/.test(cinematic),
 cinematic_429_backoff:/r\.status===429/.test(cinematic)&&/Retry-After/.test(cinematic)&&/MAX_BACKOFF_MS=300000/.test(cinematic),
 cinematic_visibility_pause:/document\.visibilityState!=='visible'/.test(cinematic)&&/visibilitychange/.test(cinematic),
 cinematic_slower_polling:/NORMAL_POLL_MS=30000/.test(cinematic)&&!/setInterval\(\(\)=>\{poll\(\)/.test(cinematic),
 notification_inflight_dedup:/if\(statusInFlight\)return statusInFlight/.test(notifications),
 notification_backoff:/r\.status===429/.test(notifications)&&/Retry-After/.test(notifications)&&/MAX_BACKOFF_MS=300000/.test(notifications),
 mount_does_not_fetch:/function mount\(\)\{[\s\S]*?render\(\);\}/.test(notifications)&&!/function mount\(\)[\s\S]*?render\(\);loadStatus\(\)/.test(notifications),
 notification_poll_reduced:/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'&&shouldShow\(\)\)loadStatus\(\);\},60000\)/.test(notifications),
 cinematic_cache_busted:html.includes('/v569-cinematic.js?v=65.1.26'),
 notification_cache_busted:html.includes('/sbc-unattended-notifications-v6504.js?v=65.1.26'),
 recovery_guard_ui_preserved:notifications.includes("api('/api/owner/recovery/status')")&&notifications.includes('No data changed.'),
 owner_authorization_preserved:cinematic.includes('/api/v5691/financial/approve/')&&cinematic.includes('if(!c.lockId)return')
};
for(const [name,ok] of Object.entries(checks)){console.log(`${ok?'PASS':'FAIL'} ${name}`);assert(ok,`check failed: ${name}`)}
console.log(`Polling hotfix checks: ${Object.keys(checks).length}/${Object.keys(checks).length} PASS`);
