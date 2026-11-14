'use strict';
/* Explicitly attach the research handoff panel to existing Lorna workspace.
 * DO NOT use on published writer before reviewed role-gate rollout.
 */
const fs=require('node:fs'),path=require('node:path');
const MARKER='sbc-lorna-handoff-v1.js';
const sourceAnchor=/<script src="\/lead-research\.js\?v=\d+" defer><\/script>/g;
const cssAnchor='</head>';
function patch(source){
 if(source.includes(MARKER))return {changed:false,source};
 const hits=[...source.matchAll(sourceAnchor)];
 if(hits.length!==1||source.split(cssAnchor).length!==2)throw Error('LORNA_WORKSTATION_ANCHOR_MISSING_OR_AMBIGUOUS');
 const inserted=source.replace(hits[0][0],`<script src="/${MARKER}" defer></script>\n`+hits[0][0]);
 return {changed:true,source:inserted.replace(cssAnchor,'<link rel="stylesheet" href="/sbc-lorna-handoff-v1.css">\n'+cssAnchor)};
}
function stage(root){const paths=['public/lead-research.html','browser_public/lead-research.html'],files=paths.map(rel=>path.join(root,rel));
 const sources=files.map(file=>{if(!fs.existsSync(file))throw Error('LORNA_WORKSPACE_MISSING: '+file);return fs.readFileSync(file,'utf8')});
 if(sources[0]!==sources[1])throw Error('LORNA_WORKSPACE_MIRROR_MISMATCH');
 const transformed=patch(sources[0]);if(transformed.changed)files.forEach(file=>fs.writeFileSync(file,transformed.source));
 return {changed:transformed.changed,mirrorsPreserved:true};}
if(require.main===module)console.log('LORNA HANDOFF OPTIONAL STAGE:',stage(path.resolve(__dirname,'..')));
module.exports={patch,stage,MARKER};
