'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6631_MAIN_WIDTH_ZERO_REPAIR';
function apply(root){
 const rels=['public/sbc-v6601-reference-cockpit.css','browser_public/sbc-v6601-reference-cockpit.css'];
 for(const rel of rels){
  const file=path.join(root,rel);
  if(!fs.existsSync(file))throw Error(MARKER+': missing '+rel);
  let css=fs.readFileSync(file,'utf8');
  if(css.includes(MARKER))throw Error(MARKER+': patch already applied in '+rel);
  const re=/#app\.app>\.main\{flex:1 1 0!important;min-width:0!important;width:0!important;max-width:100%!important\}/g;
  const matches=[...css.matchAll(re)];
  if(matches.length!==1)throw Error(MARKER+': expected one width:0!important collapse in '+rel+', found '+matches.length);
  css=css.replace(re,'#app.app>.main{flex:1 1 auto!important;min-width:0!important;width:auto!important;max-width:100%!important}');
  // The fixed rail geometry wins after hydration; this base rule must never set main width to zero.
  css+='\n/* '+MARKER+': main width must not collapse before the navigation rail initializes. */\n';
  const residual=/#app\.app>\.main\{[^}]*width:0!important/g;
  css=css.replace(residual,block=>block.replace(/width:0!important/g,'width:auto!important'));
  if(residual.test(css))throw Error(MARKER+': remaining collapsed main width in '+rel);
  fs.writeFileSync(file,css);
 }
 return {marker:MARKER,changed:rels,liveDataUnchanged:true,previewWrites:false,navRailPreserved:true};
}
module.exports={apply,MARKER};