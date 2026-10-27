'use strict';

const fs = require('fs');
const path = require('path');

function firstValue(env, keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
function validE164(value) { return /^\+[1-9]\d{7,14}$/.test(String(value || '').trim()); }
function maskEmail(value) { const v=String(value||''); const at=v.indexOf('@'); if(at<1)return ''; const local=v.slice(0,at); return (local.length<3?local[0]||'*':local.slice(0,2)+'***')+v.slice(at); }
function maskPhone(value) { const v=String(value||''); return v.length<5?'':v.slice(0,3)+'••••'+v.slice(-2); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

class SBCUnattendedNotifications {
  constructor({ env = process.env, getPool = () => null, getDb = () => ({}), getRecoveryRequired = () => true,
    nodemailer = null, twilioFactory = null, logger = console, rootDir = process.cwd(), clock = () => new Date() } = {}) {
    this.env = env; this.getPool = getPool; this.getDb = getDb; this.getRecoveryRequired = getRecoveryRequired;
    this.nodemailer = nodemailer; this.twilioFactory = twilioFactory; this.logger = logger; this.rootDir = rootDir; this.clock = clock;
    this.timer = null; this.started = false; this.lastAttempt = {}; this.lastHealthCheckAt = 0; this.lastResult = { email: null, sms: null, briefing: null, database: null };
    this.stateFile = path.join(rootDir, 'data', 'sbc-unattended-notifications-state.json');
    this.destinationFile = path.join(rootDir, 'data', 'sbc-notification-destinations.json');
    this.state = this._loadState();
  }
  _loadState() { try { const value = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); return value && typeof value === 'object' ? value : {}; } catch { return {}; } }
  _saveState() { try { fs.mkdirSync(path.dirname(this.stateFile), { recursive: true }); fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), { mode: 0o600 }); } catch (e) { this.logger.warn?.('[SBC NOTIFICATIONS] local state persistence unavailable:', e.message); } }
  _loadDestinations() { try { const value = JSON.parse(fs.readFileSync(this.destinationFile, 'utf8')); return value && typeof value === 'object' ? value : {}; } catch { return {}; } }
  updateDestinations({ email, phone } = {}) {
    const current = this._loadDestinations(); const next = { ...current };
    if (email !== undefined && String(email).trim()) { if (!validEmail(email)) throw new Error('INVALID_OWNER_EMAIL'); next.email = String(email).trim().toLowerCase(); }
    if (phone !== undefined && String(phone).trim()) { if (!validE164(phone)) throw new Error('INVALID_OWNER_PHONE_E164'); next.phone = String(phone).trim(); }
    if (!next.email && !next.phone) throw new Error('AT_LEAST_ONE_DESTINATION_REQUIRED');
    fs.mkdirSync(path.dirname(this.destinationFile), { recursive: true });
    fs.writeFileSync(this.destinationFile, JSON.stringify({ email: next.email || '', phone: next.phone || '', updatedAt: this.clock().toISOString(), updatedBy: 'owner' }, null, 2), { mode: 0o600 });
    try { fs.chmodSync(this.destinationFile, 0o600); } catch {}
    return { ok: true, emailConfigured: Boolean(validEmail(next.email)), phoneConfigured: Boolean(validE164(next.phone)) };
  }
  _timezone() { return firstValue(this.env, ['SBC_BRIEFING_TIMEZONE']) || 'America/New_York'; }
  _localParts(date = this.clock()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: this._timezone(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  _ownerUser() {
    let db = {}; try { db = this.getDb?.() || {}; } catch {}
    const users = Array.isArray(db.users) ? db.users : [];
    return users.find(u => u && String(u.role || '').toLowerCase() === 'owner' && u.active !== false) || {};
  }
  _contacts() {
    const owner = this._ownerUser();
    const saved = this._loadDestinations();
    const email = String(saved.email || '').trim() || firstValue(this.env, ['SBC_EXECUTIVE_EMAIL', 'SBC_OWNER_EMAIL', 'OWNER_EMAIL', 'ADMIN_EMAIL', 'SBC_MAIL_TO']) || String(owner.email || '').trim();
    const phone = String(saved.phone || '').trim() || firstValue(this.env, ['SBC_OWNER_PHONE', 'SBC_ALERT_PHONE', 'OWNER_PHONE', 'ALERT_PHONE']) || String(owner.phone || owner.mobile || '').trim();
    return { email: validEmail(email) ? email : '', phone: validE164(phone) ? phone : '' };
  }
  _smtpConfig() {
    const host = firstValue(this.env, ['SBC_SMTP_HOST', 'SMTP_HOST']);
    const user = firstValue(this.env, ['SBC_SMTP_USER', 'SMTP_USER']);
    const pass = firstValue(this.env, ['SBC_SMTP_PASS', 'SMTP_PASS']);
    const from = firstValue(this.env, ['SBC_MAIL_FROM', 'SMTP_FROM', 'SBC_SMTP_USER', 'SMTP_USER']);
    const port = Number(firstValue(this.env, ['SBC_SMTP_PORT', 'SMTP_PORT']) || 587);
    const secureValue = firstValue(this.env, ['SBC_SMTP_SECURE', 'SMTP_SECURE']).toLowerCase();
    return { configured: Boolean(host && user && pass && from && Number.isFinite(port) && port > 0), host, user, pass, from, port, secure: secureValue ? ['1','true','yes'].includes(secureValue) : port === 465 };
  }
  _twilioConfig() {
    const accountSid = firstValue(this.env, ['TWILIO_ACCOUNT_SID', 'SBC_TWILIO_ACCOUNT_SID']);
    const authToken = firstValue(this.env, ['TWILIO_AUTH_TOKEN', 'SBC_TWILIO_AUTH_TOKEN']);
    const from = firstValue(this.env, ['TWILIO_PHONE_NUMBER', 'SBC_TWILIO_FROM']);
    return { configured: Boolean(accountSid && authToken && validE164(from)), accountSid, authToken, from };
  }
  status() {
    const c = this._contacts(), smtp = this._smtpConfig(), twilio = this._twilioConfig();
    return { ok: true, version: '65.0.5', enabled: true,
      destinationStatus: { email: c.email ? maskEmail(c.email) : '', phone: c.phone ? maskPhone(c.phone) : '' },
      schedule: { type: 'daily', localTime: `${String(Number(firstValue(this.env, ['SBC_BRIEFING_HOUR']) || 7)).padStart(2,'0')}:00`, timezone: this._timezone() },
      recoveryRequired: Boolean(this.getRecoveryRequired?.()),
      channels: { email: { configured: smtp.configured && Boolean(c.email), transportConfigured: smtp.configured, recipientConfigured: Boolean(c.email) }, sms: { configured: twilio.configured && Boolean(c.phone), transportConfigured: twilio.configured, recipientConfigured: Boolean(c.phone) } },
      lastResult: this.lastResult,
      policy: { readOnlyReporting: true, autoRefunds: false, moneyMovement: false, credentialChanges: false, destructiveDatabaseOperations: false, automaticRecoveryUnlock: false } };
  }
  async _metrics() {
    const recoveryRequired = Boolean(this.getRecoveryRequired?.());
    const pool = this.getPool?.();
    const metrics = { customers: null, quotes: null, orders: null, renewals: null, activitiesLast24Hours: null };
    const available = {};
    const sql = {
      customers: 'SELECT COUNT(*) AS n FROM sbc_customers',
      quotes: 'SELECT COUNT(*) AS n FROM sbc_quotes',
      orders: 'SELECT COUNT(*) AS n FROM sbc_orders',
      renewals: 'SELECT COUNT(*) AS n FROM sbc_renewals',
      activitiesLast24Hours: 'SELECT COUNT(*) AS n FROM sbc_activities WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR'
    };
    if (pool && typeof pool.query === 'function') {
      for (const [key, query] of Object.entries(sql)) {
        try { const [rows] = await pool.query(query); metrics[key] = Number(rows?.[0]?.n ?? 0); available[key] = true; }
        catch (e) { available[key] = false; this.logger.warn?.(`[SBC NOTIFICATIONS] metric ${key} unavailable:`, e.message); }
      }
    } else for (const key of Object.keys(sql)) available[key] = false;
    const local = this.getDb?.() || {};
    return { generatedAt: this.clock().toISOString(), version: String(this.env.SBC_RELEASE_VERSION || '65.0.4'), recoveryRequired,
      operatingState: recoveryRequired ? 'RECOVERY_LOCKED — MUTATIONS SUSPENDED' : 'RECOVERY LOCK CLEAR — OPERATIONAL TESTING STILL REQUIRED',
      storage: pool ? 'mysql-connection-present' : 'mysql-unavailable', metrics, metricAvailability: available,
      localReadModel: { customers: Array.isArray(local.customers) ? local.customers.length : null, quotes: Array.isArray(local.quotes) ? local.quotes.length : null, orders: Array.isArray(local.orders) ? local.orders.length : null, renewals: Array.isArray(local.renewals) ? local.renewals.length : null },
      approvalsRequired: [], safety: { financialMutationsAllowed: false, ownerVeto: true } };
  }
  _briefText(report) {
    const v = x => x === null || x === undefined ? 'UNAVAILABLE' : String(x);
    return [
      'SBC — DAILY EXECUTIVE OPERATIONS BRIEFING',
      `Generated: ${report.generatedAt}`,
      `Release: ${report.version}`,
      `System state: ${report.operatingState}`,
      `Storage: ${report.storage}`,
      '', 'AUTHORITATIVE MYSQL COUNTS',
      `Customers: ${v(report.metrics.customers)}`,
      `Quotes: ${v(report.metrics.quotes)}`,
      `Orders: ${v(report.metrics.orders)}`,
      `Renewals: ${v(report.metrics.renewals)}`,
      `Activities in last 24 hours: ${v(report.metrics.activitiesLast24Hours)}`,
      '', 'LOCAL READ MODEL (not authoritative)',
      `Customers: ${v(report.localReadModel.customers)}`,
      `Quotes: ${v(report.localReadModel.quotes)}`,
      `Orders: ${v(report.localReadModel.orders)}`,
      `Renewals: ${v(report.localReadModel.renewals)}`,
      '', 'GUARDRAILS',
      'No refunds, money movement, credential changes, destructive database operations, or automatic recovery unlocks are permitted.',
      report.recoveryRequired ? 'ACTION REQUIRED: authoritative recovery remains locked. Keep Revenue PLAY and mutation workers suspended.' : 'Recovery lock is clear; complete the controlled end-to-end acceptance test before unattended operation.',
      '', 'Metrics that could not be queried are marked UNAVAILABLE, never silently represented as zero.'
    ].join('\n');
  }
  _briefHtml(report) {
    const text = this._briefText(report);
    return `<div style="font-family:Arial,sans-serif;background:#071827;color:#eaf4ff;padding:24px"><h1 style="color:#58b5ff">SBC Daily Executive Briefing</h1><p><b>Generated:</b> ${escapeHtml(report.generatedAt)}</p><p><b>Release:</b> ${escapeHtml(report.version)}</p><p><b>System state:</b> ${escapeHtml(report.operatingState)}</p><h2>Authoritative MySQL counts</h2><table cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tbody>${Object.entries(report.metrics).map(([k,v])=>`<tr><td style="border-bottom:1px solid #234">${escapeHtml(k)}</td><td style="border-bottom:1px solid #234">${escapeHtml(v===null?'UNAVAILABLE':v)}</td></tr>`).join('')}</tbody></table><p style="color:#ffd166">${report.recoveryRequired?'Action required: keep mutation workers suspended until authoritative recovery is validated.':'Recovery lock is clear; controlled acceptance testing is still required.'}</p><pre style="white-space:pre-wrap">${escapeHtml(text)}</pre></div>`;
  }
  async sendEmail(subject, text, html) {
    const cfg = this._smtpConfig(), to = this._contacts().email;
    if (!cfg.configured || !to || !this.nodemailer) return { ok: false, skipped: true, reason: !to ? 'OWNER_EMAIL_NOT_CONFIGURED' : !cfg.configured ? 'SMTP_NOT_CONFIGURED' : 'NODEMAILER_UNAVAILABLE' };
    const transporter = this.nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    const info = await transporter.sendMail({ from: cfg.from, to, subject, text, html });
    const result = { ok: true, messageId: String(info.messageId || ''), acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : undefined };
    this.lastResult.email = { at: this.clock().toISOString(), ok: true, messageId: result.messageId };
    return result;
  }
  async sendSms(body) {
    const cfg = this._twilioConfig(), to = this._contacts().phone;
    if (!cfg.configured || !to || !this.twilioFactory) return { ok: false, skipped: true, reason: !to ? 'OWNER_PHONE_NOT_CONFIGURED' : !cfg.configured ? 'TWILIO_NOT_CONFIGURED' : 'TWILIO_SDK_UNAVAILABLE' };
    const client = this.twilioFactory(cfg.accountSid, cfg.authToken);
    const message = await client.messages.create({ from: cfg.from, to, body: String(body).slice(0, 1500) });
    const result = { ok: true, sid: String(message.sid || ''), status: String(message.status || 'queued') };
    this.lastResult.sms = { at: this.clock().toISOString(), ok: true, sid: result.sid, status: result.status };
    return result;
  }
  async sendBriefing() {
    const report = await this._metrics();
    const subject = `SBC Daily Operations — ${report.recoveryRequired ? 'RECOVERY LOCKED' : 'RECOVERY CHECK'} — ${report.generatedAt.slice(0,10)}`;
    const result = await this.sendEmail(subject, this._briefText(report), this._briefHtml(report));
    this.lastResult.briefing = { at: this.clock().toISOString(), ok: Boolean(result.ok), reason: result.reason || null, recoveryRequired: report.recoveryRequired };
    return { ...result, report };
  }
  async sendCriticalAlert(key, message) {
    const cleanKey = String(key || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0,100);
    if (!cleanKey) return { ok: false, reason: 'ALERT_KEY_REQUIRED' };
    const now = this.clock().getTime(); const prior = Number(this.state.alerts?.[cleanKey] || 0);
    if (prior && now - prior < 6 * 60 * 60 * 1000) return { ok: true, deduplicated: true, reason: 'ALERT_COOLDOWN' };
    const result = await this.sendSms(`SBC CRITICAL ALERT: ${String(message || 'No details supplied.').slice(0, 1200)}`);
    if (result.ok) { this.state.alerts = this.state.alerts || {}; this.state.alerts[cleanKey] = now; this._saveState(); }
    return result;
  }
  async checkDatabaseHealth() {
    const pool = this.getPool?.();
    if (!pool || typeof pool.query !== 'function') {
      this.lastResult.database = { at: this.clock().toISOString(), ok: false, reason: 'MYSQL_POOL_UNAVAILABLE' };
      await this.sendCriticalAlert('mysql-connectivity', 'MySQL connection pool is unavailable. Verify the database connection and keep all mutation workers suspended until confirmed healthy.').catch(() => {});
      return { ok: false, reason: 'MYSQL_POOL_UNAVAILABLE' };
    }
    try { await pool.query('SELECT 1 AS sbc_health'); this.lastResult.database = { at: this.clock().toISOString(), ok: true }; if (this.getRecoveryRequired?.()) await this.sendCriticalAlert('mysql-recovery-lock', 'Authoritative MySQL recovery lock is active. CRM mutations, Revenue PLAY, and Kim mutation workers must remain suspended.').catch(() => {}); return { ok: true }; }
    catch (e) { this.lastResult.database = { at: this.clock().toISOString(), ok: false, reason: 'MYSQL_QUERY_FAILED' }; await this.sendCriticalAlert('mysql-connectivity', `MySQL health check failed: ${String(e.message || e).slice(0,300)}. Keep mutation workers suspended until the database is verified healthy.`).catch(() => {}); return { ok: false, reason: 'MYSQL_QUERY_FAILED' }; }
  }
  async _tick() {
    const nowMs = this.clock().getTime();
    if (nowMs - this.lastHealthCheckAt >= 5 * 60 * 1000) { this.lastHealthCheckAt = nowMs; await this.checkDatabaseHealth(); }
    const parts = this._localParts();
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const hour = Number(firstValue(this.env, ['SBC_BRIEFING_HOUR']) || 7);
    if (Number(parts.hour) === hour && Number(parts.minute) <= 5 && this.state.lastBriefingDate !== day && this.lastAttempt.briefingDate !== day) {
      this.lastAttempt.briefingDate = day;
      try {
        const result = await this.sendBriefing();
        if (result.ok) { this.state.lastBriefingDate = day; this._saveState(); }
        else this.logger.warn?.('[SBC NOTIFICATIONS] daily briefing not sent:', result.reason || 'unknown');
      } catch (e) { this.lastResult.briefing = { at: this.clock().toISOString(), ok: false, reason: e.message }; this.logger.warn?.('[SBC NOTIFICATIONS] daily briefing failed:', e.message); this.sendCriticalAlert('daily-briefing-failure', `Daily executive email briefing failed: ${String(e.message || e).slice(0,300)}.`).catch(() => {}); }
    }
  }
  start() {
    if (this.started) return this.status();
    this.started = true;
    this.timer = setInterval(() => this._tick().catch(e => this.logger.warn?.('[SBC NOTIFICATIONS] scheduler:', e.message)), 60000);
    this.timer.unref?.();
    this.checkDatabaseHealth().catch(e => this.logger.warn?.('[SBC NOTIFICATIONS] initial database health check failed:', e.message));
    this.logger.info?.('[SBC NOTIFICATIONS] scheduler active; daily email and critical SMS are configuration-gated.');
    return this.status();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.started = false; }
}

module.exports = { SBCUnattendedNotifications, validEmail, validE164, maskEmail, maskPhone };
