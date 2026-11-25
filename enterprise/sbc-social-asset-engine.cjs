'use strict';
// Offline SBC-owned creative staging. Never sends a post or obtains provider credentials.
// ImageMagick is a local, free renderer; no runtime npm dependency or paid service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const PALETTE=['#0A192F','#0066CC','#FF6B00','#FFFFFF'];
const COPY=[
 ['Websites','Build your online presence','A professional website for your business','Explore website design','Make your first impression count','A mobile-friendly home for your brand'],
 ['Hosting','Give your website a home','Domains and hosting for your next step','Explore hosting','Start with the right domain','Build your digital foundation'],
 ['Printing','Make your brand tangible','Business cards, flyers and more','Explore printing','Bring your brand into the real world','Professional materials for your next meeting'],
 ['Office Box','Organize your business','Manage leads and follow-ups in one place','Explore Office Box','Keep your next steps organized','Give your customer workflow a home'],
 ['SEO','Help customers find you','Improve your online business visibility','Explore SEO','Be easier to discover','Build a stronger online presence'],
 ['Notary','Get your documents ready','Ask about Florida notary services','Explore notary services','Professional notary assistance','Contact us about your documents']
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code)};
const validHash=(v,n)=>typeof v==='string'&&new RegExp('^[0-9a-f]{'+n+'}$').test(v);
function slots(day){
 if(typeof day!=='string'||!/^\d{4}-\d\d-\d\d$/.test(day))fail('INVALID_DAY');
 const start=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(+start)||start.toISOString().slice(0,10)!==day)fail('INVALID_DAY');
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 return Array.from({length:14},(_,i)=>{
  const date=new Date(+start+Math.floor(i/2)*86400000).toISOString().slice(0,10),hour=i%2?22:10;
  const target=date+'T'+String(hour).padStart(2,'0')+':00';
  let at;
  for(const offset of [4,5]){
   const t=new Date(Date.parse(target+'Z')+offset*3600000);
   const p=Object.fromEntries(format.formatToParts(t).map(x=>[x.type,x.value]));
   if(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute===target){at=t.toISOString();break;}
  }
  if(!at)fail('INVALID_EASTERN_SLOT');
  return {key:target+' America/New_York',at,hour,day:date};
 });
}
function dhash(grid){
 if(!Buffer.isBuffer(grid)||grid.length!==72)fail('INVALID_GRAYSCALE_GRID');
 let n=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)n=(n<<1n)|BigInt(grid[y*9+x]>grid[y*9+x+1]);
 return n.toString(16).padStart(16,'0');
}
function distance(a,b){
 if(!validHash(a,16)||!validHash(b,16))fail('INVALID_VISUAL_HASH');
 let n=BigInt('0x'+a)^BigInt('0x'+b),count=0;while(n){n&=n-1n;count++;}return count;
}
function validateFingerprint(row){if(!row||!validHash(row.sha256,64)||!validHash(row.dhash,16))fail('INVALID_ASSET_HISTORY');}
function duplicate(candidate,history){
 validateFingerprint(candidate);if(!Array.isArray(history))fail('INVALID_ASSET_HISTORY');
 for(const row of history)validateFingerprint(row);
 return history.some(row=>row.sha256===candidate.sha256)||history.slice(-30).some(row=>distance(row.dhash,candidate.dhash)<=6);
}
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function wrap(text,limit){
 const lines=[];let line='';for(const word of text.split(' ')){if(line&&line.length+word.length+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;
}
function svgCard({logo,slot,index,variant,width,height}){
 if(!Buffer.isBuffer(logo)||logo.length<100||logo[0]!==255||logo[1]!==216)fail('SBC_LOGO_JPEG_REQUIRED');
 const service=COPY[index%COPY.length],alt=(Math.floor(index/6)+variant)%2;
 const headline=service[alt?4:1],value=service[alt?5:2],cta=service[3];
 // Distinct compositions use clean graphic motifs, not random noise or pixel tweaks.
 const seed=crypto.createHash('sha256').update(slot.key+':'+variant).digest();
 const style=(index+variant)%8,white=style===2||style===5||style===7;
 const bg=white?PALETTE[3]:PALETTE[0],ink=white?PALETTE[0]:PALETTE[3];
 const accent=PALETTE[1+seed[0]%2],secondary=accent===PALETTE[1]?PALETTE[2]:PALETTE[1];
 const w=width,h=height,pad=Math.round(w*.065),compact=h<w*.75;
 const top=Math.round(h*(compact?.23:.30)),font=Math.round(w*(compact?.052:.064));
 const side=style%2===0,visualX=side?Math.round(w*.75):Math.round(w*.28),visualY=Math.round(h*(compact?.55:.73));
 const radius=Math.round(Math.min(w,h)*.18);
 const textX=pad,textY=top+font;
 const text=(s,x,y,size,weight,fill=ink)=>'<text x="'+x+'" y="'+y+'" font-family="DejaVu Sans" font-size="'+size+'" font-weight="'+weight+'" fill="'+fill+'">'+xml(s)+'</text>';
 let art='';
 const rect=(x,y,a,b,color,rx=0)=>'<rect x="'+x+'" y="'+y+'" width="'+a+'" height="'+b+'" rx="'+rx+'" fill="'+color+'"/>';
 const circle=(x,y,r,color)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+color+'"/>';
 const stripe=seed[1]%3;
 if(style===0)art=rect(w*.67,0,w*.33,h,accent)+circle(visualX,h*.81,radius,secondary);
 if(style===1)art=rect(0,h*.58,w,h*.42,accent)+rect(w*.08,h*.64,w*.31,h*.29,secondary,22);
 if(style===2)art=rect(w*.72,0,w*.28,h,PALETTE[0])+circle(w*.87,h*.72,radius,accent);
 if(style===3)art='<path d="M '+w+' 0 L '+w+' '+h+' L '+w*.44+' '+h+' Z" fill="'+accent+'"/>'+circle(w*.85,h*.8,radius,secondary);
 if(style===4)art=rect(0,0,w*.04,h,accent)+rect(w*.72,h*.48,w*.28,h*.52,secondary)+circle(w*.76,h*.77,radius,accent);
 if(style===5)art=rect(0,h*.68,w,h*.32,PALETTE[0])+rect(w*.62,0,w*.38,h*.21,accent);
 if(style===6)art=circle(w*.86,h*.34,radius,accent)+circle(w*.9,h*.86,radius,secondary)+rect(0,h*.94,w,h*.06,accent);
 if(style===7)art='<path d="M 0 '+h*.58+' L '+w+' '+h*.32+' L '+w+' '+h+' L 0 '+h+' Z" fill="'+accent+'"/>'+rect(w*.65,h*.62,w*.35,h*.38,PALETTE[0]);
 // A solid, high-contrast copy panel makes every composition legible.
 const panelW=Math.round(w*.68),panelH=Math.round(h*(compact?.51:.43));
 const panelY=top-Math.round(font*.36);
 art+=rect(pad*.55,panelY,panelW,panelH,bg,Math.round(w*.016));
 const logoSize=Math.round(h*(compact?.15:.115));
 const logoX=pad,logoY=Math.round(h*.055);
 const logoData=logo.toString('base64');
 let typography=rect(pad,top-font*.64,Math.round(w*.13),Math.round(h*.009),accent);
 const titleLines=wrap(headline,compact?20:18);
 const tf=Math.round(font*(titleLines.length>2?.79:1));
 typography+=titleLines.map((line,i)=>text(line,textX,textY+i*tf*1.12,tf,700)).join('');
 const valueY=textY+(titleLines.length-1)*tf*1.12+Math.round(font*.72);
 typography+=wrap(value,36).map((line,i)=>text(line,textX,valueY+i*w*.027,Math.round(w*.025),400)).join('');
 const footerColor=PALETTE[0],footerY=Math.round(h*.91);
 typography+=rect(pad,footerY-w*.034,w*.53,w*.06,footerColor,12)+text(cta+'  |  sbcmia.com',pad+w*.018,footerY+w*.006,Math.round(w*.024),700,PALETTE[3]);
 const badgeX=pad+logoSize+w*.022;
 typography+=text('SUCCESSFUL BY CHOICE',badgeX,logoY+logoSize*.42,Math.round(w*.025),700);
 typography+=text(service[0].toUpperCase()+'  /  BECAUSE WHY NOT?',badgeX,logoY+logoSize*.77,Math.round(w*.018),400);
 // service-specific pictograms placed in the accent area, no stock/third-party imagery.
 const gx=Math.round(w*(style===1?.24:.81)),gy=Math.round(h*(compact?.72:.76)),u=Math.round(Math.min(w,h)*.075);
 const glyphs=[
 '<rect x="-70" y="-52" width="140" height="89" rx="8" fill="none" stroke="white" stroke-width="9"/><path d="M -25 57 H 25 M 0 37 V 57" stroke="white" stroke-width="9"/>',
 '<rect x="-65" y="-57" width="130" height="48" rx="8" fill="none" stroke="white" stroke-width="9"/><rect x="-65" y="9" width="130" height="48" rx="8" fill="none" stroke="white" stroke-width="9"/><circle cx="-40" cy="-33" r="6" fill="white"/><circle cx="-40" cy="33" r="6" fill="white"/>',
 '<rect x="-65" y="-45" width="130" height="90" rx="8" fill="none" stroke="white" stroke-width="9"/><path d="M -42 -20 H 42 M -42 0 H 20 M -42 20 H 32" stroke="white" stroke-width="6"/>',
 '<rect x="-65" y="-55" width="130" height="110" rx="8" fill="none" stroke="white" stroke-width="9"/><path d="M -35 -25 H 40 M -35 0 H 40 M -35 25 H 40" stroke="white" stroke-width="6"/><path d="M -55 -25 l 5 5 8 -12 M -55 0 l 5 5 8 -12 M -55 25 l 5 5 8 -12" fill="none" stroke="white" stroke-width="5"/>',
 '<circle cx="-15" cy="-15" r="45" fill="none" stroke="white" stroke-width="10"/><path d="M 18 18 L 62 62" stroke="white" stroke-width="12" stroke-linecap="round"/>',
 '<path d="M -45 -60 H 25 L 50 -35 V 60 H -45 Z M 25 -60 V -35 H 50 M -24 -12 H 28 M -24 12 H 28 M -24 36 H 12" fill="none" stroke="white" stroke-width="7" stroke-linejoin="round"/>'
 ];
 const glyph='<g transform="translate('+gx+' '+gy+') scale('+u/55+')">'+glyphs[index%6]+'</g>';
 return {svg:'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+rect(0,0,w,h,bg)+art+glyph+'<image x="'+logoX+'" y="'+logoY+'" width="'+logoSize+'" height="'+logoSize+'" xlink:href="data:image/jpeg;base64,'+logoData+'"/>'+typography+'</svg>',service:service[0],caption:headline+'. '+value+'. '+cta+' at https://sbcmia.com. Because Why Not?'};
}
function imageCommand(args,input,renderer){
 const executable=renderer||process.env.SBC_IMAGE_RENDERER||'convert';
 const r=spawnSync(executable,args,{input,timeout:30000,maxBuffer:32*1024*1024,windowsHide:true});
 if(r.error||r.status!==0)fail('LOCAL_RENDERER_FAILED: '+String(r.error?.message||r.stderr||'').slice(0,300));
 return r.stdout;
}
function render(svg,w,h,renderer){
 const png=imageCommand(['-font','DejaVu-Sans','-background','white','svg:-','-strip','-define','png:exclude-chunks=all','PNG24:-'],Buffer.from(svg),renderer);
 if(png.length<100||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==w||png.readUInt32BE(20)!==h)fail('INVALID_RENDERED_PNG');
 const grid=imageCommand(['png:-','-resize','9x8!','-colorspace','Gray','-depth','8','gray:-'],png,renderer);
 return {png,sha256:hash(png),dhash:dhash(grid)};
}
function generate({startDay,logo,history=[],renderer}={}){
 if(!Array.isArray(history))fail('INVALID_ASSET_HISTORY');for(const row of history)validateFingerprint(row);
 const accepted=[];
 for(const [index,slot] of slots(startDay).entries()){
  const [width,height]=index%2?[1200,630]:[1080,1080];let row;
  for(let variant=0;variant<48;variant++){
   const card=svgCard({logo,slot,index,variant,width,height});
   const pixels=render(card.svg,width,height,renderer);
   if(duplicate(pixels,[...history,...accepted]))continue;
   row={...slot,...pixels,width,height,service:card.service,caption:card.caption,logoSha256:hash(logo),state:'DRAFT'};
   break;
  }
  if(!row)fail('INSUFFICIENT_DISTINCT_CREATIVE_INVENTORY');
  accepted.push(row);
 }
 return accepted;
}
function readManifest(dir){
 const file=path.join(dir,'inventory.json');
 if(!fs.existsSync(file))return {version:1,assets:[]};
 const m=JSON.parse(fs.readFileSync(file,'utf8'));if(m.version!==1||!Array.isArray(m.assets))fail('INVALID_INVENTORY');
 for(const row of m.assets){
  validateFingerprint(row);if(!['DRAFT','APPROVED'].includes(row.state))fail('INVALID_INVENTORY_STATE');
  const png=path.join(dir,row.sha256+'.png');
  if(!fs.existsSync(png)||hash(fs.readFileSync(png))!==row.sha256)fail('ASSET_INTEGRITY');
 }return m;
}
function writeManifest(dir,m){
 const file=path.join(dir,'inventory.json'),tmp=path.join(dir,'.manifest-'+crypto.randomUUID());
 const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(m,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function locked(dir,fn){
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const lock=path.join(dir,'.inventory-lock');
 try{fs.mkdirSync(lock,{mode:0o700});}catch{fail('INVENTORY_LOCKED_OWNER_REVIEW');}
 try{return fn();}finally{fs.rmdirSync(lock);}
}
function stage(dir,rows){
 return locked(dir,()=>{
  const m=readManifest(dir);
  if(!Array.isArray(rows)||!rows.length)fail('EMPTY_INVENTORY');
  const next=[];
  for(const row of rows){
   validateFingerprint(row);
   if(row.state!=='DRAFT'||!Buffer.isBuffer(row.png)||hash(row.png)!==row.sha256)fail('ASSET_INTEGRITY');
   if(duplicate(row,[...m.assets,...next]))fail('DUPLICATE_CREATIVE');
   const {png,...metadata}=row;next.push({...metadata,png});
  }
  for(const row of next){
   const file=path.join(dir,row.sha256+'.png');
   if(fs.existsSync(file)){if(hash(fs.readFileSync(file))!==row.sha256)fail('ASSET_INTEGRITY');}
   else fs.writeFileSync(file,row.png,{flag:'wx',mode:0o600});
   const {png,...metadata}=row;m.assets.push(metadata);
  }
  writeManifest(dir,m);return m.assets.length;
 });
}
function approve(dir,sha){
 if(!validHash(sha,64))fail('INVALID_ASSET_HASH');
 return locked(dir,()=>{
  const m=readManifest(dir),row=m.assets.find(r=>r.sha256===sha);
  if(!row)fail('ASSET_NOT_FOUND');
  if(row.state==='DRAFT'){row.state='APPROVED';row.approvedAt=new Date().toISOString();writeManifest(dir,m);}
  return {...row};
 });
}
function inventory(dir){const m=readManifest(dir),approved=m.assets.filter(r=>r.state==='APPROVED').length;return {approved,drafts:m.assets.length-approved,low:approved<6,belowFloor:approved<14,assets:m.assets};}
function retry({attempt,outcome,status,retryAfterMs=0}={}){
 if(outcome!=='REJECTED_TRANSIENT')return {action:outcome==='UNKNOWN'?'RECONCILE':'OWNER_REVIEW'};
 if(!Number.isInteger(attempt)||attempt<0||attempt>=3||!(status===429||status>=500&&status<=599))return {action:'OWNER_REVIEW'};
 if(!Number.isFinite(retryAfterMs)||retryAfterMs<0||retryAfterMs>900000)return {action:'OWNER_REVIEW'};
 return {action:'RETRY',delayMs:Math.max([60000,300000,900000][attempt],retryAfterMs)};
}
module.exports={PALETTE,slots,dhash,distance,duplicate,svgCard,render,generate,stage,approve,inventory,retry};
