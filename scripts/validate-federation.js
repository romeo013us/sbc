'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'infra/graphql/federation.yaml');
const text=fs.readFileSync(file,'utf8');
const failures=[];
if(!/circularReferencePolicy:\s*reject/.test(text))failures.push('Circular-reference rejection policy is not enabled.');
if(!/queryCache:\n[\s\S]*enabled:\s*true/.test(text))failures.push('Federation query caching is not enabled.');
if(!/neverCacheMutations:\s*true/.test(text)||!/neverCacheErrors:\s*true/.test(text))failures.push('Unsafe GraphQL cache exclusions are missing.');
function parseLinks(block){return [...block.matchAll(/^\s*-\s*([\w-]+)\s*->\s*([\w-]+)\s*$/gm)].map(m=>[m[1],m[2]]);}
const prodBlock=(text.split('validationFixtures:')[0]);
const prodLinks=parseLinks(prodBlock);
const graph=new Map();for(const [a,b] of prodLinks){if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b);}
function hasCycle(){const visiting=new Set(),done=new Set();function dfs(n){if(visiting.has(n))return true;if(done.has(n))return false;visiting.add(n);for(const x of graph.get(n)||[])if(dfs(x))return true;visiting.delete(n);done.add(n);return false;}for(const n of graph.keys())if(dfs(n))return true;return false;}
if(hasCycle())failures.push('Production federation entity links contain a circular reference.');
const fixture=text.split('validationFixtures:')[1]||'';
const fixtureLinks=parseLinks(fixture);const pairs=new Set(fixtureLinks.map(([a,b])=>`${a}->${b}`));
const reverseFixture=[...pairs].some(k=>{const [a,b]=k.split('->');return pairs.has(`${b}->${a}`)});
if(!reverseFixture)failures.push('Circular-reference fixture does not exercise a reverse workforce/session edge.');
const result={ok:failures.length===0,productionLinks:prodLinks,fixtureCircularCaseDetected:reverseFixture,failures};
console.log(JSON.stringify(result,null,2));process.exitCode=failures.length?1:0;
