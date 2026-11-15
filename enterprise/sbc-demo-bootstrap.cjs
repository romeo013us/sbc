'use strict';
// Isolated dashboard payload for the read-only demonstration role.
// No CRM, MySQL, tenant, network, disk or provider access.
function demoBootstrapData(){
  return {
    customers:[{
      id:'sbc_demo_sample_customer_1',tenantId:0,
      businessName:'SBC Sample Home Services — DEMO',contactName:'Demo Contact',
      industry:'Home Services',city:'Sample City',state:'FL',
      status:'Lead',source:'SYNTHETIC_DEMO_ONLY',
      phone:'',email:'',website:'',address:'',notes:'Fictional demonstration record; not a real prospect.',
      demoOnly:true
    }],
    activities:[],callReports:[],quotes:[],orders:[],renewals:[],
    appointments:[],sequences:[],sequenceEnrollments:[],emailTemplates:[],
    tasks:[],portalAccounts:[],portalMessages:[]
  };
}
module.exports={demoBootstrapData};
