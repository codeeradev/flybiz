// utils/metaCache.util.js
//
// Minimal in-memory TTL cache. The dashboard's overview, trends, and posts
// widgets all load within moments of each other and often re-request
// overlapping Graph API data (e.g. the same posts list). Caching that for
// a few minutes cuts Graph API calls dramatically without serving stale
// analytics — insights data doesn't need to be second-fresh.
//
// Single-instance only. For a multi-instance deployment, swap this Map for
// Redis behind the same get/set/del interface — nothing else needs to change.

const store = new Map();

function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function set(key, value, ttlMs = 5 * 60_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function del(key) {
  store.delete(key);
}

function delPrefix(prefix) {
  for (const key of store.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) store.delete(key);
  }
}

function memoKey(...parts) {
  return parts.filter(Boolean).join(":");
}

module.exports = { get, set, del, delPrefix, memoKey };