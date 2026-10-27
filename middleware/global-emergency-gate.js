'use strict';

/**
 * V64.3.3 dependency-isolated emergency gate.
 * A failing dependency freezes only routes bound to that dependency.
 * Unknown/unavailable health fails closed for protected outbound actions.
 */
function createGlobalEmergencyGate({ pool, protectedPrefixes = [
  '/api/webhooks/outbound','/api/outbound','/api/sales','/api/calls','/api/sms','/api/email','/api/checkout'
], dependencyResolver = null } = {}) {
  if (!pool) throw new Error('createGlobalEmergencyGate requires pool');
  return async function globalEmergencyGate(req,res,next){
    const path=String(req.path||req.originalUrl||'');
    const protectedRoute=protectedPrefixes.some(prefix=>path===prefix||path.startsWith(prefix+'/'));
    if(!protectedRoute)return next();
    try{
      const [globalRows]=await pool.query(`SELECT setting_value FROM sbc_global_settings WHERE setting_key='global_emergency_kill_switch' LIMIT 1`);
      if(globalRows.length && String(globalRows[0].setting_value)!=='1') return res.status(423).json({ok:false,error:'GLOBAL_EMERGENCY_KILL_SWITCH_ACTIVE',outward_actions_blocked:true});
      const dependency=dependencyResolver?.(req) || (path.includes('/sms')||path.includes('/calls')?'twilio':path.includes('/checkout')?'square':path.includes('/email')?'smtp':'core');
      if(dependency && dependency!=='core'){
        const [rows]=await pool.query(`SELECT status FROM sbc_dependency_health WHERE dependency_name=? LIMIT 1`,[dependency]);
        if(!rows.length || !['healthy','degraded'].includes(String(rows[0].status).toLowerCase())){
          return res.status(503).json({ok:false,error:'DEPENDENCY_ISOLATED',dependency,outward_actions_blocked:true});
        }
      }
      return next();
    }catch(error){
      console.error('[GLOBAL EMERGENCY GATE]',error);
      return res.status(503).json({ok:false,error:'GLOBAL_GATE_UNAVAILABLE',outward_actions_blocked:true});
    }
  };
}
module.exports={createGlobalEmergencyGate};
