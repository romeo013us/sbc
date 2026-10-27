'use strict';
/**
 * SBC V56.25.3 — RESEARCH & WORLD INTELLIGENCE BRAIN
 * 11th brain: external research + evidence synthesis + bounded continuous learning.
 *
 * It may learn from evidence and outcomes, but it may NOT rewrite production code,
 * alter credentials, bypass policy gates, or silently promote uncertain claims to truth.
 */
const VERSION='56.25.3-RESEARCH-SUPERBRAIN';
const MAX_SOURCE_BYTES=2_000_000;
const MAX_TEXT=80_000;
const MAX_RESULTS=12;
const DEFAULT_TIMEOUT_MS=12_000;
const ADAPTERS=['wikipedia','crossref','arxiv','sec','url'];
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function tokens(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2);}
function score(query,text){const q=[...new Set(tokens(query))];const h=String(text||'').toLowerCase();return q.reduce((n,t)=>n+(h.includes(t)?1:0),0);}
function stripHtml(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,MAX_TEXT);}
async function assertSafeUrl(raw,{resolve=true}={}){
  const dns=require('dns').promises, net=require('net');
  const u=new URL(String(raw));
  if(!['http:','https:'].includes(u.protocol)) throw new Error('Only HTTP(S) research sources are allowed.');
  const host=u.hostname.toLowerCase();
  const blocked=(ip)=>{const v=String(ip||'');if(net.isIP(v)===4)return /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|7\d|[89]\d|9\d|1[01]\d|12[0-7])\.)/.test(v);if(net.isIP(v)===6)return v==='::1'||/^f[cd]/i.test(v)||/^fe8[0-9a-f]:/i.test(v);return false;};
  if(host==='localhost'||host.endsWith('.localhost')||host==='0.0.0.0'||blocked(host)) throw new Error('Private/local research targets are blocked.');
  if(resolve){const addrs=await dns.lookup(host,{all:true});for(const a of addrs)if(blocked(a.address))throw new Error('Research target resolves to a private/local address.');}
  return u;
}
async function fetchText(url,{timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  let current=await assertSafeUrl(url); const ac=new AbortController(); const timer=setTimeout(()=>ac.abort(),timeoutMs);
  try{for(let hop=0;hop<4;hop++){
    const r=await fetch(current,{signal:ac.signal,redirect:'manual',headers:{'user-agent':'SBC-Research-Brain/1.1 (+https://sbcmia.com)','accept':'text/html,application/json,text/plain;q=0.9,*/*;q=0.1'}});
    if(r.status>=300&&r.status<400){const loc=r.headers.get('location');if(!loc)throw new Error('Research redirect missing location.');current=await assertSafeUrl(new URL(loc,current).toString());continue;}
    if(!r.ok)throw new Error(`Research source HTTP ${r.status}`);
    const len=Number(r.headers.get('content-length')||0);if(len>MAX_SOURCE_BYTES)throw new Error('Research source is too large.');
    const reader=r.body?.getReader();let bytes=0,chunks=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_SOURCE_BYTES)throw new Error('Research source exceeded size limit.');chunks.push(Buffer.from(value));}}else chunks=[Buffer.from(await r.arrayBuffer())];
    const body=Buffer.concat(chunks).toString('utf8');return {url:current.toString(),contentType:String(r.headers.get('content-type')||''),text:/json/i.test(String(r.headers.get('content-type')||''))?body:stripHtml(body)};
  }throw new Error('Too many research redirects.');}finally{clearTimeout(timer);}
}
async function wikipedia(query){
  const url=`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=${MAX_RESULTS}`;
  const out=await fetchText(url);const data=JSON.parse(out.text);return (data?.query?.search||[]).map(x=>({title:clean(x.title,300),summary:clean(stripHtml(x.snippet),1200),source:'Wikipedia',url:`https://en.wikipedia.org/wiki/${encodeURIComponent(String(x.title).replace(/ /g,'_'))}`,adapter:'wikipedia'}));
}
async function crossref(query){
  const out=await fetchText(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${MAX_RESULTS}`);const data=JSON.parse(out.text);return (data?.message?.items||[]).map(x=>({title:clean((x.title||[])[0],500),summary:clean((x.abstract||'').replace(/<[^>]+>/g,' '),1600),source:'Crossref',url:String(x.URL||''),published:x.published?.['date-parts']?.[0]?.join('-')||'',adapter:'crossref'}));
}
async function arxiv(query){
  const out=await fetchText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${MAX_RESULTS}`);const xml=out.text;const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>m[1]);return entries.map(e=>({title:clean((e.match(/<title>([\s\S]*?)<\/title>/)||[])[1],500),summary:clean((e.match(/<summary>([\s\S]*?)<\/summary>/)||[])[1],1800),source:'arXiv',url:String((e.match(/<id>([\s\S]*?)<\/id>/)||[])[1]||''),published:String((e.match(/<published>([\s\S]*?)<\/published>/)||[])[1]||''),adapter:'arxiv'}));
}
async function sec(query){
  const q=encodeURIComponent(query);const out=await fetchText(`https://efts.sec.gov/LATEST/search-index?q=${q}&from=0&size=${MAX_RESULTS}`);const data=JSON.parse(out.text);return (data?.hits?.hits||[]).map(x=>({title:clean(x._source?.display_names||x._source?.form||'SEC filing',500),summary:clean(x._source?.root_forms||x._source?.file_num||x._source?.entity_name||JSON.stringify(x._source||{}),1600),source:'U.S. SEC',url:String(x._source?.file_num?`https://www.sec.gov/Archives/${x._id||''}`:'https://www.sec.gov/'),published:String(x._source?.file_date||''),adapter:'sec'}));
}
function rank(rows,query){return rows.map(r=>{const termScore=score(query,[r.title,r.summary,r.source].join(' '));const provenance=r.adapter==='url'?.55:1;const hasUrl=Boolean(r.url);const relevance=Math.min(10,termScore)*provenance+(hasUrl?.5:0);return {...r,relevance:Number(relevance.toFixed(3)),evidenceQuality:r.adapter==='url'?'UNVERIFIED_EXTERNAL':'PUBLIC_SOURCE'};}).sort((a,b)=>b.relevance-a.relevance).slice(0,MAX_RESULTS);}
function create({mysqlPool=null,logger=console}={}){
  async function ensureTables(){
    if(!mysqlPool)return false;
    await mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_research_sources (id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id BIGINT NOT NULL,source_type VARCHAR(40) NOT NULL,source_name VARCHAR(180) NOT NULL,url TEXT NOT NULL,query_text TEXT,content_hash CHAR(64) NOT NULL,content_excerpt LONGTEXT,relevance_score DECIMAL(6,4) NOT NULL DEFAULT 0.5,verified TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_research_source_hash(tenant_id,content_hash),INDEX idx_research_tenant_time(tenant_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_research_claims (id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id BIGINT NOT NULL,topic VARCHAR(255) NOT NULL,claim_text TEXT NOT NULL,evidence_ids_json LONGTEXT NOT NULL,relevance_score DECIMAL(6,4) NOT NULL DEFAULT 0.5,status VARCHAR(30) NOT NULL DEFAULT 'CANDIDATE',source_count INT NOT NULL DEFAULT 0,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_research_claim_topic(tenant_id,topic),INDEX idx_research_claim_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_research_learning (id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id BIGINT NOT NULL,learning_type VARCHAR(80) NOT NULL,subject_key VARCHAR(255) NOT NULL,observation_json LONGTEXT NOT NULL,outcome VARCHAR(80) NOT NULL,confidence_delta DECIMAL(8,5) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL,INDEX idx_research_learning_subject(tenant_id,subject_key,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }
  async function saveSource({tenantId,row,confidence=.5}={}){
    if(!mysqlPool)return null;const crypto=require('crypto');const hash=crypto.createHash('sha256').update(`${row.url}|${row.title}|${row.summary}`).digest('hex');
    await mysqlPool.query(`INSERT INTO sbc_research_sources(tenant_id,source_type,source_name,url,query_text,content_hash,content_excerpt,relevance_score,verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at),relevance_score=GREATEST(relevance_score,VALUES(relevance_score))`,[tenantId,'PUBLIC',row.source,row.url,row.query||'',hash,clean(row.summary,12000),confidence,0,new Date(),new Date()]);
    return hash;
  }
  async function research({query,tenantId,sources=['wikipedia','crossref','arxiv','sec'],urls=[]}={}){
    query=clean(query,1200);if(!query)throw new Error('Research query is required.');
    const rows=[];const errors=[];
    for(const adapter of [...new Set(sources)].slice(0,ADAPTERS.length)){
      try{let out=[];if(adapter==='wikipedia')out=await wikipedia(query);else if(adapter==='crossref')out=await crossref(query);else if(adapter==='arxiv')out=await arxiv(query);else if(adapter==='sec')out=await sec(query);rows.push(...out.map(x=>({...x,query})));}catch(e){errors.push({adapter,error:clean(e.message,240)});}
    }
    for(const raw of (Array.isArray(urls)?urls:[]).slice(0,5)){try{const out=await fetchText(raw);rows.push({title:raw,summary:out.text,source:new URL(raw).hostname,url:out.url,adapter:'url',query});}catch(e){errors.push({adapter:'url',url:clean(raw,300),error:clean(e.message,240)});}}
    const ranked=rank(rows,query);const weights=await learningWeights({tenantId,topic:query});for(const row of ranked){row.learningAdjustment=Number(weights.get(row.source)||0);row.relevance=Math.max(0,row.relevance+row.learningAdjustment*10);}ranked.sort((a,b)=>b.relevance-a.relevance);for(const row of ranked){try{await saveSource({tenantId,row,confidence:Math.min(.95,.35+Math.min(.5,row.relevance/10))});}catch(e){}}
    const synthesis={topic:query,claims:ranked.slice(0,8).map(r=>({claim:r.summary||r.title,evidence:[r.url],relevance:Number(Math.min(1,.1+r.relevance*.1).toFixed(2)),evidenceQuality:(r.adapter==='url'?'UNVERIFIED_EXTERNAL':'PUBLIC_SOURCE'),source:r.source})),limitations:errors,rule:'Research evidence is provisional until corroborated or explicitly verified.'};
    if(mysqlPool){try{await mysqlPool.query(`INSERT INTO sbc_research_claims(tenant_id,topic,claim_text,evidence_ids_json,relevance_score,status,source_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,[tenantId,query,JSON.stringify(synthesis.claims[0]?.claim||'No strong claim found.'),JSON.stringify(synthesis.claims.slice(0,8).map(x=>x.evidence).flat()),synthesis.claims[0]?.relevance||.1,'CANDIDATE',ranked.length,new Date(),new Date()]);}catch(e){logger.warn('[RESEARCH BRAIN] claim save:',e.message);}}
    return {ok:true,version:VERSION,query,results:ranked,evidenceCount:ranked.length,synthesis,errors};
  }
  async function learn({tenantId,learningType='OUTCOME',subjectKey,observation,outcome,confidenceDelta=0}={}){
    if(!subjectKey||!outcome)throw new Error('subjectKey and outcome are required.');
    const delta=Math.max(-.25,Math.min(.25,num(confidenceDelta)));
    if(mysqlPool)await mysqlPool.query(`INSERT INTO sbc_research_learning(tenant_id,learning_type,subject_key,observation_json,outcome,confidence_delta,created_at) VALUES(?,?,?,?,?,?,?)`,[tenantId,clean(learningType,80),clean(subjectKey,255),JSON.stringify(observation||{}),clean(outcome,80),delta,new Date()]);
    return {ok:true,version:VERSION,learned:true,subjectKey,outcome,confidenceDelta:delta,rule:'Learning updates evidence weights; it does not rewrite executable production code.'};
  }
  async function learningWeights({tenantId,topic}){if(!mysqlPool)return new Map(); if(!Number.isInteger(Number(tenantId))||Number(tenantId)<=0)throw new Error('TENANT_CONTEXT_REQUIRED');const [rows]=await mysqlPool.query('SELECT subject_key,AVG(confidence_delta) d,COUNT(*) n FROM sbc_research_learning WHERE tenant_id=? AND subject_key LIKE ? GROUP BY subject_key ORDER BY n DESC LIMIT 100',[tenantId,`%${clean(topic,120)}%`]);return new Map(rows.map(r=>[String(r.subject_key),Number(r.d||0)]));}
  async function memory({tenantId,topic='' }={}){
    if(!Number.isInteger(Number(tenantId))||Number(tenantId)<=0)throw new Error('TENANT_CONTEXT_REQUIRED');
    if(!mysqlPool)return {ok:false,reason:'MySQL unavailable.'};const like=`%${clean(topic,120)}%`;
    const [claims]=await mysqlPool.query('SELECT id,topic,claim_text,relevance_score,status,source_count,created_at FROM sbc_research_claims WHERE tenant_id=? AND topic LIKE ? ORDER BY updated_at DESC LIMIT 50',[tenantId,like]);
    const [learning]=await mysqlPool.query('SELECT learning_type,subject_key,outcome,confidence_delta,created_at FROM sbc_research_learning WHERE tenant_id=? AND subject_key LIKE ? ORDER BY created_at DESC LIMIT 100',[tenantId,like]);
    return {ok:true,version:VERSION,claims,learning};
  }
  return {version:VERSION,adapters:ADAPTERS,ensureTables,research,learn,memory,snapshot:()=>({version:VERSION,brain:'RESEARCH_WORLD_INTELLIGENCE',adapters:ADAPTERS,capabilities:['external research','source provenance','evidence synthesis','outcome learning','continuous knowledge accumulation','public-world knowledge separated from tenant-private data'],safety:['no self-modifying production code; learned weights only influence research ranking','no credential changes','no policy bypass','private customer data remains separate']})};
}
module.exports={VERSION,ADAPTERS,create,stripHtml,assertSafeUrl};
