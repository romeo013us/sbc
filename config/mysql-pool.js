'use strict';

const mysql = require('mysql2/promise');
const {wrapPool} = require('../enterprise/v56133-mysql-query-guard');

/**
 * SBC V64.3.3 governed worker pool.
 * Defaults are deliberately conservative for shared/cPanel MySQL.
 * No new secrets are required; operational limits are environment knobs.
 */
function createMysqlPool(env = process.env) {
  const connectionLimit = Math.max(2, Math.min(8, Number(env.SBC_WORKER_DB_CONNECTION_LIMIT || env.MYSQL_POOL_CONNECTION_LIMIT || 4)));
  const queueLimit = Math.max(10, Math.min(200, Number(env.SBC_WORKER_DB_QUEUE_LIMIT || 50)));
  const idleTimeout = Math.max(1000, Math.min(60000, Number(env.SBC_WORKER_DB_IDLE_TIMEOUT_MS || 10000)));
  const pool = mysql.createPool({
    host: env.DB_HOST || env.MYSQL_HOST,
    port: Number(env.DB_PORT || env.MYSQL_PORT || 3306),
    user: env.DB_USER || env.MYSQL_USER,
    password: env.DB_PASSWORD || env.MYSQL_PASSWORD,
    database: env.DB_NAME || env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit,
    queueLimit,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    maxIdle: connectionLimit,
    idleTimeout
  });
  return wrapPool(pool,{attempts:3,onRetry:info=>console.warn(`[SBC MYSQL] worker ${info.operation} retry ${info.attempt}: ${info.code||info.message}`)});
}

module.exports = { createMysqlPool };
