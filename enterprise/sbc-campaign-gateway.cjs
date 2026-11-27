'use strict';
const {CHANNELS}=require('./sbc-marketing-readback.cjs');
const failure=(code,status)=>Object.assign(Error(code),{code,status});
function createGateway({authorize,secret,request=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 async function call(url,headers,body){
   const response=await request(url,{method:body?'POST':'GET',headers,body,redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw failure('PROVIDER_HTTP_'+response.status,response.status);
   return {data:await response.json().catch(()=>({})),headers:response.headers};
 }
 async function connect(platform){
   if(platform==='linkedin'){
     const [token,version,org]=await Promise.all(['LINKEDIN_ACCESS_TOKEN','LINKEDIN_API_VERSION','LINKEDIN_ORGANIZATION_ID'].map(secret));
     if(!token||!/^20\d{2}(0[1-9]|1[0-2])$/.test(version)||org!==CHANNELS.linkedin.account)throw failure('LINKEDIN_CONFIGURATION_REQUIRED');
     const headers={Authorization:'Bearer '+token,'LinkedIn-Version':version,'X-Restli-Protocol-Version':'2.0.0','Content-Type':'application/json'};
     const {data}=await call('https://api.linkedin.com/rest/organizations/'+org,headers);
     if(String(data.id)!==org)throw failure('ACCOUNT_MISMATCH');
     return {platform,org,headers};
   }
   const p=await authorize(platform);
   const id=platform==='google'?'locations/'+p.locationId:platform==='instagram'?p.igId:p.pageId;
   if(!p.verified||String(id)!==CHANNELS[platform]?.account)throw failure('ACCOUNT_MISMATCH');
   return {...p,headers:{Authorization:'Bearer '+(p.pageToken||p.accessToken)}};
 }
 async function prepare(s,p){
   // Optional artwork can fail independently of the public feed submission.
   if(s.platform==='facebook' || s.platform==='google'){
     if(s.attempts>0)return null;
     const suffix=s.platform==='facebook'?'facebook_linkedin':'google_business';
     const image=s.image.replace('instagram_feed',suffix);
     try{
       if(s.platform==='facebook'){
         const r=await call(p.graphBase+'/'+p.pageId+'/photos',p.headers,new URLSearchParams({url:image,published:'false'}));
         return /^\d+$/.test(r.data.id)?r.data.id:null;
       }
       const r=await request(image,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(4000)});
       return r.ok&&r.headers.get('content-type')?.includes('image/jpeg')?image:null;
     }catch{return null;}
   }
   if(s.platform!=='instagram')return null;
   const {data}=await call(p.graphBase+'/'+p.igId+'/media',p.headers,new URLSearchParams({image_url:s.image,caption:s.body+'\n\n'+(s.link||s.url)}));
   if(!/^\d+$/.test(data.id))throw failure('INVALID_CONTAINER');
   for(let i=0;i<6;i++){
     const r=await call(p.graphBase+'/'+data.id+'?fields=status_code',p.headers);
     if(r.data.status_code==='FINISHED')return data.id;
     if(r.data.status_code==='ERROR')throw failure('MEDIA_PROCESSING_FAILED');
     if(i<5)await delay(1200);
   }
   throw failure('MEDIA_PROCESSING_PENDING');
 }
 async function publish(s,p,container){
   const text=s.body+'\n\n'+(s.link||s.url);
   let id;
   if(s.platform==='facebook'){
     const body=new URLSearchParams({message:text});
     if(container)body.set('attached_media[0]',JSON.stringify({media_fbid:container}));
     const r=await call(p.graphBase+'/'+p.pageId+'/feed',p.headers,body);
     id=r.data.id;
   }else if(s.platform==='instagram'){
     const r=await call(p.graphBase+'/'+p.igId+'/media_publish',p.headers,new URLSearchParams({creation_id:container}));
     id=r.data.id;
   }else if(s.platform==='linkedin'){
     const r=await call('https://api.linkedin.com/rest/posts',p.headers,JSON.stringify({author:'urn:li:organization:'+p.org,commentary:text,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false}));
     id=r.headers.get('x-restli-id');
   }else if(s.platform==='google'){
     const r=await call('https://mybusiness.googleapis.com/v4/'+p.parent+'/localPosts',{...p.headers,'Content-Type':'application/json'},JSON.stringify({languageCode:s.locale,summary:s.body,topicType:'STANDARD',...(container?{media:[{mediaFormat:'PHOTO',sourceUrl:container}]}:{}),callToAction:{actionType:'LEARN_MORE',url:(s.link||s.url)}}));
     id=r.data.name;
   }
   if(!validReceipt(s.platform,id))throw failure('INVALID_PROVIDER_RECEIPT');
   return id;
 }
 async function verify(s,p,id){
   if(!validReceipt(s.platform,id))return false;
   let r;
   if(s.platform==='facebook'){
     r=(await call(p.graphBase+'/'+id+'?fields=id,message,is_published',p.headers)).data;
     return r.id===id&&r.is_published===true&&r.message?.includes((s.link||s.url))===true;
   }
   if(s.platform==='instagram'){
     r=(await call(p.graphBase+'/'+id+'?fields=id,caption,owner,media_product_type',p.headers)).data;
     return r.id===id&&r.owner?.id===p.igId&&r.media_product_type==='FEED'&&r.caption?.includes((s.link||s.url))===true;
   }
   if(s.platform==='linkedin'){
     r=(await call('https://api.linkedin.com/rest/posts/'+encodeURIComponent(id),p.headers)).data;
     return r.id===id&&r.author==='urn:li:organization:'+p.org&&r.lifecycleState==='PUBLISHED'&&r.commentary?.includes((s.link||s.url))===true;
   }
   if(!id.startsWith(p.parent+'/localPosts/'))return false;
   r=(await call('https://mybusiness.googleapis.com/v4/'+id,p.headers)).data;
   return r.name===id&&r.state==='LIVE'&&r.callToAction?.url===(s.link||s.url);
 }
 async function discover(s,p){
   let rows,matched;
   if(s.platform==='facebook'){
     rows=(await call(p.graphBase+'/'+p.pageId+'/published_posts?fields=id,message&limit=50',p.headers)).data.data;
     matched=rows?.filter(x=>x.message?.includes((s.link||s.url))).map(x=>x.id);
   }else if(s.platform==='instagram'){
     rows=(await call(p.graphBase+'/'+p.igId+'/media?fields=id,caption&limit=50',p.headers)).data.data;
     matched=rows?.filter(x=>x.caption?.includes((s.link||s.url))).map(x=>x.id);
   }else if(s.platform==='linkedin'){
     const query=new URLSearchParams({q:'author',author:'urn:li:organization:'+p.org,count:'50',sortBy:'LAST_MODIFIED'});
     rows=(await call('https://api.linkedin.com/rest/posts?'+query,p.headers)).data.elements;
     matched=rows?.filter(x=>x.commentary?.includes((s.link||s.url))).map(x=>x.id);
   }else{
     rows=(await call('https://mybusiness.googleapis.com/v4/'+p.parent+'/localPosts?pageSize=50',p.headers)).data.localPosts;
     matched=rows?.filter(x=>x.callToAction?.url===(s.link||s.url)).map(x=>x.name);
   }
   return matched?.length===1&&validReceipt(s.platform,matched[0])?matched[0]:null;
 }
 return {connect,prepare,publish,verify,discover};
}
function validReceipt(platform,id){
 if(typeof id!=='string'||id.length>225)return false;
 const formats={facebook:/^1473280249199334_\d+$/,instagram:/^\d+$/,linkedin:/^urn:li:(?:share|ugcPost):\d+$/,google:/^accounts\/\d+\/locations\/3970405300470441047\/localPosts\/\d+$/};
 return formats[platform]?.test(id)===true;
}
module.exports={createGateway,validReceipt};
