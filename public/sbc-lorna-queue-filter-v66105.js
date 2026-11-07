/* SBC V66.105 — show human-readable researcher work, leave malformed CRM rows intact for owner review.
   This helper is read-only: it cannot delete, mark verified or dismiss a record. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCLornaQueueFilter=api;
})(typeof window==='undefined'?{}:window,function(){
 'use strict';
 const FIELDS=['businessName','contactName','phone','email','website','city','address','industry'];
 const badText=s=>/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/u.test(s)||
    /xl\/(?:workbook|styles|sharedstrings)\.xml|\[Content_Types\]\.xml|PK\u0003\u0004/i.test(s);
 function corrupt(lead){
  if(!lead||typeof lead!=='object')return true;
  return FIELDS.some(key=>badText(String(lead[key]||'')));
 }
 function displayable(lead){return !corrupt(lead);}
 function clean(list){return (Array.isArray(list)?list:[]).filter(displayable);}
 return {corrupt,displayable,clean};
});
