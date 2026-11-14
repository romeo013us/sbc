'use strict';
// Static *preflight* only. Browser, accessibility, security, Lighthouse, hosting,
// form and consent checks must pass separately before any real publication.
function checkPrivateBundle(bundle){
 const issues=[],checks=[];
 const files=bundle?.files||{};
 const required=['index.html','styles.css','site.js','design-tokens.json','layout-ast.json'];
 const record=(label,good,code)=>{checks.push({label,passed:!!good});if(!good)issues.push(code)};
 record('Required private build artifacts',required.every(name=>typeof files[name]==='string'&&files[name].length>0),'MISSING_STATIC_FILE');
 const html=String(files['index.html']||''),css=String(files['styles.css']||'');
 record('Private indexing disabled',/<meta\s+name="robots"\s+content="noindex,nofollow,noarchive"\s*\/?>/.test(html),'PRIVATE_INDEXING_UNSAFE');
 record('Responsive layout stylesheet',/<meta\s+name="viewport"/.test(html)&&/@media\s*\(max-width\s*:\s*\d+px\)/.test(css),'RESPONSIVE_CONTRACT_MISSING');
 record('Local CSS and JS only',/href="styles\.css"/.test(html)&&/src="site\.js"/.test(html)&&!/<script[^>]+src="https?:/i.test(html)&&!/@import\s+url\(\s*['"]?https?:/i.test(css),'REMOTE_OR_MISSING_ASSET');
 record('Never claim publication readiness',bundle?.publicationReady===false,'PUBLICATION_GUARD_FAILED');
 const ids=[...html.matchAll(/\bid="([a-zA-Z0-9_-]+)"/g)].map(x=>x[1]);
 const anchors=[...html.matchAll(/\bhref="#([a-zA-Z0-9_-]+)"/g)].map(x=>x[1]);
 record('No broken internal anchors',anchors.every(x=>ids.includes(x))&&new Set(ids).size===ids.length,'BROKEN_ANCHOR_OR_DUPLICATE_ID');
 record('Preview cannot submit to the network',!/<form[^>]+action\s*=/i.test(html)&&!/<script[^>]+src="https?:/i.test(html),'UNSAFE_FORM_OR_SCRIPT');
 return {passed:issues.length===0,publicationReady:false,checks,issues};
}
module.exports={checkPrivateBundle};
