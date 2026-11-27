'use strict';
// Private website export. Caller must obtain item from the live owner review
// gate and run the existing Website Studio static QA before and after embedding.
const {createHash}=require('node:crypto');
const MAX=16*1024*1024;
const fail=()=>{throw Error('INVALID_CREATIVE_EXPORT');};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function embedApprovedMedia(bundle,item,captions){
 const a=item?.asset,b=item?.bytes;
 if(bundle?.publicationReady!==false||typeof bundle.files?.['index.html']!=='string'||typeof bundle.files?.['styles.css']!=='string'||!a||!/^[a-f0-9]{64}$/.test(a.id)||!Buffer.isBuffer(b)||b.length<16||b.length>MAX||a.size!==b.length||createHash('sha256').update(b).digest('hex')!==a.sha256||typeof a.alt!=='string'||!a.alt.trim()||a.alt.length>180||/[\u0000-\u001f\u007f]/.test(a.alt)||!['image/png','video/mp4'].includes(a.mime))fail();
 const files={...bundle.files},base='assets/sbc-creative-'+a.id,video=a.mime==='video/mp4',name=base+(video?'.mp4':'.png');
 if(Object.hasOwn(files,name)||Object.hasOwn(files,base+'.vtt')||files['index.html'].includes('data-sbc-creative-media'))fail();
 const hero=/<section class="composed-hero[^"]*"[^>]*>[\s\S]*?<\/section>/;
 if(!hero.test(files['index.html']))fail();
 files[name]=Buffer.from(b);
 let content;
 if(video){if(typeof captions!=='string'||!captions.startsWith('WEBVTT\n\n')||captions.length>8192||/[<>\u0000]/.test(captions.replace(/-->/g,'')))fail();files[base+'.vtt']=captions;content='<video controls playsinline preload="metadata" aria-label="'+escape(a.alt)+'" src="'+name+'"><track kind="captions" src="'+base+'.vtt" srclang="en" label="Scene text"><p>'+escape(a.alt)+'</p></video>';}
 else content='<img loading="lazy" decoding="async" src="'+name+'" alt="'+escape(a.alt)+'">';
 const figure='<figure data-sbc-creative-media class="sbc-creative-feature">'+content+'<figcaption>'+escape(a.alt)+'</figcaption></figure>';
 files['index.html']=files['index.html'].replace(hero,m=>m+figure);
 files['styles.css']+='\n.sbc-creative-feature{margin:24px auto;padding:0 16px;max-width:1160px}.sbc-creative-feature img,.sbc-creative-feature video{display:block;width:100%;height:auto;max-height:640px;object-fit:contain}.sbc-creative-feature figcaption{margin-top:8px}\n';
 return {...bundle,files,publicationReady:false};
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function storedZip(files){
 if(!files||typeof files!=='object'||Array.isArray(files))fail();
 const names=Object.keys(files).sort();if(!names.length||names.length>256)fail();
 const local=[],central=[];let offset=0,centralSize=0;
 for(const name of names){if(name.length>240||!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(name)||name.split('/').some(p=>p==='.'||p==='..'))fail();
  const value=files[name];if(!Buffer.isBuffer(value)&&typeof value!=='string')fail();
  const b=Buffer.isBuffer(value)?value:Buffer.from(value),n=Buffer.from(name),crc=crc32(b);
  if(offset+b.length+30+n.length+centralSize+46+n.length+22>MAX)fail();
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  local.push(h,n,b);central.push(c,n);offset+=h.length+n.length+b.length;centralSize+=c.length+n.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,end]);
}
module.exports={embedApprovedMedia,storedZip};
