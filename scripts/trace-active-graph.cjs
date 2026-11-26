'use strict';
// Advisory inventory only: no file moves, deletions or runtime imports.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),acorn=require('acorn');
const js=/\.(?:js|cjs|mjs)$/i, candidate=p=>/^(?:enterprise|hotfix-assets)\//.test(p)&&js.test(p);
const slash=p=>p.split(path.sep).join('/');
function trace(root,files){
 root=path.resolve(root);files=[...new Set(files)].sort();const known=new Set(files),candidates=files.filter(candidate),edges=new Map(),roots=new Set(),blockers=[],basename=new Map();
 for(const file of candidates){const b=path.basename(file);if(!basename.has(b))basename.set(b,[]);basename.get(b).push(file);}
 function edge(from,to){if(!edges.has(from))edges.set(from,new Set());edges.get(from).add(to);}
 function report(file,kind,line){blockers.push({file,kind,line:line||0});}
 function reference(file,node){const spec=node?.type==='Literal'&&typeof node.value==='string'?node.value:node?.type==='TemplateLiteral'&&node.expressions.length===0?node.quasis[0].value.cooked:null;
  if(spec===null){report(file,'dynamic',node?.loc?.start.line);return;}
  if(!spec.startsWith('.')){if(spec.startsWith('/')||spec.startsWith('#')||spec.startsWith('file:'))report(file,'nonrelative-local',node.loc?.start.line);return;}
  try{const resolved=createRequire(path.join(root,file)).resolve(spec),rel=slash(path.relative(root,resolved));if(!known.has(rel)){report(file,'unresolved',node.loc?.start.line);return;}edge(file,rel);}catch{report(file,'unresolved',node.loc?.start.line);}
 }
 function walk(file,node){if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration','ImportExpression'].includes(node.type)&&node.source)reference(file,node.source);
  if(node.type==='CallExpression'){const c=node.callee;if(c?.name==='require'||(c?.type==='MemberExpression'&&((c.object?.name==='require'&&c.property?.name==='resolve')||(c.object?.name==='module'&&c.property?.name==='require'))))reference(file,node.arguments[0]);}
  for(const [k,v] of Object.entries(node)){if(k==='loc')continue;if(Array.isArray(v))for(const x of v)walk(file,x);else if(v&&typeof v==='object'&&v.type)walk(file,v);}
 }
 for(const file of files){if(path.isAbsolute(file)||file.split('/').includes('..'))throw Error('INVALID_TRACKED_PATH');const abs=path.join(root,file);let stat;try{stat=fs.lstatSync(abs);}catch{report(file,'missing');continue;}if(!stat.isFile()){report(file,'nonregular');continue;}
  if(!js.test(file)&&!(/\.(?:json|ya?ml|md|txt|html|sh|py|ps1|sql|toml|conf)$/i.test(file)))continue;
  if(stat.size>8*1024*1024){report(file,'oversize');continue;}const code=fs.readFileSync(abs,'utf8');if(!candidate(file))roots.add(file);
  // Preserve references in build scripts, manifests, HTML, comments and string paths too.
  for(const m of code.matchAll(/[A-Za-z0-9_.$-]+\.(?:js|cjs|mjs)\b/g))for(const to of basename.get(m[0])||[])if(to!==file)edge(file,to);
  if(js.test(file)){let ast;for(const sourceType of ['module','script']){try{ast=acorn.parse(code,{ecmaVersion:'latest',sourceType,locations:true,allowHashBang:true});break;}catch{}}if(!ast){report(file,'parse');continue;}walk(file,ast);}
 }
 const reachable=new Set(),stack=[...roots];while(stack.length){const f=stack.pop();if(reachable.has(f))continue;reachable.add(f);for(const to of edges.get(f)||[])stack.push(to);}
 const incoming=new Set([...edges.values()].flatMap(s=>[...s]));
 return {schema:1,trackedFiles:files.length,rootCount:roots.size,reachableCount:reachable.size,candidateCount:candidates.length,reachableCandidates:candidates.filter(f=>reachable.has(f)),unreachableReferenced:candidates.filter(f=>!reachable.has(f)&&incoming.has(f)),reviewCandidates:candidates.filter(f=>!reachable.has(f)&&!incoming.has(f)),blockers,deletionAuthorized:false};
}
if(require.main===module){try{const root=path.resolve(__dirname,'..'),files=execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean);console.log(JSON.stringify(trace(root,files),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={trace};
