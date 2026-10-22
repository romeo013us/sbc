'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6574_DRAGGABLE_NAV_RAIL';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function apply(root){
 const htmlPath=path.join(root,'public/index.html');
 const cssSource=path.join(__dirname,'v6574-draggable-nav-rail.css');
 const jsSource=path.join(__dirname,'v6574-draggable-nav-rail.js');
 if(!fs.existsSync(htmlPath)||!fs.existsSync(cssSource)||!fs.existsSync(jsSource))throw new Error(MARKER+': expected public/index.html and both navigation assets');
 let html=fs.readFileSync(htmlPath,'utf8');
 if(html.includes(MARKER)||html.includes('/sbc-v6574-draggable-nav-rail.css'))throw new Error(MARKER+': patch already applied');
 html=once(html,'</head>','<link rel="stylesheet" href="/sbc-v6574-draggable-nav-rail.css?v=65.1.72-nav-rail">\n</head>','CSS insertion');
 html=once(html,'</body>','<script src="/sbc-v6574-draggable-nav-rail.js?v=65.1.72-nav-rail" defer></script>\n<!-- '+MARKER+' -->\n</body>','script insertion');
 fs.writeFileSync(htmlPath,html);
 fs.copyFileSync(cssSource,path.join(root,'public/sbc-v6574-draggable-nav-rail.css'));
 fs.copyFileSync(jsSource,path.join(root,'public/sbc-v6574-draggable-nav-rail.js'));
 return {marker:MARKER,changed:['public/index.html','public/sbc-v6574-draggable-nav-rail.css','public/sbc-v6574-draggable-nav-rail.js'],crmWrites:false,serverChanges:false};
}
module.exports={apply,MARKER};
