'use strict';
// Combined release gate: tests exact post-patch runtime, not the loose source archive.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: release composition gate runs only as read-only CI');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const server=read('server.js'),app=read('public/app.js'),browser=read('browser_public/app.js');
const checks=[];
function test(name,fn){fn();checks.push(name)}
const pkg=JSON.parse(read('package.json'));
test('compiled runtime version and identity',()=>{assert.equal(pkg.name,'sbc-business-command-center');assert.ok(pkg.version)});
test('safe Square checkout guard in both entrypoints',()=>{for(const [tag,s] of [['public',app],['browser',browser]]){assert.ok(s.includes('SBC_V6613_SAFE_SQUARE_LINKS'),tag);assert.ok(s.includes("checkoutLinks[x[0]]"),tag);}});
test('voice identity isolation in reconstructed server',()=>{assert.ok(server.includes('SBC_V6614_VOICE_CALL_LOG_INTEGRITY'));assert.equal((server.match(/terminal\.has\(status\)/g)||[]).length>=2,true);});
test('strict MySQL voice readback is present',()=>{assert.ok(server.includes('SBC_V6615_CALL_LOG_MYSQL_DURABILITY'));assert.ok(server.includes('JSON_CONTAINS(payload,JSON_OBJECT('));assert.ok(server.includes('VOICE_LOG_NOT_DURABLE'))});
test('voice call activity and auth routes still available',()=>{for(const p of ["/api/voice/logs","/api/voice/log","/api/voice/token"]){assert.ok(server.includes(p),p)}});
test('browser uses the pinned local Twilio browser SDK',()=>{assert.ok(app.includes('/vendor/sbc-twilio-voice-sdk-2.18.5.min.js'));assert.ok(fs.statSync(path.join(root,'public/vendor/sbc-twilio-voice-sdk-2.18.5.min.js')).size>100000)});
test('recovery/writer guard intact',()=>{for(const marker of ['MYSQL_RECOVERY_REQUIRED','SBC_RUNTIME_WRITER_LEASE_REQUIRED'])assert.ok(server.includes(marker),marker)});
test('baseline lead editor and nav release guards remain',()=>{assert.ok(app.includes('SBC_V6613_SAFE_SQUARE_LINKS'));assert.ok(read('public/index.html').includes('sbc-nav-geometry-v6612.css')||/\/\* source \/sbc-nav-geometry-v6612\.css \*\//.test(read('public/'+(read('public/index.html').match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/)||[])[1])));assert.ok(fs.existsSync(path.join(root,'public/sbc-lead-edit-v6606.js')))});
const release={status:'PASS_RELEASE_COMPOSITION',checks,commit:process.env.GITHUB_SHA||'unset',source:'offline reconstructed runtime',productionCertified:false};
console.log(JSON.stringify(release,null,2));
