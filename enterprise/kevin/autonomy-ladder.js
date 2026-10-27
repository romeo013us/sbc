/**
 * SBC V64.2.18 — Autonomy Ladder
 * Authority is derived per action; Kevin never self-promotes.
 */
export const AUTONOMY_LEVELS = {
  0: 'OBSERVE',
  1: 'RECOMMEND',
  2: 'SIMULATE',
  3: 'REVERSIBLE_ACTIONS',
  4: 'BOUNDED_ACTIONS',
  5: 'COORDINATE_SYSTEMS',
  6: 'ANTICIPATE',
  7: 'SELF_OPTIMIZE_STRATEGY',
  8: 'MANAGE_WORKFLOWS',
  9: 'EXECUTIVE_AUTONOMY',
  10: 'OWNER_LEVEL_STRATEGIC_ASSISTANT'
};

export function canPerform(level, required) {
  return Number(level) >= Number(required);
}

export class AutonomyLadder {
  constructor(config = {}) {
    this.config = config;
  }

  requiredLevel(action = {}) {
    if (action.irreversible && action.ownerApproved !== true) return 10;
    if (action.credentialMutation || action.type === 'CREDENTIAL_MUTATION') return 10;
    if (action.unrestrictedProductionMutation || action.directProductionMutation) return 10;
    if (action.crossSystem || action.coordinateSystems) return 5;
    if (action.workflow || action.type === 'REVENUE_PLAY') return 8;
    if (action.reversible) return 3;
    return 4;
  }

  calculateCurrentAuthorityBracket(action = {}) {
    const current = Number(this.config.autonomyLevel ?? 4);
    const required = this.requiredLevel(action);
    if (!canPerform(current, required)) return 'OWNER_REVIEW_REQUIRED';
    if (current >= 9) return 'FULL_AUTONOMY_APPROVED';
    return AUTONOMY_LEVELS[current] || 'BOUNDED_ACTIONS';
  }

  evaluate(action = {}) {
    const current = Number(this.config.autonomyLevel ?? 4);
    const required = this.requiredLevel(action);
    return {
      current,
      required,
      currentLabel: AUTONOMY_LEVELS[current] || 'UNKNOWN',
      requiredLabel: AUTONOMY_LEVELS[required] || 'OWNER_LEVEL_STRATEGIC_ASSISTANT',
      authorizedByLadder: canPerform(current, required),
      bracket: this.calculateCurrentAuthorityBracket(action)
    };
  }
}
