'use strict';
/* Academy 360 autonomous instructional media.
 * REAL checked-in workstation UI + synthetic LOCAL example accounts only.
 * Video is an automated simulation, NOT an authenticated employee recording. */
const fs=require('node:fs'),p=require('node:path'),os=require('node:os'),http=require('node:http'),cp=require('node:child_process');
const {COURSE}=require('../enterprise/sbc-am-academy-v1.cjs');
const project=p.resolve(__dirname,'..'),publicRoot=p.join(project,'public');
const outputs=[p.join(project,'public/academy-media/academy360'),p.join(project,'browser_public/academy-media/academy360')];
const actions={
 'am-01':['accounts','account','website-value','controls'],'am-02':['accounts','website-value','social','controls'],
 'am-03':['accounts','account','notes','controls'],'am-04':['accounts','account','notes','controls'],
 'am-05':['accounts','account','notes','website-value'],'am-06':['website-value','sales','accounts','controls'],
 'am-07':['website-value','accounts','account','notes'],'am-08':['website-value','accounts','controls','sales'],
 'am-09':['accounts','account','notes','controls'],'am-10':['sales','controls','accounts','account'],
 'am-11':['handoffs','accounts','account','controls'],'am-12':['accounts','account','website-value','controls']
};
const fakeAccounts=[
 {id:'TRAINING-001',businessName:'Fictional Neighborhood Auto Care',contactName:'Fictional Owner',phone:'TRAINING ONLY - NO REAL NUMBER',city:'Example City',managerId:'academy-test',status:'PROSPECT',doNotContact:false,timeline:[]},
 {id:'TRAINING-002',businessName:'Fictional Hair Studio',contactName:'Fictional Owner',phone:'TRAINING ONLY - NO REAL NUMBER',city:'Example City',managerId:'academy-test',status:'FOLLOW_UP',doNotContact:false,timeline:[]}
];
function plan(){
 const modules=COURSE.modules.filter(x=>actions[x.id]);
 if(modules.length!==12)throw Error('EXPECTED_TWELVE_REAL_COURSE_MODULES');
 return modules.flatMap(m=>['en','es'].map(lang=>{
  const es=lang==='es',x=m.translations.es;
  const phrases=es?[x.title+'. '+x.objective,x.learn[0],'Ejemplo de conversación: '+x.script,'Regla de seguridad: '+x.redFlags]:
   [m.title+'. '+m.description,m.lesson.learn[0],'Example customer conversation: '+m.academyMedia.script,'Safety boundary: '+m.academyMedia.redFlags];
  if(phrases.some(t=>typeof t!=='string'||t.length<15))throw Error('EMPTY_NARRATION');
  return {id:m.id,lang,title:es?x.title:m.title,phrases,scenes:actions[m.id]};
 }));
}
function run(binary,args){return cp.execFileSync(binary,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1000000}).trim();}
function length(filename){
 const n=Number(run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',filename]));
 if(!Number.isFinite(n)||n<=0)throw Error('BAD_MEDIA_DURATION');return n;
}
function stamp(time){const ms=Math.round(time*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');}
function makeVtt(phrases,durations){
 if(phrases.length!==4||durations.length!==4)throw Error('INVALID_CAPTION_STORY');
 let start=0,n=1,content='WEBVTT\n\n';
 for(let i=0;i<4;i++){
  const words=phrases[i].trim().split(/\s+/),parts=[];
  for(let j=0;j<words.length;j+=9)parts.push(words.slice(j,j+9).join(' '));
  const span=(durations[i]-0.8)/parts.length;
  for(let j=0;j<parts.length;j++)content+=(n++)+'\n'+stamp(start+j*span)+' --> '+stamp(start+(j+1)*span)+'\n'+parts[j]+'\n\n';
  start+=durations[i];
 }
 return content;
}
function result(res,status,payload){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));}
function api(req,res,url){
 if(req.method!=='GET')return result(res,403,{ok:false,error:'TRAINING_MUTATIONS_FORBIDDEN'});
 if(url==='/api/me')return result(res,200,{ok:true,user:{id:'academy-test',name:'Fictional Training Account Manager',role:'account_manager',active:true}});
 if(url==='/api/v6606/crm/account-portfolios/mine')return result(res,200,{ok:true,data:{tenantId:1,accounts:fakeAccounts}});
 if(url==='/api/account-social/v1/research/queue')return result(res,200,{ok:true,data:[]});
 if(url==='/api/sbc/sales/actions/today')return result(res,200,{ok:true,total:0,counts:{},rows:[],actions:[]});
 if(url==='/api/sbc/sales/reminders/preview')return result(res,200,{ok:true,rows:[],sendEnabled:false});
 if(url==='/api/appointments')return result(res,200,{ok:true,appointments:[]});
 if(url.endsWith('/history'))return result(res,200,{ok:true,notes:[]});
 return result(res,404,{ok:false,error:'NOT_PROVIDED_BY_ISOLATED_TRAINING'});
}
function server(){
 return http.createServer((req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/api/'))return api(req,res,url.pathname);
   if(req.method!=='GET')return result(res,403,{ok:false,error:'NO_WRITES'});
   const file=p.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(publicRoot+p.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return result(res,404,{ok:false});
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'}[p.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':mime});fs.createReadStream(file).pipe(res);
  }catch(_){result(res,404,{ok:false});}
 });
}
function screenshotName(id,lang,index){return id+'-'+lang+'-'+String(index+1).padStart(2,'0')+'.webp';}
async function show(page,scene,lang){
 if(['account','notes'].includes(scene)){
  await page.locator('[data-view="accounts"]').click();
  await page.locator('#accountGrid [data-action="open-account"]').first().click();
 }else{
  await page.locator('[data-view="'+scene+'"]').click();
 }
 if(scene==='notes')await page.locator('#noteForm input[name="summary"]').fill('FICTIONAL training note: verify business information and request permission before follow-up.');
 await page.locator(lang==='es'?'#lang-es':'#lang-en').click();
 const focus={accounts:'#accountGrid',account:'#accountDetail',notes:'#noteForm','website-value':'#view-website-value',sales:'#view-sales',social:'#view-social',handoffs:'#view-handoffs',controls:'#view-controls'}[scene];
 await page.locator(focus).scrollIntoViewIfNeeded().catch(()=>{});
 return focus;
}
async function annotate(page,story,i,focus){
 await page.evaluate(data=>{
  let el=document.querySelector('#academy-video-disclosure');
  if(!el){el=document.createElement('aside');el.id='academy-video-disclosure';document.body.append(el);}
  el.style.cssText='position:fixed!important;z-index:2147483000!important;bottom:0;left:0;right:0;background:#092739f5;color:white;padding:10px 24px;border-top:4px solid #f4ca75;font:600 15px/1.45 Arial,sans-serif;text-align:left;box-shadow:0 0 20px #1118;';
  const title=document.createElement('div');title.textContent='SBC ACADEMY 360 · '+data.title+' · '+(data.i+1)+'/4';
  const subtitle=document.createElement('div');subtitle.style.fontSize='13px';subtitle.textContent=data.phrase.slice(0,145);
  const notice=document.createElement('div');notice.style.cssText='font-size:11px;color:#ffdc88';
  notice.textContent=data.lang==='es'?'CAPTURA AUTOMÁTICA DE LA INTERFAZ SBC · DATOS TOTALMENTE FICTICIOS':'AUTOMATED REAL SBC INTERFACE CAPTURE · COMPLETELY FICTIONAL DATA';
  el.replaceChildren(title,subtitle,notice);
  document.querySelectorAll('[data-academy-glow]').forEach(e=>{e.style.outline='';e.removeAttribute('data-academy-glow');});
  const target=document.querySelector(data.focus);
  if(target){target.style.outline='4px solid #f4ca75';target.style.outlineOffset='2px';target.setAttribute('data-academy-glow','');}
 },{title:story.title,i,phrase:story.phrases[i],lang:story.lang,focus});
}
function safeguard(file,generated){
 if(fs.existsSync(file)&&!generated.has(p.basename(file)))throw Error('REFUSE_OVERWRITE_NON_AUTOMATED_ASSET_'+p.basename(file));
}
async function one(browser,url,story,temp,previous){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.setDefaultTimeout(14000);
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const dir=p.join(temp,story.id+'-'+story.lang);fs.mkdirSync(dir,{recursive:true});
 const frames=[],voices=[],durations=[];
 try{
  await page.goto(url+'/sbc-account-manager-v1.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#rolePill')?.textContent.includes('ACCOUNT MANAGER'),null,{timeout:20000});
  for(let i=0;i<4;i++){
   const focus=await show(page,story.scenes[i],story.lang);await annotate(page,story,i,focus);
   await page.waitForTimeout(250);
   const png=p.join(dir,'frame-'+i+'.png'),webp=p.join(outputs[0],screenshotName(story.id,story.lang,i));
   frames.push(png);await page.screenshot({path:png,animations:'disabled'});
   safeguard(webp,previous);run('ffmpeg',['-y','-v','error','-i',png,'-c:v','libwebp','-q:v','75',webp]);
   const raw=p.join(dir,'voice-'+i+'.wav'),padded=p.join(dir,'voicep-'+i+'.wav');
   run('espeak-ng',['-v',story.lang==='es'?'es':'en-us','-s','142','-w',raw,story.phrases[i]]);
   const seconds=Math.max(14,Math.ceil(length(raw)+1));durations.push(seconds);
   run('ffmpeg',['-y','-v','error','-i',raw,'-af','apad','-t',String(seconds),'-ar','22050','-ac','1',padded]);
   voices.push(padded);
  }
 }finally{await page.close();}
 const stem=story.id+'-'+story.lang;
 const video=p.join(outputs[0],stem+'.mp4'),audio=p.join(outputs[0],stem+'-audio.webm'),vtt=p.join(outputs[0],stem+'.vtt');
 for(const file of [video,audio,vtt])safeguard(file,previous);
 const frameList=p.join(dir,'frames.txt'),audioList=p.join(dir,'audio.txt');
 const fileLine=f=>"file '"+f+"'\n";
 fs.writeFileSync(frameList,frames.map((f,i)=>fileLine(f)+'duration '+durations[i]+'\n').join('')+fileLine(frames[3]));
 fs.writeFileSync(audioList,voices.map(fileLine).join(''));
 run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',frameList,'-f','concat','-safe','0','-i',audioList,
  '-map','0:v','-map','1:a','-vf','fps=12,scale=960:540,format=yuv420p','-c:v','libx264','-preset','ultrafast','-crf','30','-c:a','aac','-b:a','56k','-movflags','+faststart','-shortest',video]);
 run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',audioList,'-c:a','libopus','-b:a','40k',audio]);
 fs.writeFileSync(vtt,makeVtt(story.phrases,durations));
 const filenames=[stem+'.mp4',stem+'-audio.webm',stem+'.vtt',...Array.from({length:4},(_,i)=>screenshotName(story.id,story.lang,i))];
 for(const file of filenames){fs.mkdirSync(outputs[1],{recursive:true});fs.copyFileSync(p.join(outputs[0],file),p.join(outputs[1],file));}
 if(length(video)<45||length(audio)<45)throw Error('TOO_SHORT_'+stem);
 return {lessonId:story.id,lang:story.lang,seconds:length(video),files:filenames};
}
async function generate(){
 for(const dir of outputs)fs.mkdirSync(dir,{recursive:true});
 const priorFile=p.join(outputs[0],'AUTO_GENERATED_MANIFEST.json');
 const previous=new Set(fs.existsSync(priorFile)?JSON.parse(fs.readFileSync(priorFile,'utf8')).files:[]);
 const svc=server();await new Promise((resolve,reject)=>{svc.once('error',reject);svc.listen(0,'127.0.0.1',resolve);});
 const dir=fs.mkdtempSync(p.join(os.tmpdir(),'sbc-academy-auto-'));let browser=null;
 try{
  const {chromium}=require('playwright');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const results=[];
  for(const story of plan()){console.log('AUTOMATING',story.id,story.lang);results.push(await one(browser,'http://127.0.0.1:'+svc.address().port,story,dir,previous));}
  const filenames=results.flatMap(r=>r.files);
  const manifest={schema:1,version:'66.169',source:'REAL_SBC_WORKSTATION_HTML_JS_WITH_LOCAL_SYNTHETIC_API',authenticatedEmployeeRecording:false,
   syntheticOnly:true,noLiveOutreach:true,notice:'AUTOMATED TRAINING SIMULATIONS, NOT LIVE EMPLOYEE RECORDINGS',createdAt:new Date().toISOString(),files:filenames,lessons:results};
  for(const output of outputs)fs.writeFileSync(p.join(output,'AUTO_GENERATED_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('MEDIA GENERATED',results.length,'bilingual videos and audio tracks,',results.length*4,'real-code UI screenshots');
 }finally{if(browser)await browser.close();await new Promise(r=>svc.close(r));fs.rmSync(dir,{recursive:true,force:true});}
}
function verify(){
 const m=JSON.parse(fs.readFileSync(p.join(outputs[0],'AUTO_GENERATED_MANIFEST.json')));
 if(m.lessons.length!==24||m.authenticatedEmployeeRecording!==false||m.files.length!==168)throw Error('AUTO_MEDIA_INCOMPLETE');
 for(const name of m.files){
  if(!/^am-(0[1-9]|1[0-2])-(en|es)(?:-audio)?\.(?:mp4|webm|vtt)$/.test(name)&&!/^am-(0[1-9]|1[0-2])-(en|es)-0[1-4]\.webp$/.test(name))throw Error('UNSAFE_FILENAME');
  const a=p.join(outputs[0],name),b=p.join(outputs[1],name);
  if(!fs.existsSync(a)||fs.statSync(a).size<150||!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b)))throw Error('MISSING_MEDIA_'+name);
 }
 console.log('VERIFIED 24 bilingual videos, 24 audio files, 24 captions, 96 screenshots, matching public mirrors');
}
if(require.main===module){
 const task=process.argv[2];
 Promise.resolve().then(()=>task==='--plan'?console.log(plan().map(x=>x.id+'-'+x.lang).join('\n')):task==='--generate'?generate():task==='--verify'?verify():(()=>{throw Error('Expected --plan, --generate or --verify');})()).catch(err=>{console.error(err.stack||err);process.exitCode=1;});
}
module.exports={plan,makeVtt,stamp,api,fakeAccounts,actions};
