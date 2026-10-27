/**
 * SBC V64.2.28 — KEVIN EXECUTIVE OPERATIONS KERNEL
 * One orchestration layer for the complete God-Tier cognitive loop.
 *
 * OBSERVE → MODEL → PREDICT → DECIDE → SIMULATE → COUNCIL → RED-TEAM
 * → AUTONOMY → GOVERNANCE → EXECUTE → VERIFY → REMEMBER → FEEDBACK
 *
 * Romeo remains the sovereign owner. Kevin cannot self-promote, alter
 * credentials, bypass veto, or grant himself additional authority.
 */
import fs from 'fs';
import path from 'path';
import { KevinExecutiveCore } from './kevin-core.js';
import { KimKevinBridge } from './kim-kevin-bridge.js';
import { AutonomyLadder } from './autonomy-ladder.js';

export function loadKevinConfig(file = 'config/kevin-v63.json') {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export class KevinExecutiveKernel {
  constructor({ config, adapter = {} } = {}) {
    this.kernelSignature = 'KEVIN_V64.2.28_CORE_SOVEREIGN';
    this.config = config || loadKevinConfig();
    this.core = new KevinExecutiveCore({ config: this.config, adapter });
    this.ladder = new AutonomyLadder(this.config);
    this.kim = new KimKevinBridge(this.core);
    this.lastHeartbeat = null;
    this.running = false;
    this.intervalHandle = null;
  }

  /**
   * Run one complete executive heartbeat. This is the single ignition point.
   * The core performs simulation/council/red-team; this kernel adds explicit
   * per-action autonomy routing before anything can reach live execution.
   */
  async executeSovereignHeartbeat({ dryRun = this.config.execution?.dryRunDefault ?? true } = {}) {
    const cycle = await this.core.cognitiveCycle({ dryRun });
    const routed = [];
    const engineeringDiffs = [];

    for (const result of cycle.results) {
      const action = {
        ...(result.directive?.payload || {}),
        type: result.directive?.type,
        irreversible: Boolean(result.directive?.payload?.irreversible),
        ownerApproved: Boolean(result.directive?.payload?.ownerApproved),
        bypassesGovernance: Boolean(result.directive?.payload?.bypassesGovernance),
        credentialMutation: Boolean(result.directive?.payload?.credentialMutation),
        unrestrictedProductionMutation: Boolean(result.directive?.payload?.unrestrictedProductionMutation),
        crossSystem: Boolean(result.directive?.payload?.crossSystem),
        workflow: result.directive?.type === 'REVENUE_PLAY'
      };

      const authority = this.ladder.evaluate(action);
      let route = 'KIM_OWNER_REVIEW';

      if (this.config.governance?.ownerVetoActive) {
        route = 'OWNER_VETO';
      } else if (!authority.authorizedByLadder) {
        route = 'KIM_OWNER_REVIEW';
      } else if (result.adversarial?.pass && result.execution?.status !== 'BLOCKED') {
        route = result.execution?.status === 'EXECUTED' ? 'LIVE_EXECUTED' : 'SIMULATED';
      } else {
        route = 'REJECTED_BY_GOVERNANCE';
      }

      engineeringDiffs.push({
        id: result.directive?.id || crypto.randomUUID(),
        actionType: result.directive?.type || 'UNKNOWN',
        route,
        authority: authority.bracket,
        simulation: result.simulation,
        adversarial: result.adversarial,
        execution: result.execution,
        stagedChange: result.directive?.payload?.change || result.directive?.payload?.patch || null
      });
      routed.push({ id: result.directive?.id || crypto.randomUUID(), authority, route });
    }

    this.lastHeartbeat = {
      ts: new Date().toISOString(),
      kernel: this.kernelSignature,
      dryRun,
      cycle,
      routed,
      engineeringDiffs
    };
    return this.lastHeartbeat;
  }

  /** Start a governed heartbeat. Does not bypass the existing dry-run gate. */
  start({ intervalMs = 15 * 60 * 1000, dryRun = this.config.execution?.dryRunDefault ?? true } = {}) {
    if (this.running) return this;
    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      try {
        await this.executeSovereignHeartbeat({ dryRun });
      } catch (error) {
        this.core.memory.append({
          type: 'KERNEL_FAULT',
          ts: new Date().toISOString(),
          error: String(error)
        });
      }
    };
    void tick();
    this.intervalHandle = setInterval(() => void tick(), intervalMs);
    return this;
  }

  stop() {
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    return this;
  }

  status() {
    return {
      ...this.core.status(),
      kernelSignature: this.kernelSignature,
      running: this.running,
      lastHeartbeat: this.lastHeartbeat?.ts || null
    };
  }
}

export function createKevin(options = {}) {
  const config = options.config || loadKevinConfig(options.configPath);
  const kernel = new KevinExecutiveKernel({ config, adapter: options.adapter });
  return { kernel, kevin: kernel.core, kim: kernel.kim };
}

export function writeStateSnapshot(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}
