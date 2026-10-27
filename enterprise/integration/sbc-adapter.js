/**
 * SBC OS V64.2.17 — Atomic Persistence Adapter Contract
 * Compatibility-preserving integration seam for Kevin.
 * Production persistence remains row-level and non-destructive.
 */
import { assessPersistenceSafety } from './sbc-persistence-safety.mjs';

export class SBCAdapter {
  constructor({stateKernel=null,evolutionEngine=null,externalDispatcher=null,shrinkThreshold=0.90}={}) {
    this.stateKernel=stateKernel;
    this.evolutionEngine=evolutionEngine;
    this.externalDispatcher=externalDispatcher;
    this.identity='SBC_ATOMIC_PERSISTENCE_LAYER';
    this.shrinkThreshold=shrinkThreshold;
  }
  async readBusinessSnapshot() {
    if (this.stateKernel?.getBusinessSnapshot) return await this.stateKernel.getBusinessSnapshot();
    return {};
  }
  assess(authoritativeCore, sourceCore) {
    return assessPersistenceSafety(authoritativeCore, sourceCore, this.shrinkThreshold);
  }
  async dispatch(action) {
    if (this.externalDispatcher) return await this.externalDispatcher(action);
    if (action?.type==='CAPABILITY_EVOLUTION' && this.evolutionEngine?.runAutonomousBuildCycle) {
      return await this.evolutionEngine.runAutonomousBuildCycle(action.payload);
    }
    return {ok:false,mode:'adapter-only',reason:'No external dispatcher connected'};
  }
  health() {
    return {ok:true,identity:this.identity,persistence:'NON_DESTRUCTIVE_ROW_UPSERT'};
  }
}

// New explicit name retained alongside the legacy integration contract.
export class SbcPersistenceAdapter extends SBCAdapter {}
