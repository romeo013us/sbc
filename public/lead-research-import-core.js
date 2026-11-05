/* SBC Lead Research Import Core v2 — data parsing only, never writes CRM records. */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCResearchImportCore=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 var ORDER=['businessName','contactName','phone','email','website','industry','address','notes','source'];
 var ALIASES={
  businessName:['business','businessname','businesslegalname','company','companyname','organization','storename','name'],
  contactName:['contact','contactname','contactperson','owner','ownername','decisionmaker','contactfullname'],
  phone:['phone','phonenumber','businessphone','telephone','tel','mobile','mobilephone'],
  email:['email','emailaddress','businessemail','contactemail'],
  website:['website','web','site','url','weburl','businesswebsite'],
  industry:['industry','category','businesscategory','businesstype','type'],
  address:['address','businessaddress','streetaddress','location','city','businesslocation'],
  notes:['notes','note','researchnotes','description','details'],
  source:['source','leadsource','researchsource']
 };
 function headerKey(label){
  var cleaned=String(label||'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  return ORDER.find(function(key){return (ALIASES[key]||[]).includes(cleaned);})||'';
 }
 function delimiterFor(text,format){
  if(format==='lines')return null;
  if(format==='csv')return ',';
  if(format==='tsv')return '\t';
  var line=String(text||'').split(/\r?\n/,1)[0]||'';
  var tabs=(line.match(/\t/g)||[]).length,commas=(line.match(/,/g)||[]).length;
  if(tabs&&tabs>=commas)return '\t';
  return commas?',':null;
 }
 function parseDelimited(text,delimiter){
  if(!delimiter)return String(text||'').split(/\r?\n/).map(function(line){return [line.trim()];}).filter(function(row){return row[0];});
  var rows=[],row=[],value='',quoted=false,atFieldStart=true;
  var input=String(text||'').replace(/^\uFEFF/,'');
  for(var i=0;i<input.length;i++){
   var c=input[i],next=input[i+1];
   if(quoted){
    if(c==='"'&&next==='"'){value+='"';i++;continue;}
    if(c==='"'){quoted=false;continue;}
    value+=c;continue;
   }
   if(c==='"'&&atFieldStart){quoted=true;atFieldStart=false;continue;}
   if(c===delimiter){row.push(value.trim());value='';atFieldStart=true;continue;}
   if(c==='\n'||c==='\r'){
    if(c==='\r'&&next==='\n')i++;
    row.push(value.trim());if(row.some(Boolean))rows.push(row);
    row=[];value='';atFieldStart=true;continue;
   }
   value+=c;atFieldStart=false;
  }
  if(quoted)throw Error('CSV contains an unclosed quotation mark. Review the file before importing.');
  row.push(value.trim());if(row.some(Boolean))rows.push(row);
  return rows;
 }
 function preview(raw,options){
  options=options||{};
  if(typeof raw!=='string'||!raw.trim())throw Error('Paste a list or select a CSV file.');
  if(raw.length>600000)throw Error('File is too large. Use a CSV or list under 600 KB.');
  var format=options.format||'auto',delimiter=delimiterFor(raw,format),table=parseDelimited(raw,delimiter);
  if(!table.length)throw Error('No business rows found.');
  var first=table[0]||[],found=first.map(headerKey),recognized=found.filter(Boolean).length;
  var isHeader=!!delimiter&&(recognized>=2 || (first.length===1&&['businessName','contactName'].includes(found[0]))) &&
    found.includes('businessName');
  // One-per-line list files never use a header unless explicitly CSV/TSV.
  var keys=isHeader?found:(delimiter?ORDER:['businessName']);
  if(isHeader){
   if(keys.filter(Boolean).length!==new Set(keys.filter(Boolean)).size)throw Error('CSV has repeated column headers. Each column name must be unique.');
   table=table.slice(1);
  }
  if(table.length>100)throw Error('For controlled imports, use a maximum of 100 businesses per batch. Split larger lists into separate batches.');
  var seenNames=new Set(),seenPhones=new Set(),seenEmails=new Set();
  var records=table.map(function(cells,index){
   var record={source:'Lead Research - Bulk Import'},errors=[],warnings=[],suppliedSource='';
   keys.forEach(function(key,n){
    if(!key)return;
    var val=String(cells[n]||'').trim();
    if(key==='source'){suppliedSource=val;return;}
    if(val)record[key]=val;
   });
   ORDER.forEach(function(key){record[key]=String(record[key]||'').trim();});
   // "Source" is evidence about a prospect, not the short CRM intake channel.
   // Keep the short provenance constant for the canonical SBC CRM; map the
   // original source into the dedicated research evidence field instead.
   if(suppliedSource){
    if(suppliedSource.length<=300){
     record.verificationSource=suppliedSource;
    }else{
     // Never silently throw away a long URL or directory citation. Preserve
     // the entire original in Notes, otherwise reject the row with a clear
     // explanation so the employee can revise it before a write occurs.
     var extra='Original research source (CSV): '+suppliedSource;
     var combined=(record.notes?record.notes+'\n\n':'')+extra;
     if(combined.length>2000){
      errors.push('Research source exceeds available Notes space; shorten it or move the source into a separate Notes field (2,000 characters max)');
     }else{
      record.notes=combined;
      record.verificationSource=suppliedSource.slice(0,297)+'...';
      warnings.push('Full research source preserved in Notes; Research Source shortened for CRM');
     }
    }
   }
   if(!record.businessName)errors.push('Business name required');
   if(!record.phone&&!record.email&&!record.website)warnings.push('Add contact details when available');
   if(record.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))errors.push('Email address appears invalid');
   var limit={businessName:200,contactName:150,phone:80,email:250,website:300,industry:160,address:350,notes:2000,source:160,verificationSource:300};
   Object.keys(limit).forEach(function(key){if(record[key].length>limit[key])errors.push(key+' is too long');});
   var name=record.businessName.toLowerCase().replace(/\s+/g,' '),phone=record.phone.replace(/\D/g,''),email=record.email.toLowerCase();
   if(name&&seenNames.has(name) || phone&&seenPhones.has(phone) || email&&seenEmails.has(email))errors.push('Duplicate within this batch');
   if(name)seenNames.add(name);
   if(phone)seenPhones.add(phone);
   if(email)seenEmails.add(email);
   return {index:index,rowNumber:index+1+(isHeader?1:0),record:record,errors:errors,warnings:warnings,status:errors.length?'invalid':'ready',message:''};
  });
  var ready=records.filter(function(r){return r.status==='ready';}).length;
  return {records:records,total:records.length,ready:ready,rejected:records.length-ready,format:delimiter==='\t'?'TSV':delimiter===','?'CSV':'One business per line',headersDetected:isHeader};
 }
 return {preview:preview,parseDelimited:parseDelimited,delimiterFor:delimiterFor,headerKey:headerKey,ORDER:ORDER};
});
