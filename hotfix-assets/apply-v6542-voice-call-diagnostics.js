'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6542_VOICE_CALL_DIAGNOSTICS',FROM='65.1.41',TO='65.1.42';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function read(root,rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw new Error(MARKER+': missing '+rel);return fs.readFileSync(p,'utf8');}
function write(root,rel,s){fs.writeFileSync(path.join(root,rel),s);}
function apply(root){
 let app=read(root,'public/app.js');
 app=once(app,"const j=await api('/api/voice/token');","let j;try{j=await api('/api/voice/token');}catch(tokenError){const status=await sbcVoiceStatus().catch(()=>({}));const missing=status?.setup?.missingSecrets||status?.missingSecrets||[];throw new Error(missing.length?'Twilio Voice setup is incomplete. Missing GoDaddy Secrets: '+missing.join(', '):(tokenError?.message||'Twilio Voice token request failed. Check the Voice setup and Twilio Console configuration.'));}",'token error diagnostics');
 app=once(app,"sbcVoiceDevice.on('error',e=>toast('Phone error: '+(e.message||'Unknown phone error')));","sbcVoiceDevice.on('error',e=>{const message=e?.message||'Unknown phone error';const live=document.querySelector('#sbcPhoneLiveStatus');if(live)live.textContent='Phone error: '+message;toast('Phone error: '+message);});",'device error visibility');
 app=once(app,"'Connect Twilio in GoDaddy Secrets to enable the browser phone.'","(st.setup?.missingSecrets?.length?'Missing GoDaddy Secrets: '+st.setup.missingSecrets.join(', '):'Twilio Voice is not ready. Check the Voice status endpoint and Twilio configuration.')",'missing-secret detail');
 app=once(app,"}catch(e){toast(e.message);}","}catch(e){const message=String(e?.message||'Unknown phone error');const live=document.querySelector('#sbcPhoneLiveStatus');if(live)live.textContent='Call could not start: '+message;toast('Call could not start: '+message);}",'start call error visibility');
 write(root,'public/app.js',app);
 let html=read(root,'public/index.html');
 const scriptMatches=html.match(/app\.js\?v=[^"' \t\r\n]+/g)||[];
 if(!scriptMatches.length)throw new Error(MARKER+': app.js cache-busting URL not found in public/index.html');
 html=html.replace(/app\.js\?v=[^"' \t\r\n]+/g,'app.js?v=65.1.42-voice-diagnostics');
 html=html.replace(/V65\.1\.41/g,'V65.1.42').replace(/65\.1\.41/g,'65.1.42');
 write(root,'public/index.html',html);
 let sw=read(root,'public/sw.js');
 const cache=sw.match(/const CACHE='[^']+'/);
 if(!cache)throw new Error(MARKER+': service-worker cache declaration could not be found');
 sw=sw.replace(cache[0],"const CACHE='sbc-static-v65-1-42'");
 write(root,'public/sw.js',sw);
 const pkg=JSON.parse(read(root,'package.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM)throw new Error(MARKER+': expected '+FROM+'; found '+pkg.version);
 pkg.version=TO;pkg.description='SBC OS V65.1.42 improves Customer 360 calling diagnostics and reports missing Twilio configuration';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lock=JSON.parse(read(root,'package-lock.json'));
 if(lock.name!==pkg.name||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw new Error(MARKER+': package-lock root identity mismatch');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 let identity=read(root,'config/release-identity.js');
 identity=once(identity,"const RELEASE_VERSION = '65.1.41';","const RELEASE_VERSION = '65.1.42';",'release version');
 identity=once(identity,"const RELEASE_NAME = 'LEAD_IMPORT_SCREEN';","const RELEASE_NAME = 'VOICE_CALL_DIAGNOSTICS';",'release name');
 identity=once(identity,'major:65,minor:1,patch:41','major:65,minor:1,patch:42','semantic version');
 write(root,'config/release-identity.js',identity);
 const versionPath=path.join(root,'VERSION');
 if(fs.existsSync(versionPath))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.41/g,'65.1.42'));
 return {marker:MARKER,version:TO,voiceErrorDiagnostics:true,missingSecretsShown:true,writeGatePreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
