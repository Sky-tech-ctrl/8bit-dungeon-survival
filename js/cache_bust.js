// ==================== 浏览器端「旧缓存全清理」模块 ====================
// 每次部署新版本后立即执行，确保所有用户看不到旧文件。
// 覆盖 4 个层面：
//   1. Service Worker 注册（若曾装过 PWA，会拦截一切静态请求 → 旧图/旧 JS 挥之不去）
//   2. CacheStorage / Cache API（workbox 或其它策略产生的命名缓存）
//   3. localStorage + sessionStorage（遗留的调试 key、旧版本存档、调试缓存）
//   4. indexedDB（常见于游戏资源预加载 / 数据持久化的历史库）
// 为防止重复执行，用一次性的 SESSION 标记记录；删除的 key 会在控制台打印，便于排查。

(function () {
  const MARK_KEY = '__cache_purged_v1__';
  if (window.sessionStorage && sessionStorage.getItem(MARK_KEY)) return;
  try { sessionStorage.setItem(MARK_KEY, '1'); } catch (_) {}

  const logs = [];
  function log(tag, msg) {
    logs.push(`[${tag}] ${msg}`);
  }

  // ---------- 1. Service Worker：全部注销 ----------
  (async function nukeSW() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
        log('SW', `unregistered scope=${r.scope}`);
      }
    } catch (e) {
      log('SW', `skip: ${e.message}`);
    }
  })();

  // ---------- 2. Cache API：清空所有命名缓存 ----------
  (async function nukeCacheAPI() {
    try {
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
        log('Cache', `deleted "${k}"`);
      }
    } catch (e) {
      log('Cache', `skip: ${e.message}`);
    }
  })();

  // ---------- 3. indexedDB：删除所有本域名的库 ----------
  (async function nukeIDB() {
    try {
      if (!window.indexedDB || typeof indexedDB.databases !== 'function') return;
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db && db.name) {
          indexedDB.deleteDatabase(db.name);
          log('IDB', `dropped "${db.name}"`);
        }
      }
    } catch (e) {
      log('IDB', `skip: ${e.message}`);
    }
  })();

  // ---------- 4. localStorage / sessionStorage：保留账号/存档，其余全清 ----------
  //     白名单：game_users（全部账号+存档）、game_current（当前登录态）
  (function nukeLS() {
    const WHITELIST = new Set(['game_users', 'game_current', MARK_KEY]);
    try {
      const kill = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !WHITELIST.has(k)) kill.push(k);
      }
      kill.forEach(k => { localStorage.removeItem(k); log('LS', `removed key="${k}"`); });
    } catch (e) { log('LS', `skip: ${e.message}`); }

    try {
      const kill = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && !WHITELIST.has(k)) kill.push(k);
      }
      kill.forEach(k => { sessionStorage.removeItem(k); log('SS', `removed key="${k}"`); });
    } catch (e) { log('SS', `skip: ${e.message}`); }
  })();

  if (logs.length && window.console) {
    console.log('%c🗑 旧缓存清理执行完毕', 'color:#ff8;font-size:14px;font-weight:bold');
    logs.forEach(l => console.log('   ' + l));
  }
})();
