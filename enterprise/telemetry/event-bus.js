export class EventBus {
  constructor(){this.subscribers=new Map();this.history=[];}
  on(type,fn){if(!this.subscribers.has(type))this.subscribers.set(type,new Set());this.subscribers.get(type).add(fn);return()=>this.subscribers.get(type)?.delete(fn);}
  async emit(event){const e={id:event.id||crypto.randomUUID(),ts:event.ts||new Date().toISOString(),type:event.type||'UNKNOWN',source:event.source||'unknown',payload:event.payload??{}};this.history.push(e);for(const fn of this.subscribers.get(e.type)||[])await fn(e);for(const fn of this.subscribers.get('*')||[])await fn(e);return e;}
  snapshot(limit=500){return this.history.slice(-limit);}
}
