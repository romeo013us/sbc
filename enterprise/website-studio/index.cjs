'use strict';
// SBC native, opt-in Phase 1+2 compiler. Does not register routes, mutate CRM,
// publish a site, or change the legacy factory's output. Call from a trusted,
// tenant-scoped, owner-authorized service after factual approvals are recorded.
const {assessResearch}=require('./research-classifier.cjs');
const {createDesignTokens}=require('./creative-director.cjs');
const {architectSite}=require('./website-architect.cjs');
const {compileStaticSite}=require('./static-compiler.cjs');
const {compileArtDirectedSite}=require('./art-directed-compiler.cjs');
function createPrivateConcept({verified_profile,research_signals=[],researchCompleted=false,quoteEstimatorEnabled=false}){
 const research=assessResearch({signals:research_signals,researchCompleted});
 // Deliberately pass ONLY the trusted approved profile to the two compilers.
 const designTokens=createDesignTokens(verified_profile);
 const layoutAst=architectSite(verified_profile,{quoteEstimatorEnabled});
 const bundle=compileArtDirectedSite({profile:verified_profile,designTokens,layoutAst});
 return {research,designTokens,layoutAst,bundle};
}
module.exports={createPrivateConcept,assessResearch,createDesignTokens,architectSite,compileStaticSite,compileArtDirectedSite};
