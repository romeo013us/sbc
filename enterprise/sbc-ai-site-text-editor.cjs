'use strict';
/**
 * A deliberately narrow, dependency-free editor for visible, leaf text nodes
 * in customer HTML. It never edits HTML attributes, JS, CSS, forms or images.
 * This is not an arbitrary HTML source editor. Ambiguous markup fails closed.
 */
const crypto=require('node:crypto');
const EDIT_TAGS=new Set(['h1','h2','h3','h4','p','li','a','button','span','strong','em','small','label','summary','blockquote']);
const EXCLUDED=new Set(['head','script','style','template','textarea','noscript','svg','math','iframe']);
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const MAX_HTML_BYTES=2*1024*1024;
const MAX_FIELDS=120;
function safelyDecode(t){
 return String(t).replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos|nbsp);/gi,(whole,code)=>{
  const k=code.toLowerCase();
  if(k[0]==='#'){
   const n=k[1]==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);
   return Number.isInteger(n)&&n>0&&n<=0x10ffff&&(n<0xd800||n>0xdfff)?String.fromCodePoint(n):whole;
  }
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k]||whole;
 });
}
function escapeText(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function scan(page,buffer){
 if(!/^[a-z0-9_./-]+\.html?$/i.test(page)||page.split('/').some(p=>p==='..'||p==='.')||
  !Buffer.isBuffer(buffer)||buffer.length>MAX_HTML_BYTES)throw Error('TEXT_EDIT_PAGE_UNSUPPORTED');
 const html=buffer.toString('utf8'),stack=[],out=[];
 let i=0;
 while(i<html.length){
  if(html.startsWith('<!--',i)){
   const end=html.indexOf('-->',i+4);if(end<0)throw Error('TEXT_EDIT_MARKUP_UNSUPPORTED');i=end+3;continue;
  }
  if(html[i]==='<'){
   let j=i+1,quote=null;
   for(;j<html.length;j++){
    const ch=html[j];if(quote){if(ch===quote)quote=null}
    else if(ch==='"'||ch==="'")quote=ch;
    else if(ch==='>')break;
   }
   if(j>=html.length)throw Error('TEXT_EDIT_MARKUP_UNSUPPORTED');
   const tagSource=html.slice(i,j+1),m=/^<\s*(\/?)\s*([a-z][a-z\d:-]*)\b/i.exec(tagSource);
   if(m){
    const tag=m[2].toLowerCase();
    if(m[1]){
     const idx=stack.lastIndexOf(tag);if(idx>=0)stack.splice(idx);
    }else if(!VOID.has(tag)&&!/(?:\/\s*>)$/.test(tagSource)){
     stack.push(tag);
     if(EXCLUDED.has(tag)){
      const endPattern=new RegExp('<\\/\\s*'+tag+'\\s*>','gi');endPattern.lastIndex=j+1;
      const close=endPattern.exec(html);
      if(!close)throw Error('TEXT_EDIT_MARKUP_UNSUPPORTED');
      stack.pop();i=close.index+close[0].length;continue;
     }
    }
   }
   i=j+1;continue;
  }
  const end=html.indexOf('<',i),until=end<0?html.length:end;
  const raw=html.slice(i,until),tag=stack[stack.length-1],trimmed=raw.trim();
  if(EDIT_TAGS.has(tag)&&!stack.some(x=>EXCLUDED.has(x))&&trimmed.length>=2&&trimmed.length<=300&&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)){
   const start=i+raw.indexOf(trimmed),stop=start+trimmed.length;
   const id=crypto.createHash('sha256').update(page+'\0'+start+'\0'+stop+'\0'+trimmed).digest('hex').slice(0,32);
   if(out.length<MAX_FIELDS)out.push({id,page,tag,text:safelyDecode(trimmed),start,stop});
  }
  i=until;
 }
 return {html,fields:out};
}
function listEditableNodes(page,buffer){
 return scan(page,buffer).fields.map(({id,page,tag,text})=>({id,page,tag,text}));
}
function replaceEditableNode(page,buffer,id,replacement){
 if(typeof id!=='string'||!/^[a-f\d]{32}$/.test(id)||typeof replacement!=='string')throw Error('TEXT_EDIT_INVALID_INPUT');
 const text=replacement.trim();
 if(text.length<1||text.length>240||/[\u0000-\u001f\u007f]/.test(text))throw Error('TEXT_EDIT_INVALID_INPUT');
 const {html,fields}=scan(page,buffer),row=fields.find(r=>r.id===id);
 if(!row)throw Error('TEXT_EDIT_STALE_SELECTION');
 const before=html.slice(row.start,row.stop);
 if(safelyDecode(before)===text)throw Error('TEXT_EDIT_NO_CHANGE');
 return Buffer.from(html.slice(0,row.start)+escapeText(text)+html.slice(row.stop),'utf8');
}
module.exports={listEditableNodes,replaceEditableNode};
