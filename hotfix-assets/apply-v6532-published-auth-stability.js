'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MARKER = 'SBC_V6533_STARTUP_DDL_GATE';
const VERSION = '65.1.33';

function once(source, expression, replacement, label) {
  const matches = source.match(expression) || [];
  if (matches.length !== 1) throw new Error(MARKER + ': ' + label + ' match count ' + matches.length);
  return source.replace(expression, replacement);
}
function onceText(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(needle, replacement);
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }

function apply(root) {
  const serverPath = path.join(root, 'server.js');
  let server = fs.readFileSync(serverPath, 'utf8');
  if (!server.includes(MARKER)) {
    server = onceText(
      server,
      "const SESSION_SECRET = process.env.SBC_SESSION_SECRET || crypto.randomBytes(32).toString('hex');",
      "const SESSION_SECRET = require('./enterprise/durable-session-secret').resolveSessionSecret({env:process.env,dataDir:path.join(__dirname,'data')}); // " + MARKER,
      'stable session signing key'
    );

    server = onceText(
      server,
      'let mysqlPool = null;\n// SBC_V6528_RUNTIME_WRITER_LEASE:',
      'let mysqlPool = null;\nlet sessionMysqlPool = null;\n// SBC_V6528_RUNTIME_WRITER_LEASE:',
      'isolated session pool state'
    );

    server = onceText(
      server,
      "const SESSION_STORE=createSessionStore({sessionSecret:SESSION_SECRET,getMysqlPool:()=>mysqlPool,getRedisClient:",
      "const SESSION_STORE=createSessionStore({sessionSecret:SESSION_SECRET,getMysqlPool:()=>sessionMysqlPool||mysqlPool,getRedisClient:",
      'session store pool selection'
    );

    server = onceText(
      server,
      "    await initReadReplica();\n    await initAmqp();\n    return true;",
      "    await initReadReplica();\n    await initAmqp();\n    return true;",
      'remove late session pool initialization'
    );
    server = onceText(
      server,
      "    mysqlPool=null;\n    storageMode='file';",
      "    mysqlPool=null;\n    sessionMysqlPool=null;\n    storageMode='file';",
      'clear session pool when MySQL initialization fails'
    );

    server = onceText(
      server,
      "const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';",
      "const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';\nconst SBC_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true'; // " + MARKER,
      'explicit opt-in for schema changes'
    );

    server = onceText(
      server,
      "if(SBC_RUNTIME_READ_ONLY){\n      // Do not run DDL, migrations, seeders, or repairs from Preview. Hydrate only.",
      "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){\n      // " + MARKER + ": no startup DDL unless explicitly enabled; hydrate existing tables only.\n      // Do not run migrations, seeders, or repairs in this mode.",
      'skip startup DDL unless explicitly enabled'
    );

    server = onceText(
      server,
      "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY){",
      "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){",
      'skip schema-dependent startup workers without DDL opt-in'
    );

    server = onceText(
      server,
      "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY){",
      "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){",
      'skip autonomous startup sweep without DDL opt-in'
    );

    fs.writeFileSync(serverPath, server);
  } else {
    if (!server.includes("getMysqlPool:()=>sessionMysqlPool||mysqlPool")) throw new Error(MARKER + ': isolated session pool binding missing.');
  }

  const queryGuardPath = path.join(root, 'enterprise', 'v56133-mysql-query-guard.js');
  let queryGuard = fs.readFileSync(queryGuardPath, 'utf8');
  if (!queryGuard.includes(MARKER)) {
    const runFreshOld = "String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase() !== 'writer' && sqlInfo.isDdl";
    const runFreshNew = "(String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase() !== 'writer' || String(process.env.ENABLE_DDL || '').trim().toLowerCase() !== 'true') && sqlInfo.isDdl";
    const connectionOld = "String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase() !== 'writer' && sbcClassifySql(args[0]).isDdl";
    const connectionNew = "(String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase() !== 'writer' || String(process.env.ENABLE_DDL || '').trim().toLowerCase() !== 'true') && sbcClassifySql(args[0]).isDdl";
    if (!queryGuard.includes(runFreshOld) || !queryGuard.includes(connectionOld)) {
      throw new Error(MARKER + ': expected Preview DDL guard anchors were not found.');
    }
    queryGuard = onceText(queryGuard, runFreshOld, runFreshNew, 'explicit DDL opt-in in pooled queries');
    queryGuard = onceText(queryGuard, connectionOld, connectionNew, 'explicit DDL opt-in in leased connections');
    queryGuard = queryGuard.replace('const SBC_V6523_READ_QUERY_CANCEL', 'const ' + MARKER + ' = true;\n// const SBC_V6523_READ_QUERY_CANCEL');
    fs.writeFileSync(queryGuardPath, queryGuard);
  }

  const helperSource = path.join(__dirname, 'durable-session-secret.js');
  const helperTarget = path.join(root, 'enterprise', 'durable-session-secret.js');
  fs.copyFileSync(helperSource, helperTarget);

    server = onceText(
      server,
      "    await RUNTIME_GATE.ensureSchema();\n    // Migration ledger is created/reconciled by ensureEnterpriseSchema() below.",
      "    // " + MARKER + ": create a small auth-only pool before schema/recovery work begins. Login is separately gated until recovery evaluation completes.\n    try {\n      sessionMysqlPool = wrapMySQLPool(mysql.createPool({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),waitForConnections:true,connectionLimit:2,maxIdle:1,idleTimeout:Number(process.env.SBC_DB_IDLE_TIMEOUT_MS||5000),queueLimit:10,enableKeepAlive:true,keepAliveInitialDelay:Number(process.env.SBC_DB_KEEPALIVE_INITIAL_DELAY_MS||10000),connectTimeout:Number(process.env.SBC_DB_CONNECT_TIMEOUT_MS||10000),charset:'utf8mb4'}), {attempts:2,metrics:{queries:0,retries:0,recycled:0,failures:0,active:0},onRetry:info=>console.warn('[SBC AUTH MYSQL] transient '+info.operation+' retry '+info.attempt+': '+(info.code||info.message))});\n      console.log('[" + MARKER + "] dedicated durable-session pool initialized; maxConnections=2.');\n    } catch (sessionPoolError) { sessionMysqlPool = null; console.warn('[" + MARKER + "] dedicated session pool unavailable; shared MySQL pool fallback remains fail-closed:',String(sessionPoolError&&sessionPoolError.message||sessionPoolError)); }\n    await RUNTIME_GATE.ensureSchema();\n    // Migration ledger is created/reconciled by ensureEnterpriseSchema() below.",
      'early dedicated session pool initialization'
    );

    server = onceText(
      server,
      "app.post('/api/login',rateLimit(),async(req,res)=>{\n  try{\n    if(!MYSQL_RECOVERY_REQUIRED) ensureCoreTeamProfiles();",
      "app.post('/api/login',rateLimit(),async(req,res)=>{\n  if(!MYSQL_RECOVERY_EVALUATED) return res.status(503).json({ok:false,error:'SBC is still verifying authoritative MySQL recovery. Retry sign-in shortly.',code:'MYSQL_RECOVERY_NOT_EVALUATED',retryable:true,requestId:req.requestId||null});\n  try{\n    if(!MYSQL_RECOVERY_REQUIRED) ensureCoreTeamProfiles();",
      'login gate while authoritative recovery evaluation is incomplete'
    );
    server = onceText(server, "  try{if(mysqlPool)await mysqlPool.end()}catch{}", "  try{if(sessionMysqlPool)await sessionMysqlPool.end()}catch{}\n  try{if(mysqlPool)await mysqlPool.end()}catch{}", 'close isolated session pool on shutdown');
    fs.writeFileSync(serverPath, server);

  const autopilotPath = path.join(root, 'enterprise', 'v56170-six-phase-autopilot.js');
  let autopilot = fs.readFileSync(autopilotPath, 'utf8');
  if (!autopilot.includes(MARKER)) {
    autopilot = onceText(
      autopilot,
      "async function phase4(c){if(c.autopilotCheckoutUrl)return {ok:true,existing:true,url:c.autopilotCheckoutUrl};if(!ctx.createSquarePaymentLinkForOrder)",
      "async function phase4(c){if(c.autopilotCheckoutUrl)return {ok:true,existing:true,url:c.autopilotCheckoutUrl};if(!Number.isSafeInteger(Number(c.tenantId))||Number(c.tenantId)<=0)return {ok:false,held:true,reason:'TENANT_CONTEXT_REQUIRED',requiresOwnerReview:true};if(!ctx.createSquarePaymentLinkForOrder)",
      'autopilot checkout tenant guard'
    );
    autopilot = onceText(
      autopilot,
      "order={id:ctx.id('ord'),customerId:c.id,customerName:",
      "order={id:ctx.id('ord'),tenantId:Number(c.tenantId),customerId:c.id,customerName:",
      'autopilot order tenant binding'
    );
    autopilot = onceText(
      autopilot,
      "const checkout=await ctx.createSquarePaymentLinkForOrder(order,{user:{id:'v56170-autopilot',name:'SBC Closed-Loop Autopilot'}});",
      "if(!Number.isSafeInteger(Number(order.tenantId))||Number(order.tenantId)!==Number(c.tenantId))return {ok:false,held:true,reason:'ORDER_TENANT_MISMATCH',requiresOwnerReview:true};const checkout=await ctx.createSquarePaymentLinkForOrder(order,{tenantId:Number(c.tenantId),user:{id:'v56170-autopilot',name:'SBC Closed-Loop Autopilot',tenantId:Number(c.tenantId)}});",
      'autopilot order tenant match'
    );
    fs.writeFileSync(autopilotPath, autopilot);
  }

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center') throw new Error(MARKER + ': unexpected package identity.');
  if (pkg.version !== VERSION) {
    if (pkg.version !== '65.1.31') throw new Error(MARKER + ': expected 65.1.31 source, found ' + pkg.version);
    pkg.version = VERSION;
    pkg.description = 'SBC OS V65.1.32 durable authentication and tenant-context stability';
  }
  const testPath = path.join(__dirname, 'v6532-published-auth-stability-test.js');
  const testTarget = path.join(root, 'scripts', 'v6532-published-auth-stability-test.js');
  fs.copyFileSync(testPath, testTarget);
  if (!pkg.scripts['test:v6532-auth-stability']) pkg.scripts['test:v6532-auth-stability'] = 'node scripts/v6532-published-auth-stability-test.js';
  if (!pkg.scripts['test:all'].includes('v6532-published-auth-stability-test.js')) pkg.scripts['test:all'] += ' && node scripts/v6532-published-auth-stability-test.js';
  writeJson(pkgPath, pkg);

  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = VERSION;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = VERSION;
      lock.packages[''].description = pkg.description;
      lock.packages[''].scripts = pkg.scripts;
    }
    writeJson(lockPath, lock);
  }

  const identityPath = path.join(root, 'config', 'release-identity.js');
  if (fs.existsSync(identityPath)) {
    let identity = fs.readFileSync(identityPath, 'utf8');
    identity = identity.replace(/const RELEASE_VERSION = '[^']+';/, "const RELEASE_VERSION = '" + VERSION + "';");
    identity = identity.replace(/const RELEASE_NAME = '[^']+';/, "const RELEASE_NAME = 'PUBLISHED_AUTH_STABILITY';");
    identity = identity.replace(/major:\d+,minor:\d+,patch:\d+/, 'major:65,minor:1,patch:32');
    fs.writeFileSync(identityPath, identity);
  }

  const htmlPath = path.join(root, 'public', 'index.html');
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/(<title>[^<]*SBC Business Command Center[^<]*— V)65\.1\.31(<\/title>)/i, '$1' + VERSION + '$2');
    html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1Successful By Choice private business operating system · V' + VERSION + '$2');
    fs.writeFileSync(htmlPath, html);
  }
  const swPath = path.join(root, 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8');
    sw = onceText(sw, "const CACHE='sbc-static-v65-1-31';", "const CACHE='sbc-static-v65-1-33';", 'browser cache identity');
    fs.writeFileSync(swPath, sw);
  }

  return { marker: MARKER, version: VERSION };
}

module.exports = { apply, MARKER, VERSION };
