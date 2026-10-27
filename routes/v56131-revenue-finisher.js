'use strict';

const crypto = require('crypto');
const path = require('path');
const TIER1 = require('../enterprise/v562-tier1-architecture');

const MAX_ROWS = Math.max(1, Math.min(1000, Number(process.env.SBC_MAX_LEAD_IMPORT_ROWS || 500)));
const MAX_BYTES = 25 * 1024 * 1024;

function clean(v,n=500){return String(v ?? '').trim().slice(0,n);}
function first(...v){return v.map(x=>clean(x)).find(Boolean)||'';}
function normPhone(v){return clean(v,80).replace(/global.__SBC_REQUIRE_TENANT(req)D/g,'');}
function now(){return new Date().toISOString();}
function id(prefix='lead'){return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;}

function csvPreview(bytes, filename){
  const rows = TIER1.parseCsvBinary(bytes,{maxBytes:MAX_BYTES,maxRows:MAX_ROWS});
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const mapped = data.slice(0,25).map(r=>Object.fromEntries(headers.map((h,i)=>[clean(h,120),r[i]||''])));
  return {headers,rows:data.length,preview:mapped};
}

function mapRow(r, batchId){
  const business=first(r.businessName,r.business_name,r.business,r.company,r.company_name,r['Business Name'],r['Company Name'],r.name);
  const email=first(r.email,r.Email,r['Email Address']);
  const phone=first(r.phone,r.Phone,r['Phone Number'],r.phone_number);
  return {
    businessName:business,
    contactName:first(r.contactName,r.contact_name,r.contact,r['Contact Name'],r.Name),
    phone,
    email,
    website:first(r.website,r.Website,r['Website']),
    address:first(r.address,r.Address),
    industry:first(r.industry,r.Industry,r.type,r.Type,r['Type / Industry']),
    source:first(r.source,r.Source)||'Lorna Bulk Import',
    notes:first(r.notes,r.Notes)||`Bulk-imported by Lorna. Batch ${batchId}.`,
    websiteStatus:first(r.websiteStatus,r.website_status,r['Website Status']),
    dealValue:Number(r.dealValue||r.deal_value||0)||0
  };
}

function duplicateKey(r){
  return `${clean(r.businessName).toLowerCase()}|${normPhone(r.phone)}|${clean(r.email).toLowerCase()}`;
}

function bulkScore(c){
  const gaps=[];
  const website=clean(c.website);
  const email=clean(c.email);
  const phone=normPhone(c.phone);
  if(!website){gaps.push('NO_WEBSITE');}
  if(!email){gaps.push('NO_BUSINESS_EMAIL');}
  if(!phone){gaps.push('NO_PHONE');}
  if(website && /^(facebook|instagram|yelp|linktrglobal.__SBC_REQUIRE_TENANT(req).ee|googleglobal.__SBC_REQUIRE_TENANT(req).)/i.test(website))gaps.push('SOCIAL_ONLY_PRESENCE');
  const contactability=(email?15:0)+(phone?20:0);
  const digitalGap=(gaps.includes('NO_WEBSITE')?28:0)+(gaps.includes('NO_BUSINESS_EMAIL')?18:0)+(gaps.includes('SOCIAL_ONLY_PRESENCE')?12:0);
  const completeness=(c.address?7:0)+(c.industry?5:0)+(c.contactName?8:0);
  const freshness=15;
  const total=Math.min(100,digitalGap+contactability+completeness+freshness);
  const packageRec=total>=75?'Business Essentials':total>=55?'Business Starter':'Business Starter';
  const angle=gaps.includes('NO_WEBSITE')?'online presence + booking':gaps.includes('NO_BUSINESS_EMAIL')?'professional email + trust':gaps.includes('SOCIAL_ONLY_PRESENCE')?'owned web presence + lead capture':'infrastructure + growth';
  return {score:total,gaps,recommendedPackage:packageRec,openingAngle:angle,priority:total>=75?'HOT':total>=55?'WARM':'NURTURE'};
}

module.exports=function registerRevenueFinisher(app,{auth,ownerOnly,getContext}){
  const allowed=new Set(['owner','manager','lead_researcher','caller']);

  app.post('/api/v56131/leads/bulk-preview',auth,async(req,res)=>{
    try{
      if(!allowed.has(req.user?.role))return res.status(403).json({error:'Lead research access required.'});
      const filename=clean(req.body?.filename||'leads.csv',180);
      const bytes=Buffer.from(String(req.body?.contentBase64||''),'base64');
      if(!bytes.length)return res.status(400).json({error:'contentBase64 is required.'});
      if(bytes.length>MAX_BYTES)return res.status(413).json({error:'CSV exceeds the 25MB processing limit.'});
      if(!/global.__SBC_REQUIRE_TENANT(req).csv$/i.test(filename))return res.status(400).json({error:'Only CSV files are accepted by Smart Lead Ingest.'});
      const preview=csvPreview(bytes,filename);
      const sample=preview.preview.map(x=>({businessName:first(x.businessName,x.business_name,x.business,x.company,x['Business Name'],x['Company Name'],x.name),phone:first(x.phone,x.Phone,x['Phone Number']),email:first(x.email,x.Email,x['Email Address']),website:first(x.website,x.Website),industry:first(x.industry,x.Industry,x.Type)}));
      res.json({ok:true,filename,bytes:bytes.length,rows:preview.rows,headers:preview.headers,sample,limits:{maxRows:MAX_ROWS,maxBytes:MAX_BYTES},engine:'SBC V56.13.1 Smart Lead Ingest'});
    }catch(e){res.status(400).json({ok:false,error:e.message});}
  });

  app.post('/api/v56131/leads/bulk-ingest',auth,async(req,res)=>{
    const ctx=getContext();
    try{
      if(!allowed.has(req.user?.role))return res.status(403).json({error:'Lead research access required.'});
      const filename=clean(req.body?.filename||'leads.csv',180);
      const bytes=Buffer.from(String(req.body?.contentBase64||''),'base64');
      if(!bytes.length)return res.status(400).json({error:'contentBase64 is required.'});
      if(bytes.length>MAX_BYTES)return res.status(413).json({error:'CSV exceeds the 25MB processing limit.'});
      const batchId=clean(req.body?.batchId||TIER1.createBatchId('LORNA'),100);
      const parsed=TIER1.parseCsvBinary(bytes,{maxBytes:MAX_BYTES,maxRows:MAX_ROWS});
      const headers=parsed[0]||[];
      const sourceRows=parsed.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[clean(h,120),row[i]||''])));
      const mapped=sourceRows.map(r=>mapRow(r,batchId)).filter(r=>r.businessName||r.phone||r.email);
      const seen=new Set();
      let skipped=sourceRows.length-mapped.length;
      let added=0;
      const radar=[];
      for(const r of mapped){
        const key=duplicateKey(r);
        if(seen.has(key)){skipped++;continue;}
        seen.add(key);
        const exists=(ctx.db?.customers||[]).some(c=>
          (r.email && clean(c.email).toLowerCase()===r.email.toLowerCase()) ||
          (normPhone(r.phone) && normPhone(c.phone)===normPhone(r.phone)) ||
          (r.businessName && clean(c.businessName).toLowerCase()===r.businessName.toLowerCase())
        );
        if(exists){skipped++;continue;}
        const createdAt=now();
        const c={
          id:id('cust'),businessName:clean(r.businessName,255),contactName:clean(r.contactName,255),
          phone:clean(r.phone,80),email:clean(r.email,255),status:'Lead',source:clean(r.source,100),
          followUp:'',notes:clean(r.notes,4000),website:clean(r.website,500),
          websiteStatus:clean(r.websiteStatus,80)||(r.website?'':'No Website'),address:clean(r.address,500),
          industry:clean(r.industry,160),dealValue:Math.max(0,Math.min(999999999,Number(r.dealValue)||0)),
          assignedTo:'',createdAt,updatedAt:createdAt,
          leadIntelligence:{
            opportunityType:'Unclassified',bookingPlatform:'',leadTemperature:'Cold',verificationStatus:'Unverified',
            salesReady:false,verificationNotes:'',recommendedPackage:'',outreachStatus:'Not Contacted',
            lastContacted:'',nextFollowUp:'',assignedRep:'',revenuePlayStatus:'Held',
            estimatedDealValue:0,customerStatus:'Prospect',decisionMakerVerified:false,
            sourceResearchNotes:`Lorna Smart Bulk Ingest · ${batchId}`
          }
        };
        if(typeof ctx.normalizeLeadIntelligence==='function')ctx.normalizeLeadIntelligence(c);
        const intelligence=bulkScore(c);
        c.leadIntelligence.leadTemperature=intelligence.priority==='HOT'?'Hot':intelligence.priority==='WARM'?'Warm':'Cold';
        c.leadIntelligence.recommendedPackage=intelligence.recommendedPackage;
        c.leadIntelligence.estimatedDealValue=Number(c.dealValue||0);
        c.leadIntelligence.sourceResearchNotes += ` · ${intelligence.gaps.join(',')||'NO_MAJOR_DIGITAL_GAP'} · SCORE ${intelligence.score}`;
        if(ctx.mysqlPool){
          await ctx.mysqlPool.query(
            `INSERT INTO sbc_customers
              (id,business_name,contact_name,phone,email,status,source,follow_up,notes,website,industry,website_status,assigned_to,account_notes_json,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [c.id,c.businessName,c.contactName,c.phone,c.email,c.status,c.source,null,c.notes,c.website,c.industry,c.websiteStatus,c.assignedTo,JSON.stringify(c.leadIntelligence),ctx.sqlDateTime?ctx.sqlDateTime(c.createdAt):c.createdAt,ctx.sqlDateTime?ctx.sqlDateTime(c.updatedAt):c.updatedAt]
          );
        }
        ctx.db.customers.unshift(c);
        if(typeof ctx.assignLeadAutomatically==='function')ctx.assignLeadAutomatically(c);
        if(typeof ctx.enqueueLeadAssist==='function')ctx.enqueueLeadAssist(c.id,'bulk_ingest','high');
        radar.push({id:c.id,businessName:c.businessName,score:intelligence.score,priority:intelligence.priority,gaps:intelligence.gaps,recommendedPackage:intelligence.recommendedPackage,openingAngle:intelligence.openingAngle});
        added++;
      }
      if(added && typeof ctx.addActivity==='function')ctx.addActivity('import',`Lorna Smart Ingest added ${added} leads`,{batchId,filename,skipped});
      await ctx.saveData();
      res.status(201).json({ok:true,batchId,filename,rows:sourceRows.length,added,skipped,radar:radar.sort((a,b)=>b.score-a.score).slice(0,25),message:`${added} leads entered the CRM and Lead Assist queue.`});
    }catch(e){
      console.error('[V56.13.1 SMART INGEST]',e);
      res.status(500).json({ok:false,error:String(e?.message||e),retryable:true});
    }
  });

  app.get('/api/v56131/revenue/radar',auth,async(req,res)=>{
    try{
      if(!ownerOnly || !['owner','manager'].includes(req.user?.role))return res.status(403).json({error:'Owner or manager access required.'});
      const ctx=getContext();
      const rows=(ctx.db?.customers||[]).map(c=>{const x=bulkScore(c);return {id:c.id,businessName:c.businessName,phone:c.phone,email:c.email,website:c.website,industry:c.industry,score:x.score,priority:x.priority,gaps:x.gaps,recommendedPackage:x.recommendedPackage,openingAngle:x.openingAngle,status:c.status,temperature:c.leadIntelligence?.leadTemperature||''};});
      rows.sort((a,b)=>b.score-a.score);
      const hot=rows.filter(x=>x.priority==='HOT').length,warm=rows.filter(x=>x.priority==='WARM').length;
      res.json({ok:true,generatedAt:now(),total:rows.length,hot,warm,nurture:Math.max(0,rows.length-hot-warm),top:rows.slice(0,25),guardrail:'Radar recommends; Revenue PLAY/owner controls execution.'});
    }catch(e){res.status(500).json({ok:false,error:e.message});}
  });
};
