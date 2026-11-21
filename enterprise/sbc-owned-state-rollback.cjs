'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Reverse only fields this operation changed. Preserve unrelated rows and values
// that another writer changed while the durable save was pending.
function undo(before,after,current){
 if(equal(before,after))return current;
 if(equal(current,after))return before===undefined?undefined:clone(before);
 if([before,after,current].every(v=>typeof v==='string'&&v.trim().startsWith('{'))){
  try{return JSON.stringify(undo(JSON.parse(before),JSON.parse(after),JSON.parse(current)))}catch{return current}
 }
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)){
  const key=r=>r&&typeof r==='object'?String(r.id||r.key||''):'';
  if(![...before,...after,...current].every(r=>key(r)))return current;
  const bm=new Map(before.map(r=>[key(r),r])),am=new Map(after.map(r=>[key(r),r]));
  const out=current.map(r=>undo(bm.get(key(r)),am.get(key(r)),r)).filter(r=>r!==undefined);
  for(const r of before)if(!am.has(key(r))&&!out.some(x=>key(x)===key(r)))out.push(clone(r));return out;
 }
 if(before&&after&&current&&typeof before==='object'&&typeof after==='object'&&typeof current==='object'&&!Array.isArray(before)&&!Array.isArray(after)&&!Array.isArray(current)){
  const out={...current};for(const k of new Set([...Object.keys(before),...Object.keys(after)])){const value=undo(before[k],after[k],current[k]);if(value===undefined)delete out[k];else out[k]=value}return out;
 }return current;
}
module.exports={undo};
