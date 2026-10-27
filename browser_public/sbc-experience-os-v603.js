/* SBC V60.3 Experience OS client read-model. Safe: read/optimistic UI only; server remains authoritative. */
(function(){
  const api=(url,opts)=>fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts&&opts.headers||{})},...(opts||{})}).then(r=>r.json());
  window.SBCExperienceOS={
    version:'60.3.0',
    cache:new Map(),
    async snapshot(tenantId){const x=await api('/api/experience/snapshot/'+encodeURIComponent(tenantId));if(x.ok)this.cache.set(tenantId,x.snapshot);return x;},
    async customer360(tenantId){return api('/api/experience/customer-360/'+encodeURIComponent(tenantId));},
    async queue(tenantId,role){return api('/api/experience/work-queue?tenantId='+encodeURIComponent(tenantId)+(role?'&role='+encodeURIComponent(role):''));},
    async kimGovern(spec){return api('/api/experience/kim/govern',{method:'POST',body:JSON.stringify(spec)});},
    getCached(tenantId){return this.cache.get(tenantId)||null}
  };
})();
