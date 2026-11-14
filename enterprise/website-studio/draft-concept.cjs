'use strict';
// Instant art-directed design for *unverified, private* Account 360 drafts.
// Never stores a verified profile, uses lead research as a business claim,
// transmits forms or permits a public launch.
const {createDesignTokens}=require('./creative-director.cjs');
const {architectSite}=require('./website-architect.cjs');
const {compileArtDirectedSite}=require('./art-directed-compiler.cjs');
const {checkPrivateBundle}=require('./qa-gate.cjs');
const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
function deriveDraftProfile(site){
 if(!site||typeof site!=='object'||site.status==='Approved'||site.archived===true)throw Error('STUDIO_DRAFT_UNAVAILABLE');
 const customer=site.customer||{},name=clean(customer.businessName,120);
 if(!name)throw Error('STUDIO_BUSINESS_IDENTITY_REQUIRED');
 // Compiler-only validation envelope, NEVER considered owner verification.
 return {schemaVersion:1,business:{name,category:clean(site.industry||customer.industry,90)||'Local Business',city:clean(customer.city,90),region:clean(customer.region,60)},
  services:[],reviews:[],contact:{phone:'',email:''},
  verification:{approvedBy:'PRIVATE_DESIGN_DRAFT_ONLY',approvedAt:'2000-01-01T00:00:00.000Z'}};
}
const exampleCatalog=Object.freeze({
 tint:['Film appearance','Comfort and glare','Film-care guidance'],
 automotive:['Service overview','Vehicle consultation','Maintenance planning'],
 beauty:['Signature style','Consultation experience','Appointment journey'],
 dining:['Menu direction','Visit experience','Event inquiries'],
 trades:['Project assessment','Service coverage','Estimate process'],
 professional:['Consultation topics','Client onboarding','Next steps'],
 local:['Service categories','How to get started','Customer inquiries']
});
function createDraftConcept(site){
 const profile=deriveDraftProfile(site),designTokens=createDesignTokens(profile);
 const layoutAst=architectSite(profile,{quoteEstimatorEnabled:false});
 const produced=compileArtDirectedSite({profile,designTokens,layoutAst});
 const files={...produced.files};
 let html=files['index.html'];
 html=html.replace(/Approved facts only/g,'Research-stage design only · Verify business information before use');
 html=html.replace(/PRIVATE DESIGN CONCEPT · NOT A PUBLISHED BUSINESS WEBSITE/g,'UNVERIFIED DESIGN CONCEPT · NOT A PUBLISHED BUSINESS WEBSITE');
 html=html.replace(/Private concept by Successful By Choice\./g,'Unverified design concept by Successful By Choice.');
 const examples=exampleCatalog[designTokens.identity.vertical]||exampleCatalog.local;
 // Hard-coded, illustrative placeholders are visually useful but never imply
 // that this specific business offers the example products or services.
 const ideas=examples.map((x,i)=>'<article class="sbc-example"><span>EXAMPLE '+(i+1)+'</span><h3>'+x+'</h3><p>Illustrative section topic only. Confirm actual services with the business before using it publicly.</p></article>').join('');
 const section='<section class="sbc-example-section" aria-label="Industry design examples requiring confirmation"><div class="wrap"><p class="eyebrow">DESIGN PLANNING ONLY · FACT CHECK REQUIRED</p><h2>See how the story could unfold.</h2><div class="sbc-example-grid">'+ideas+'</div></div></section>';
 html=html.replace('<section class="section contact composed-contact"',section+'<section class="section contact composed-contact"');
 files['styles.css']+='\n.sbc-example-section{padding:90px 0;background:var(--soft);color:var(--ink)}.sbc-example-section h2{font:600 clamp(2rem,4vw,3.8rem)/1.08 var(--display);max-width:780px;margin:12px 0 30px}.sbc-example-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.sbc-example{padding:35px;background:var(--surface);border-top:4px solid var(--accent);min-width:0}.sbc-example span{font-size:.7rem;letter-spacing:.15em;color:var(--accent);font-weight:800}.sbc-example h3{font-size:1.55rem;line-height:1.15}.sbc-example p{line-height:1.55}@media(max-width:750px){.sbc-example-section{padding:55px 0}.sbc-example-grid{grid-template-columns:1fr}}\n';
 files['index.html']=html;
 const bundle={...produced,files,publicationReady:false};
 const qa=checkPrivateBundle(bundle);
 if(!qa.passed)throw Error('STUDIO_DRAFT_QA_FAILED');
 return {bundle,qa,approvalState:'UNVERIFIED_DRAFT',publicationReady:false};
}
module.exports={deriveDraftProfile,createDraftConcept};
