import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Append-only experience journal.
 * Each record commits to the previous record, creating a tamper-evident chain.
 * This is an operational journal, not a substitute for a transactional database.
 */
export class ExperienceMemory {
  constructor(file='data/evolution/kevin-experience-memory.jsonl') {
    this.file=file;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    if(!fs.existsSync(file)) fs.writeFileSync(file,'');
  }

  _lastHash(){
    const raw=fs.readFileSync(this.file,'utf8').trim();
    if(!raw) return 'GENESIS';
    const lines=raw.split('\n');
    try{return JSON.parse(lines[lines.length-1]).hash || 'GENESIS';}catch{return 'GENESIS';}
  }

  append(entry){
    const previousHash=this._lastHash();
    const base={id:crypto.randomUUID(),ts:new Date().toISOString(),previousHash,...entry};
    const hash=crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
    const record={...base,hash};
    fs.appendFileSync(this.file,JSON.stringify(record)+'\n');
    return record;
  }

  async recent(limit=50){
    const raw=fs.readFileSync(this.file,'utf8').trim();
    if(!raw)return[];
    return raw.split('\n').slice(-limit).map(x=>JSON.parse(x));
  }

  verifyChain(){
    const raw=fs.readFileSync(this.file,'utf8').trim();
    if(!raw)return {valid:true,records:0};
    let previous='GENESIS';
    let records=0;
    for(const line of raw.split('\n')){
      const record=JSON.parse(line);
      const {hash,...base}=record;
      if(record.previousHash!==previous)return {valid:false,records,reason:'PREVIOUS_HASH_MISMATCH'};
      const expected=crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
      if(hash!==expected)return {valid:false,records,reason:'HASH_MISMATCH'};
      previous=hash; records++;
    }
    return {valid:true,records,lastHash:previous};
  }
}
