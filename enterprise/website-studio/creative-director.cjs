'use strict';
const {verifiedProfile}=require('./contracts.cjs');
const catalog=Object.freeze({
 tint:[{palette:['#0a111b','#182432','#f5fafb','#16a6bb','#e7f7f9','#304350'],mood:'Obsidian and electric'} ,{palette:['#151719','#282a2d','#faf8f5','#d8924e','#fff4e7','#49443c'],mood:'Graphite and copper'}, {palette:['#0d1826','#23334b','#f5f8fb','#85a3cc','#eaf0f7','#43556b'],mood:'Night drive'}],
 automotive:[{palette:['#101821','#202a37','#f5f8fc','#dd6644','#fff0eb','#3d485a'],mood:'Workshop performance'}, {palette:['#0f2728','#214144','#f5fcfa','#52aaa1','#e7f6f2','#3e6467'],mood:'Clean performance'}, {palette:['#1d222a','#35343a','#fffaf0','#c6a15a','#f6efdc','#57525b'],mood:'Precision engineering'}],
 beauty:[{palette:['#fffaf7','#ffffff','#2f232d','#a75c79','#fbe9ef','#efd5df'],mood:'Boutique editorial'},{palette:['#f8f5ef','#ffffff','#2a3029','#799274','#edf3e8','#d2dfcc'],mood:'Quiet botanical'},{palette:['#fdf8f9','#ffffff','#332331','#a06b9b','#f8edf8','#e6d6e4'],mood:'Modern atelier'}],
 dining:[{palette:['#fdf8ef','#ffffff','#29251d','#aa642a','#fcf0df','#e4d7c1'],mood:'Warm culinary'},{palette:['#162525','#263d3b','#f7f9ed','#a5b67d','#e8eddb','#45605b'],mood:'Contemporary dining'},{palette:['#faf5ef','#ffffff','#382621','#af543c','#fce9dd','#e6d5c6'],mood:'Neighborhood kitchen'}],
 trades:[{palette:['#f7fafb','#ffffff','#19333b','#167c88','#e7f5f7','#d2e2e6'],mood:'Clear trustworthy'},{palette:['#f6f7fa','#ffffff','#202f49','#4a70b1','#e8effc','#d5dded'],mood:'Confident precision'},{palette:['#f9faf6','#ffffff','#2d3725','#698849','#edf3e6','#d7e2cd'],mood:'Natural utility'}],
 professional:[{palette:['#f9fafc','#ffffff','#1b2e43','#4b728c','#eaf2f7','#d6e0ea'],mood:'Editorial authority'},{palette:['#fbf7f1','#ffffff','#362d2b','#a17c52','#f5ece0','#e3d8c9'],mood:'Understated premium'},{palette:['#f8f9f7','#ffffff','#263630','#5d8d71','#eaf3ed','#d7e6db'],mood:'Calm expertise'}],
 local:[{palette:['#f7f9fc','#ffffff','#202e45','#4f79b5','#ebf1fb','#d5e2ef'],mood:'Modern neighborhood'}, {palette:['#fbfaf7','#ffffff','#302f27','#9a7751','#f7efe7','#e7ddce'],mood:'Friendly craft'},{palette:['#f8f9fa','#ffffff','#242c35','#6a8093','#e9f1f6','#d6e0e8'],mood:'Minimal studio'}]
});
function vertical(category){const s=String(category||'');return /tint|window film/i.test(s)?'tint':/auto|mechanic|car|truck|vehicle|collision/i.test(s)?'automotive':/salon|beauty|barber|spa|lash|nail|hair/i.test(s)?'beauty':/restaurant|cafe|bistro|food|grill|catering|bakery/i.test(s)?'dining':/roof|plumb|electric|construction|contractor|hvac|landscap|pool|repair|cleaning/i.test(s)?'trades':/law|legal|attorney|insurance|tax|account|finance|notary|consult/i.test(s)?'professional':'local';}
function stableChoice(name){let h=2166136261;for(const ch of name.toLowerCase()){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)%3;}
function createDesignTokens(profile,options={}){
 verifiedProfile(profile);
 const v=vertical(profile.business.category),choice=Number.isInteger(options.themeVariant)&&options.themeVariant>=1&&options.themeVariant<=3?options.themeVariant-1:stableChoice(profile.business.name),direction=catalog[v][choice];
 const [background,surface,ink,accent,soft,border]=direction.palette;
 return Object.freeze({schemaVersion:1,identity:{vertical:v,variant:`${v}-${choice+1}`,mood:direction.mood},palette:{background,surface,ink,accent,soft,border},typography:{display:v==='beauty'||v==='dining'?'Georgia':'system-ui',body:'system-ui'},shape:{radius:v==='tint'||v==='automotive'?'12px':'20px',shadow:v==='tint'?'crisp':'soft'}});
}
module.exports={createDesignTokens,vertical};
