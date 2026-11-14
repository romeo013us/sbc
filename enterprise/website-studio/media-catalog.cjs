'use strict';
// Private design references for SBC Website Studio. The catalog is deliberately
// small in photo count and broad in niche labels: it is NOT an image-stock service.
// A link here is NOT a rights approval or evidence of the client's own work.
const NICHE_GROUPS=Object.freeze({
  "automotive": [
    "Auto Repair",
    "Auto Detailing",
    "Car Wash",
    "Window Tinting",
    "Tire Shop",
    "Auto Body Shop",
    "Mobile Mechanic",
    "Car Audio",
    "Motorcycle Repair",
    "Fleet Services"
  ],
  "beauty": [
    "Barbershop",
    "Hair Salon",
    "Nail Salon",
    "Lash Studio",
    "Spa",
    "Massage Therapy",
    "Makeup Artist",
    "Skincare",
    "Bridal Beauty",
    "Beauty Supply"
  ],
  "dining": [
    "Restaurant",
    "Cafe",
    "Bakery",
    "Food Truck",
    "Catering",
    "Coffee Shop",
    "Juice Bar",
    "Ice Cream Shop",
    "Pizzeria",
    "Meal Prep"
  ],
  "trades": [
    "Roofer",
    "Plumber",
    "Electrician",
    "HVAC",
    "Handyman",
    "General Contractor",
    "Painter",
    "Flooring",
    "Remodeling",
    "Pressure Washing",
    "Pool Services",
    "Landscaping",
    "Cleaning Service"
  ],
  "professional": [
    "Notary",
    "Insurance Agent",
    "Law Firm",
    "Tax Preparation",
    "Accountant",
    "Realtor",
    "Financial Advisor",
    "Consulting Firm",
    "Dental Office",
    "Medical Clinic"
  ],
  "local": [
    "Retail Store",
    "Boutique",
    "Gym",
    "Fitness Studio",
    "Daycare",
    "Pet Groomer",
    "Florist",
    "Photography Studio",
    "Event Planner",
    "Tutoring Center",
    "Electronics Repair",
    "Phone Repair"
  ]
});
const ASSETS={
  "automotive": [
    [
      "car-wash",
      "Car wash and automotive cleaning scene",
      "1543857182-68106299b6b2"
    ],
    [
      "vehicle-care",
      "Illustrative auto service photograph",
      "1486262715619-67b85e0b08d3"
    ]
  ],
  "beauty": [
    [
      "salon-interior",
      "Illustrative beauty salon interior",
      "1560066984-138dadb4c035"
    ],
    [
      "barber-interior",
      "Illustrative barbershop interior",
      "1503951914875-452162b0f3f1"
    ]
  ],
  "dining": [
    [
      "restaurant-interior",
      "Illustrative restaurant dining interior",
      "1517248135467-4c7edcad34c4"
    ],
    [
      "cafe-interior",
      "Illustrative neighborhood cafe interior",
      "1501339847302-ac426a4a7cbb"
    ]
  ],
  "trades": [
    [
      "craft-work",
      "Illustrative construction and trade work scene",
      "1504307651254-35680f356dfd"
    ],
    [
      "garden-work",
      "Illustrative garden and outdoor landscaping scene",
      "1416879595882-3373a0480b5b"
    ]
  ],
  "professional": [
    [
      "office-interior",
      "Illustrative professional office interior",
      "1497366811353-6870744d04b2"
    ],
    [
      "modern-workspace",
      "Illustrative modern meeting space",
      "1497366754035-f200968a6e72"
    ]
  ],
  "local": [
    [
      "storefront",
      "Illustrative boutique retail interior",
      "1441986300917-64674bd600d8"
    ],
    [
      "fitness",
      "Illustrative fitness studio interior",
      "1534438327276-14e5300c3a48"
    ]
  ]
};
const GROUPS=[
 ['automotive',/auto|vehicle|car\b|motor|tire|tint|fleet|mechanic|detailing|body shop/i],
 ['beauty',/beauty|barber|salon|nail|lash|spa\b|massage|makeup|skin|bridal/i],
 ['dining',/restaurant|cafe|coffee|bakery|bistro|cater|food|juice|pizza|ice cream|meal prep/i],
 ['trades',/roof|plumb|electric|hvac|handyman|contract|paint|floor|remodel|washing|pool|landscap|cleaning|construction/i],
 ['professional',/notary|insur|law|legal|attorney|tax|account|real estate|realtor|financial|consult|dental|medical|clinic/i]
];
const countNiches=()=>Object.values(NICHE_GROUPS).reduce((sum,x)=>sum+x.length,0);
function mediaGroup(category){
 const term=String(category||'').trim().slice(0,120);
 // Explicit group names first; keyword matching is only a design hint, not an
 // assertion about a business's real services or industry.
 for(const [group,niches] of Object.entries(NICHE_GROUPS)){
  if(niches.some(n=>term.toLowerCase()===n.toLowerCase()))return group;
 }
 return GROUPS.find(([,pattern])=>pattern.test(term))?.[0]||'local';
}
function suggestMedia(category){
 const group=mediaGroup(category);
 const candidates=ASSETS[group].map(([id,label,photo])=>Object.freeze({
  id:group+'-'+id,group,title:label,
  url:'https://images.unsplash.com/photo-'+photo+'?auto=format&fit=crop&w=1200&q=78',
  alt:label,licenseInformation:'Unsplash License: https://unsplash.com/license — review individual asset and depicted people, brands, logos before customer publication.',
  illustrativeOnly:true,rightsConfirmed:false,publicationApproved:false,
  customerWorkClaimed:false
 }));
 return {group,nichesCovered:countNiches(),requiresOwnerRightsReview:true,
  contentStatus:'ILLUSTRATIVE_CANDIDATES_NOT_APPROVED',
  candidates,selectionInstruction:'Owner must verify the individual asset and confirm permission. Never imply the imagery depicts the customer, their staff, equipment or prior work.'};
}
module.exports={NICHE_GROUPS,mediaGroup,suggestMedia};
