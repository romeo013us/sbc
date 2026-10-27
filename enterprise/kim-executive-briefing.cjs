/**
 * SBC V64.2 — Kim 07:00 Executive Briefing
 * Strict trailing 24-hour operating window. Last-login data may be attached
 * as secondary context but never changes the measurement window.
 */
class KimExecutiveBriefing {
  constructor({ poolGetter, logger = console, timezone = null } = {}) {
    this.poolGetter = poolGetter;
    this.logger = logger;
    this.timezone = timezone || process.env.TZ || "America/New_York";
    this.timer = null;
  }
  pool(){ try{return this.poolGetter?.()||null;}catch(_){return null;} }

  async ensureSchema(){
    const p=this.pool(); if(!p) return false;
    await p.query(`CREATE TABLE IF NOT EXISTS sbc_kim_executive_briefs(
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      brief_date DATE NOT NULL,
      window_start DATETIME NOT NULL,
      window_end DATETIME NOT NULL,
      brief_json LONGTEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'GENERATED',
      created_at DATETIME NOT NULL,
      PRIMARY KEY(id),
      UNIQUE KEY uq_kim_brief_day(tenant_id,brief_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }

  async generate({ tenantId=1, now=new Date() }={}){
    const p=this.pool(); if(!p) return {ok:false,reason:"MYSQL_UNAVAILABLE"};
    const end = now;
    const start = new Date(end.getTime()-24*60*60*1000);
    const startSql=start.toISOString().slice(0,19).replace('T',' ');
    const endSql=end.toISOString().slice(0,19).replace('T',' ');

    const [rows]=await p.query(`
      SELECT
        (SELECT COUNT(*) FROM sbc_observability_events WHERE timestamp_utc BETWEEN ? AND ?) AS events,
        (SELECT COUNT(*) FROM sbc_kevin_runtime_ledger WHERE tenant_id=? AND created_at BETWEEN ? AND ?) AS kevin_actions,
        (SELECT COUNT(*) FROM sbc_kevin_runtime_ledger WHERE tenant_id=? AND status IN ('FROZEN','BLOCKED') AND created_at BETWEEN ? AND ?) AS blocked_actions
    `,[startSql,endSql,tenantId,startSql,endSql,tenantId,startSql,endSql]);

    const metrics=rows?.[0]||{};
    const brief={
      generatedAt:end.toISOString(),
      window:{type:"STRICT_TRAILING_24_HOURS",start:start.toISOString(),end:end.toISOString()},
      operationalYield:{
        observabilityEvents:Number(metrics.events||0),
        kevinActions:Number(metrics.kevin_actions||0),
        blockedOrFrozenActions:Number(metrics.blocked_actions||0)
      },
      lastLoginIsSecondaryContext:true,
      policy:"NO_AUTONOMOUS_CAPITAL_MOVEMENT"
    };
    await p.query(`
      INSERT INTO sbc_kim_executive_briefs
        (tenant_id,brief_date,window_start,window_end,brief_json,status,created_at)
      VALUES (?,UTC_DATE(),?,?,?,'GENERATED',UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE brief_json=VALUES(brief_json),window_start=VALUES(window_start),
        window_end=VALUES(window_end),status='GENERATED'
    `,[tenantId,startSql,endSql,JSON.stringify(brief)]);
    return {ok:true,brief};
  }

  _msUntilNext0700(){
    const now=new Date();
    const next=new Date(now);
    next.setHours(7,0,0,0);
    if(next<=now) next.setDate(next.getDate()+1);
    return Math.max(1000,next-now);
  }

  start(){
    if(this.timer) return;
    const schedule=()=>{this.timer=setTimeout(async()=>{
      try{await this.generate({tenantId:1});}
      catch(e){this.logger.warn?.("[KIM 07:00 BRIEF] "+(e.message||e));}
      this.timer=null; schedule();
    },this._msUntilNext0700());};
    schedule();
  }
  stop(){if(this.timer)clearTimeout(this.timer);this.timer=null;}
}
module.exports={KimExecutiveBriefing};
