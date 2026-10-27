'use strict';
const registry=require('./registry');
const CORE=require('./adapters/core-saas');
const SEO=require('./adapters/seo-syndication');
const OPEN=require('./adapters/open-facade');
const INTEL=require('./adapters/advanced-intelligence');
const DEMO=require('./adapters/demo-builder');
const OFFICE=require('./adapters/office-box');
let bootstrapped=false;
function bootstrap(){if(bootstrapped)return registry.list();
  registry.register('CORE_SAAS',CORE,{version:'1.0.0',mode:'always-on',description:'Core checkout, entitlement and provisioning rail.'});
  registry.register('SEO_SYNDICATION',SEO,{version:'1.0.0',mode:'on-demand',description:'Programmatic landing-page/content syndication adapter; no unrestricted scraping.'});
  registry.register('OPEN_FACADE',OPEN,{version:'1.0.0',mode:'on-demand',description:'Provider-neutral external API bridge facade.'});
  registry.register('ADVANCED_INTELLIGENCE',INTEL,{version:'1.0.0',mode:'on-demand',description:'Bounded AI/intelligence work dispatched through existing queues.'});
  registry.register('DEMO_BUILDER',DEMO,{version:'1.0.0',mode:'on-demand',description:'Personalized demo/value-preview adapter.'});
  registry.register('OFFICE_BOX',OFFICE,{version:'1.0.0',mode:'entitlement',description:'Customer operating-system surface.'});
  bootstrapped=true;return registry.list();}
bootstrap();
module.exports={...registry,bootstrap};
