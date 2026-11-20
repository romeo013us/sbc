'use strict';
// Isolated dashboard payload for the read-only demonstration role.
// No CRM, MySQL, tenant, network, disk or provider access.
function demoBootstrapData(){
  return {
    customers:[
      {id:'sbc_demo_sample_customer_1',tenantId:0,businessName:'Sample Home Services — DEMO',contactName:'Demo Contact',industry:'Home Services',city:'Sample City',state:'FL',status:'Lead',source:'SYNTHETIC_DEMO_ONLY',phone:'',email:'',website:'',address:'',notes:'Fictional demo-only lead. Never contact or publish.',demoOnly:true},
      {id:'sbc_demo_sample_customer_2',tenantId:0,businessName:'Sample Auto Repair — DEMO',contactName:'Demo Contact',industry:'Auto Repair',city:'Sample City',state:'FL',status:'Interested',source:'SYNTHETIC_DEMO_ONLY',phone:'',email:'',website:'',address:'',notes:'Fictional demo-only opportunity. No actual sale or payment.',demoOnly:true},
      {id:'sbc_demo_sample_customer_3',tenantId:0,businessName:'Sample Barber Studio — DEMO',contactName:'Demo Contact',industry:'Barber Shop',city:'Sample City',state:'FL',status:'Customer',source:'SYNTHETIC_DEMO_ONLY',phone:'',email:'',website:'',address:'',notes:'Fictional demo-only customer stage. No verified transaction.',demoOnly:true}
    ],
    activities:[],callReports:[],quotes:[],orders:[],renewals:[],
    appointments:[],sequences:[],sequenceEnrollments:[],emailTemplates:[],
    tasks:[],portalAccounts:[],portalMessages:[]
  };
}
module.exports={demoBootstrapData};
