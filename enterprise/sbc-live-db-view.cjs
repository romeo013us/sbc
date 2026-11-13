'use strict';
// Real-time read/write view of the authoritative in-memory CRM object.
// On GoDaddy, server.js mounts routes with a locally loaded db, then
// readRelational() replaces that binding with MySQL-hydrated data.
// Capturing the old db in Website Production modules makes their APIs
// read empty/stale local records. This view resolves the current binding
// on every property access, without migrating, cloning or inventing tenants.
function createLiveDbView(getCurrentDb) {
  if (typeof getCurrentDb !== 'function') throw new TypeError('LIVE_DB_RESOLVER_REQUIRED');
  const current = () => {
    const db = getCurrentDb();
    if (!db || typeof db !== 'object' || Array.isArray(db))
      throw new Error('LIVE_DB_NOT_READY');
    return db;
  };
  return new Proxy(Object.create(null), {
    get(_target, key) { return Reflect.get(current(), key); },
    set(_target, key, value) { return Reflect.set(current(), key, value); },
    has(_target, key) { return Reflect.has(current(), key); },
    ownKeys() { return Reflect.ownKeys(current()); },
    getOwnPropertyDescriptor(_target, key) {
      const desc = Reflect.getOwnPropertyDescriptor(current(), key);
      return desc ? {...desc, configurable:true} : undefined;
    }
  });
}
module.exports = {createLiveDbView};
