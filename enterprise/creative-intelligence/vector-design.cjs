'use strict';
// Dependency-free template renderer; no external content, AI claims or network access.
const {createHash}=require('node:crypto');
const formats=Object.freeze({square:[1080,1080],portrait:[1080,1920],landscape:[1600,900]});
const palettes=Object.freeze({midnight:['#101C34','#203B58','#7CE4D5','#F5F8FC','#DCE8F2'],forest:['#102C27','#234D42','#BDE6A0','#F5FAEF','#DCE9DF'],ink:['#21233D','#3F355C','#F7D596','#FFF9F1','#F2E5F5']});
const fields=new Set(['format','brand','headline','detail','cta','palette']);
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function copy(value,max,required=true){
 if(typeof value!=='string'||!value.isWellFormed()||/[\u0000-\u001f\u007f\ufffe\uffff]/u.test(value)||/<\s*\/?[a-z][^>]*>/i.test(value))throw Error('INVALID_VECTOR_COPY');
 const text=value.trim().replace(/\s+/gu,' ');
 if((required&&!text)||Array.from(text).length>max)throw Error('INVALID_VECTOR_COPY');
 return text;
}
const units=s=>Array.from(s).reduce((n,c)=>n+(/[MW@%]/.test(c)?1.05:/[ilI.,:;!| ]/.test(c)?0.36:/[^\u0000-\u024f]/u.test(c)?1.1:0.72),0);
function wrap(text,capacity,maxLines){
 const lines=[];let line='';
 for(const word of text.split(' ')){
  if(units(word)>capacity)throw Error('INVALID_VECTOR_COPY_FIT');
  const candidate=line?line+' '+word:word;
  if(units(candidate)>capacity){lines.push(line);line=word;}else line=candidate;
 }
 if(line)lines.push(line);
 if(lines.length>maxLines)throw Error('INVALID_VECTOR_COPY_FIT');
 return lines;
}
function fit(text,width,height,maxSize,minSize){
 for(let size=maxSize;size>=minSize;size-=2){
  try{return {size,lines:wrap(text,width/size,Math.floor(height/(size*1.18)))}}catch(e){if(e.message!=='INVALID_VECTOR_COPY_FIT')throw e;}
 }
 throw Error('INVALID_VECTOR_COPY_FIT');
}
function renderVector(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.has(k)))throw Error('INVALID_VECTOR_REQUEST');
 if(!Object.hasOwn(formats,input.format)||!Object.hasOwn(palettes,input.palette))throw Error('INVALID_VECTOR_FORMAT');
 const brand=copy(input.brand,48),headline=copy(input.headline,120),detail=copy(input.detail,150),cta=copy(input.cta,32);
 const [w,h]=formats[input.format], [bg,shade,accent,white,muted]=palettes[input.palette];
 const x=Math.round(w*.095),usable=Math.round(w*.78),r=n=>Math.round(n);
 const title=fit(headline,usable,h*.36,Math.min(104,r(w*.079)),48);
 const desc=fit(detail,usable,h*.125,Math.min(44,r(w*.037)),25);
 const label=fit(brand,usable,h*.08,Math.min(35,r(w*.032)),20);
 const button=fit(cta,usable-w*.07,h*.07,Math.min(36,r(w*.033)),22);
 if(label.lines.length!==1||button.lines.length!==1)throw Error('INVALID_VECTOR_COPY_FIT');
 const group=(lines,size,y,fill,weight)=>`<text x="${x}" y="${r(y)}" fill="${fill}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?r(size*1.18):0}">${esc(line)}</tspan>`).join('')}</text>`;
 const buttonWidth=Math.min(usable,r(units(cta)*button.size+w*.10));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(brand+' — '+headline)}</title><desc>${esc(detail+' — '+cta)}</desc><defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${shade}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#base)"/><circle cx="${r(w*.98)}" cy="${r(h*.16)}" r="${r(w*.34)}" fill="none" stroke="${accent}" stroke-opacity=".16" stroke-width="2"/><circle cx="${r(w*.98)}" cy="${r(h*.16)}" r="${r(w*.27)}" fill="none" stroke="${accent}" stroke-opacity=".10" stroke-width="2"/><rect x="${x}" y="${r(h*.09)}" width="${r(w*.065)}" height="6" rx="3" fill="${accent}"/>${group(label.lines,label.size,h*.165,accent,700)}${group(title.lines,title.size,h*.30,white,700)}${group(desc.lines,desc.size,h*.70,muted,400)}<rect x="${x}" y="${r(h*.82)}" width="${buttonWidth}" height="${r(h*.085)}" rx="${r(h*.018)}" fill="${accent}"/><text x="${x+r(buttonWidth/2)}" y="${r(h*.8625)}" dominant-baseline="central" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${button.size}" fill="${bg}">${esc(cta)}</text><path d="M${x} ${r(h*.95)}H${w-x}" stroke="${accent}" stroke-opacity=".34"/></svg>`;
 return {mime:'image/svg+xml',width:w,height:h,svg,sha256:createHash('sha256').update(svg,'utf8').digest('hex')};
}
module.exports={renderVector};
