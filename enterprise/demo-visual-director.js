'use strict';

const IMAGE_LIBRARY = {
  salon: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=88'
  ],
  service: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=88'
  ],
  contractor: [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=88'
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=88'
  ],
  property: [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=88'
  ],
  authority: [
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=88'
  ],
  professional: [
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=88'
  ],
  care: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=88'
  ],
  automotive: [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=88'
  ],
  technology: [
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=88'
  ],
  local: [
    'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1600&q=88',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=88'
  ]
};

function family(industry='') {
  const s=String(industry).toLowerCase();
  if(/salon|beauty|barber|spa|lash|nail|esthetic|cosmetic/.test(s)) return 'salon';
  if(/restaurant|cafe|bakery|catering|food|grill|bar/.test(s)) return 'restaurant';
  if(/real estate|realtor|realty|property|mortgage/.test(s)) return 'property';
  if(/law|legal|attorney|lawyer/.test(s)) return 'authority';
  if(/account|bookkeep|tax|finance|insurance|financial/.test(s)) return 'professional';
  if(/medical|dental|clinic|therapy|health|chiropract|wellness/.test(s)) return 'care';
  if(/auto|mechanic|tire|collision|detailing|car wash/.test(s)) return 'automotive';
  if(/software|saas|tech|ai|cyber|digital|agency/.test(s)) return 'technology';
  if(/hvac|plumb|electric|roof|contractor|construction|handyman|remodel/.test(s)) return 'contractor';
  if(/pressure|cleaning|landscap|lawn|pest|pool|janitorial/.test(s)) return 'service';
  return 'local';
}

function directVisuals(demo={}) {
  const f=family(demo.industry || demo.customer?.industry || '');
  const supplied=demo.media || {};
  const images=Array.isArray(supplied.images)&&supplied.images.length ? supplied.images.slice(0,8) : IMAGE_LIBRARY[f];
  return {
    family:f,
    heroImage:supplied.heroImage || images[0],
    gallery:images.slice(1,5),
    videoUrl:String(supplied.videoUrl||'/demo-media/sbc-motion.mp4'),
    videoPoster:supplied.videoPoster || images[0],
    motion:true,
    lightLayers:true,
    imageSource:supplied.images?.length?'customer':'industry-library'
  };
}

module.exports={family,directVisuals,IMAGE_LIBRARY};
