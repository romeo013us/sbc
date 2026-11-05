/* SBC Research Academy: normalize actual SBC Training V2 lesson material for the reader. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCResearchLessonReader=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 const clean=v=>String(v===null||v===undefined?'':v).trim();
 function normalize(module){
  const mod=module&&typeof module==='object'?module:{};
  const lesson=mod.lesson&&typeof mod.lesson==='object'?mod.lesson:{};
  const practice=lesson.practice&&typeof lesson.practice==='object'?lesson.practice:{};
  const check=lesson.knowledgeCheck&&typeof lesson.knowledgeCheck==='object'?lesson.knowledgeCheck:{};
  const assessment=mod.assessment&&typeof mod.assessment==='object'?mod.assessment:{};
  const learn=Array.isArray(lesson.learn)?lesson.learn.map(clean).filter(Boolean):[];
  const questions=Array.isArray(assessment.questions)?assessment.questions.map(x=>{
   if(typeof x==='string')return clean(x);
   return clean(x&&x.prompt);
  }).filter(Boolean):[];
  return {
   id:clean(mod.id),title:clean(mod.title)||'Training lesson',
   minutes:Math.max(1,Math.round(Number(mod.minutes)||15)),
   description:clean(mod.description),
   objective:clean(lesson.objective)||clean(mod.description),
   learn,practicePrompt:clean(practice.prompt),practiceEvidence:clean(practice.evidence),
   knowledgePrompt:clean(check.prompt),passingRule:clean(check.passingRule),
   questions,
   hasReadableContent:Boolean(clean(lesson.objective)||clean(mod.description)||learn.length||
    clean(practice.prompt)||clean(check.prompt)||questions.length),
  };
 }
 return {normalize};
});
