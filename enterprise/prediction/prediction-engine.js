/**
 * SBC V64.2 — PREDICTIVE CAPITAL INTELLIGENCE ENGINE
 *
 * Intelligence only. This module forecasts operating burn and reserve needs.
 * It NEVER moves money, changes payment instructions, or authorizes a transfer.
 */
export class CapitalPredictionEngine {
  constructor({ poolGetter = null, logger = console, config = {} } = {}) {
    this.identity = "KEVIN_FINANCIAL_INTELLIGENCE";
    this.poolGetter = poolGetter;
    this.logger = logger;
    this.config = config;
  }

  _pool() { try { return this.poolGetter?.() || null; } catch (_) { return null; } }

  _num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Forecast the next 30 days using explicit unit assumptions.
   * Supported telemetry:
   * activeShardWorkers, eventBusIngestRate, monthlyFixedInfraCost,
   * variableCostPerIngest, workerCostPerDay, telemetryFreshnessDelta.
   *
   * If fixed/variable inputs are absent, the engine uses the conservative
   * configured defaults rather than pretending that an arbitrary number is
   * an observed cloud bill.
   */
  async calculateOperationalRunrateForecast(liveTrafficMetrics = {}) {
    const workers = Math.max(0, this._num(liveTrafficMetrics.activeShardWorkers));
    const ingestRate = Math.max(0, this._num(liveTrafficMetrics.eventBusIngestRate));
    const fixedMonthly = Math.max(0, this._num(
      liveTrafficMetrics.monthlyFixedInfraCost,
      this._num(this.config.monthlyFixedInfraCost, 0)
    ));
    const workerCostPerDay = Math.max(0, this._num(
      liveTrafficMetrics.workerCostPerDay,
      this._num(this.config.workerCostPerDay, 12.50)
    ));
    const variableCostPerIngest = Math.max(0, this._num(
      liveTrafficMetrics.variableCostPerIngest,
      this._num(this.config.variableCostPerIngest, 0.004)
    ));

    // eventBusIngestRate is interpreted as events/minute.
    const events30d = ingestRate * 60 * 24 * 30;
    const worker30d = workers * workerCostPerDay * 30;
    const variable30d = events30d * variableCostPerIngest;
    const projectedInfrastructureExpense = fixedMonthly + worker30d + variable30d;

    const volatilityCushionPct = Math.min(
      0.50,
      Math.max(0.10, this._num(liveTrafficMetrics.volatilityCushionPct, 0.20))
    );
    const recommendedCapitalReserve =
      projectedInfrastructureExpense * (1 + volatilityCushionPct);

    const freshness = this._num(liveTrafficMetrics.telemetryFreshnessDelta, 0);
    const confidenceScore = freshness >= 0.95 ? "HIGH" :
      freshness >= 0.75 ? "MEDIUM" : "LOW";

    const briefing = {
      timestamp: new Date().toISOString(),
      horizonDays: 30,
      projectedInfrastructureExpense: Number(projectedInfrastructureExpense.toFixed(2)),
      forecastedBurn30Days: Number(projectedInfrastructureExpense.toFixed(2)),
      recommendedCapitalReserve: Number(recommendedCapitalReserve.toFixed(2)),
      volatilityCushionPct,
      confidenceScore,
      confidenceBasis: {
        telemetryFreshness: freshness,
        assumptions: { workerCostPerDay, variableCostPerIngest, fixedMonthly }
      },
      telemetry: { activeShardWorkers: workers, eventBusIngestRate: ingestRate },
      policy: "FORECAST_ONLY_NO_AUTONOMOUS_CAPITAL_MOVEMENT",
      status: "STAGED_FOR_ROMEO_REVIEW"
    };

    await this.logForecastBriefingToStaging(briefing);
    return briefing;
  }

  async logForecastBriefingToStaging(briefing) {
    const pool = this._pool();
    if (!pool) {
      this.logger.warn?.("[KEVIN FINANCE] MySQL unavailable; forecast remains in memory only.");
      return { persisted: false, mode: "MEMORY_ONLY" };
    }

    await pool.query(`
      INSERT INTO sbc_kevin_capital_forecasts
        (tenant_id, forecast_date, horizon_days, forecast_json, status, created_at, updated_at)
      VALUES (1, UTC_DATE(), ?, ?, 'STAGED_FOR_ROMEO_REVIEW', UTC_TIMESTAMP(), UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        forecast_json=VALUES(forecast_json),
        status='STAGED_FOR_ROMEO_REVIEW',
        updated_at=UTC_TIMESTAMP()
    `, [briefing.horizonDays, JSON.stringify(briefing)]);

    this.logger.log?.("✓ [KEVIN FINANCE] Forecast staged in durable read-only intelligence ledger.");
    return { persisted: true, mode: "MYSQL" };
  }

  async getLatestForecast() {
    const pool = this._pool();
    if (!pool) return null;
    const [rows] = await pool.query(`
      SELECT forecast_json, status, created_at
      FROM sbc_kevin_capital_forecasts
      WHERE tenant_id=1
      ORDER BY id DESC LIMIT 1
    `);
    if (!rows?.[0]) return null;
    try { return { ...JSON.parse(rows[0].forecast_json), status: rows[0].status }; }
    catch (_) { return null; }
  }
}

/** Backward-compatible executive prediction adapter.
 * The hardened capital forecast remains CapitalPredictionEngine; this adapter
 * preserves the cognitive-core forecast contract so legacy V63 wiring cannot
 * silently break the V64.2 runtime.
 */
export class PredictionEngine {
  forecast(state = {}) {
    const hot = Number(state.hotLeads || 0);
    const warm = Number(state.warmLeads || 0);
    const bottlenecks = Array.isArray(state.bottlenecks) ? state.bottlenecks.length : 0;
    const confidence = Math.max(0, Math.min(1,
      0.55 + (hot > 0 ? 0.15 : 0) + (warm > 0 ? 0.10 : 0) - Math.min(0.20, bottlenecks * 0.03)
    ));
    return {
      horizonDays: 30,
      confidence,
      qualifiedPipeline: hot + warm,
      bottleneckCount: bottlenecks,
      mode: 'EXECUTIVE_FORECAST_COMPATIBILITY_ADAPTER',
      capitalMovement: 'BLOCKED_BY_DESIGN'
    };
  }
}

export default CapitalPredictionEngine;
