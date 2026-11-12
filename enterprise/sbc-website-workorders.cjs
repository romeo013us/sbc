'use strict';
// Role-bound, financial-evidence-gated website work orders. The caller/route
// must separately verify captured Square payment before invoking start().
const { randomUUID }=require('node:crypto');
const TASKS=Object.freeze([
 {key:'intake',name:'Client intake & requirements',team:'ACCOUNT'},
 {key:'content',name:'Business content & brand assets',team:'CONTENT'},
 {key:'build',name:'Complete website, forms & integrations',team:'WEB_DEVELOPMENT'},
 {key:'qa',name:'Technical QA, accessibility & mobile checks',team:'QUALITY_ASSURANCE'},
 {key:'publish',name:'Owner launch, domain verification & handoff',team:'OWNER'}
]);
const int=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0};
const tid=x=>int(x?.tenantId??x?.tenant_id);
function sameTenant(a,b){return tid(a)>0&&tid(a)===tid(b);}
function needOwner(actor,entity){
 if(String(actor?.role)!=='owner'||!sameTenant(actor,entity)||actor.active===false)throw Error('OWNER_REQUIRED');
}
function start({order,site,actor,clock=new Date().toISOString()}={}){
 needOwner(actor,order);
 if(!sameTenant(order,site))throw Error('TENANT_CONTEXT_REQUIRED');
 if(String(order?.customerId||'')!==String(site?.customerId||''))throw Error('CUSTOMER_MISMATCH');
 if(site?.status!=='Approved'||site?.archived===true)throw Error('WEBSITE_NOT_APPROVED');
 return {id:'webprod_'+randomUUID(),tenantId:tid(order),orderId:String(order.id),
   customerId:String(order.customerId),websiteId:String(site.id),offerTier:site.offerTier==='starter'?'starter':'essentials',
   status:'IN_PRODUCTION',publicUrl:'',createdAt:String(clock),updatedAt:String(clock),
   tasks:TASKS.map((task,index)=>({...task,status:index===0?'READY':'BLOCKED',assignedTo:'',completedBy:'',completedAt:''})),
   contractorRequests:[]};
}
function copy(x){return structuredClone(x)}
function findTask(x,key){const index=x.tasks.findIndex(t=>t.key===String(key));if(index<0)throw Error('UNKNOWN_TASK');return index}
function assign(work,key,worker,actor){
 needOwner(actor,work);
 if(!sameTenant(worker,work)||worker?.active===false||!['fulfillment','owner','manager'].includes(String(worker.role||'')))throw Error('ASSIGNEE_INVALID');
 const i=findTask(work,key);
 if(work.tasks[i].status==='COMPLETED')throw Error('TASK_ALREADY_COMPLETED');
 if(key==='publish'&&worker.role!=='owner')throw Error('LAUNCH_OWNER_REQUIRED');
 const x=copy(work);x.tasks[i].assignedTo=String(worker.id);x.updatedAt=new Date().toISOString();return x;
}
function complete(work,key,actor,details={}){
 const i=findTask(work,key);
 if(!sameTenant(actor,work)||actor?.active===false)throw Error('TENANT_CONTEXT_REQUIRED');
 const step=work.tasks[i];
 if(i>0&&work.tasks.slice(0,i).some(t=>t.status!=='COMPLETED'))throw Error('PREREQUISITES_NOT_COMPLETE');
 if(step.status==='COMPLETED')throw Error('TASK_ALREADY_COMPLETED');
 if(key==='publish')needOwner(actor,work);
 else if(actor.role!=='owner'&&(actor.role!=='fulfillment'&&actor.role!=='manager'||String(step.assignedTo||'')!==String(actor.id)))throw Error('NOT_ASSIGNED');
 let url='';
 if(key==='publish'){
   try{const link=new URL(String(details.url||''));if(!['https:'].includes(link.protocol)||link.username||link.password||!link.hostname)throw Error('bad');url=link.href;}catch{throw Error('PUBLISHED_URL_REQUIRED')}
 }
 const x=copy(work);x.tasks[i].status='COMPLETED';x.tasks[i].completedBy=String(actor.id);x.tasks[i].completedAt=new Date().toISOString();
 if(i+1<x.tasks.length)x.tasks[i+1].status='READY';
 if(key==='qa')x.status='READY_FOR_OWNER_LAUNCH';
 if(key==='publish'){x.status='PUBLISHED';x.publicUrl=url;}
 x.updatedAt=new Date().toISOString();return x;
}
function proposeContractor(work,request,actor){
 needOwner(actor,work);
 const source=String(request?.source||'').toLowerCase();
 if(source!=='contra')throw Error('CONTRACTOR_SOURCE_INVALID');
 let href;
 try{const u=new URL(String(request?.profileUrl||''));if(u.protocol!=='https:'||u.hostname!=='contra.com'||u.username||u.password)throw Error('invalid');href=u.href;}catch{throw Error('CONTRACTOR_URL_INVALID')}
 const cents=Number(request?.estimatedCents);
 if(!Number.isSafeInteger(cents)||cents<1||cents>1000000)throw Error('CONTRACTOR_BUDGET_INVALID');
 const task=String(request?.task||'build');
 if(!TASKS.some(x=>x.key===task)||task==='publish')throw Error('CONTRACTOR_TASK_INVALID');
 const x=copy(work);x.contractorRequests.push({id:randomUUID(),source,task,profileUrl:href,estimatedCents:cents,status:'OWNER_REVIEW_REQUIRED',paid:false,createdAt:new Date().toISOString()});x.updatedAt=new Date().toISOString();return x;
}
module.exports={TASKS,start,assign,complete,proposeContractor,sameTenant};
