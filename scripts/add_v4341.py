import re,json,os
root='/mnt/data/work_final'
files=['/mnt/data/Pasted markdown(20260920-170742).md','/mnt/data/Pasted markdown (2)(1).md']
items=[]
for fp in files:
    for ln in open(fp,encoding='utf8').read().splitlines():
        m=re.match(r'\s*(?:\d+\.\s+|-\s+)\*\*(.+?)\*\*\s*:\s*(.*)',ln)
        if m: items.append((m.group(1).strip(),m.group(2).strip(),os.path.basename(fp)))
uniq={}
for name,desc,src in items:
    uniq.setdefault(name,(desc,src))
arch_terms=('Active-Active','Multi-Region','Multi-Node','Cross-Region','Global ','Geographic','Distributed','Edge-Cached','DNS ','Cluster','Load Balancer','Container','External Cache','Read-Replica','Read Replica','WebSocket Proxy','stateless')
provider_terms=('API ','API','Webhook','Vendor','Fulfillment','Supplier','Partner','Provider','Payload','Rate Pacing','Integration','Freight','Print Order')
owner_terms=('Administrator Actions','Owner','Permissions Elevation','System Session Termination','Cryptographic Administrator','Export Authorization','Security Key Rotators')
arr=[]
for i,(name,(desc,src)) in enumerate(uniq.items(),1):
    low=name.lower()
    if any(t.lower() in low for t in arch_terms): mode='architecture-gated'
    elif any(t.lower() in low for t in provider_terms): mode='provider-gated'
    elif any(t.lower() in low for t in owner_terms): mode='owner-gated'
    else: mode='local-safe'
    arr.append({'id':f'kimr-{i:03d}','name':name,'section':'Kim Resilience + Owner Control','description':desc,'mode':mode,'source':src})
out={'version':'43.4.1','source':'user-supplied resilience/control architecture briefs','items':arr}
json.dump(out,open(root+'/data/v4341-kim-resilience-control.json','w'),indent=2,ensure_ascii=False)
print('unique',len(arr))
