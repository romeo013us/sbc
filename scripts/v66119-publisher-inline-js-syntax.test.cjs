'use strict';
/* SBC V66.119: parse EVERY GitHub release publisher inline Node.js heredoc
 * before merge. A prior malformed assert expression survived staged artifact CI
 * because publisher job only runs after merge on master.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
const job=source.slice(source.indexOf('github-preview-branch:'));
assert(job.length>3000,'publishing job missing');
const lines=job.split('\n'),snippets=[];
for(let i=0;i<lines.length;i++){
 if(!/\bnode\s+[^\n]*<<'NODE'\s*$/.test(lines[i]))continue;
 const start=i;let j=i+1;
 while(j<lines.length&&lines[j].trim()!=='NODE')j++;
 assert(j<lines.length,'unclosed publisher inline Node heredoc at line '+start);
 const original=lines.slice(i+1,j);
 // Bash YAML block body is indented to the same document margin as the shell
 // statements, but quoted JS strings and multiline statements must be retained.
 const nonEmpty=original.filter(x=>x.trim());
 assert(nonEmpty.length>0,'empty publisher script at line '+start);
 const indent=Math.min(...nonEmpty.map(x=>(x.match(/^\s*/)||[''])[0].length));
 const js=original.map(x=>x.slice(Math.min(indent,x.length))).join('\n');
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'publisher-heredoc-'+start+'.cjs'}),
    'publisher has malformed JS in heredoc starting at line '+start);
 snippets.push(js);
 i=j;
}
assert(snippets.length>=3,'expected inline publisher code for source, candidate and rerun integrity');
assert(snippets.some(x=>x.includes("paths.length>=3")&&x.includes("['SBC-DEPLOY-RECEIPT.json','SBC-FLAT-RELEASE-IDENTITY.json','SBC-STAGED-INVENTORY.json'")&&x.includes(".every(p=>paths.includes(p))")),
  'missing valid list-based publisher asset allowlist');
console.log('[SBC V66.119] PASS: '+snippets.length+' publisher inline JS heredocs parsed; no invalid release-master JavaScript');
