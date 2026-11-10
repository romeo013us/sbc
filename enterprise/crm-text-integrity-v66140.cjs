'use strict';
// SBC V66.140: deterministic pre-write text integrity checks.
// No mutation or cross-record inference. Unicode letters/accents are valid.
// Newlines and tabs are permitted in notes, not in business identity fields.
const BINARY=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]|\bxl\/(?:styles|workbook|sharedStrings)\.xml\b|\[Content_Types\]\.xml|PK\x03\x04/u;
const IDENTITY_FIELDS=Object.freeze([
 'businessName','business_name','company','contactName','contact_name','phone','email',
 'source','researchSource','verificationSource','website','websiteStatus','address','industry','city','zip'
]);
const NOTES_FIELDS=Object.freeze(['notes']);
function invalidText(value,{allowLineBreaks=false}={}){
 const s=String(value??'');
 if(BINARY.test(s))return true;
 if(!allowLineBreaks&&/[\n\r\t]/u.test(s))return true;
 return false;
}
function invalidFields(record,{includeNotes=true}={}){
 if(!record||typeof record!=='object'||Array.isArray(record))return ['record'];
 const bad=[];
 for(const field of IDENTITY_FIELDS)if(invalidText(record[field]))bad.push(field);
 if(includeNotes)for(const field of NOTES_FIELDS)if(invalidText(record[field],{allowLineBreaks:true}))bad.push(field);
 return bad;
}
function inspectBatch(rows,{maxResults=50}={}){
 if(!Array.isArray(rows))throw Error('ROWS_REQUIRED');
 const invalid=[];
 rows.forEach((row,index)=>{const fields=invalidFields(row);if(fields.length&&invalid.length<maxResults)invalid.push({row:index+1,fields});});
 return {ok:invalid.length===0,invalid,inspected:rows.length,readOnly:true};
}
module.exports={invalidText,invalidFields,inspectBatch};
