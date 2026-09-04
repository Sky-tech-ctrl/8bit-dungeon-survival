// ==================== 账号 / 存档 统一接口层（可插拔后端）====================
//
// 这一层的存在意义：**同一套调用，两种后端**。
//
//   · 探测到后端（server/index.js 在跑）→ 走 HTTP，账号和存档存在服务器上，
//     换设备、换浏览器都能读到自己的存档
//   · 探测不到 → 自动退回 localStorage（复用原有的 UserSystem）
//
// 所以游戏部署在 GitHub Pages 这种纯静态环境上照样能玩，
// 想要真后端时把 server 跑起来即可，前端一行都不用改。
//
// 后端地址的确定顺序：
//   1. window.API_BASE          （在 index.html 里写死）
//   2. localStorage['api_base'] （玩家在标题界面里自己填）
//   3. 同源                     （用 node server/index.js 同时托管静态文件时）
//
// 所有方法一律返回 Promise —— 本地模式下也是，
// 这样上层代码不必关心当前到底连没连后端。
// ============================================================================

const AuthAPI = (() => {
  const LS_BASE = 'api_base';
  const LS_TOKEN = 'api_token';
  const LS_USER = 'api_user';
  const PROBE_TIMEOUT = 2500;

  let base = '';
  let mode = 'local';        // 'local' | 'remote'
  let token = '';
  let username = null;
  let ready = null;          // init() 的 Promise，保证只探测一次

  // ---------------------------------------------------------------- 工具

  function normalizeBase(v) {
    if (!v) return '';
    return String(v).trim().replace(/\/+$/, '');
  }

  /** fetch + 超时。探测后端时必须有超时，否则地址填错会让标题界面一直转圈。 */
  async function fetchT(url, opts = {}, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetchT(base + path, Object.assign({}, opts, { headers }));
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (res.status === 401) {           // token 过期 → 清掉，回到未登录态
      token = ''; username = null;
      try { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); } catch (_) {}
    }
    if (!res.ok) {
      return { ok: false, msg: (data && data.msg) || ('服务器错误 ' + res.status) };
    }
    return data || { ok: false, msg: '响应为空' };
  }

  function saveSession(t, u) {
    token = t || '';
    username = u || null;
    try {
      if (token) localStorage.setItem(LS_TOKEN, token); else localStorage.removeItem(LS_TOKEN);
      if (username) localStorage.setItem(LS_USER, username); else localStorage.removeItem(LS_USER);
    } catch (_) {}
  }

  // ---------------------------------------------------------------- 初始化

  /**
   * 探测后端是否可用。只跑一次，结果缓存在 ready 里。
   * 探测失败不是错误 —— 那只是意味着「这次以本地模式运行」。
   */
  function init() {
    if (ready) return ready;
    ready = (async () => {
      let candidate = normalizeBase(window.API_BASE);
      if (!candidate) {
        try { candidate = normalizeBase(localStorage.getItem(LS_BASE)); } catch (_) {}
      }
      // 同源兜底：只有当页面本身是 http(s) 提供的才有意义（file:// 下没有后端）
      if (!candidate && /^https?:$/.test(location.protocol)) candidate = '';

      const tryBases = candidate ? [candidate] : [''];
      for (const b of tryBases) {
        try {
          const res = await fetchT(b + '/api/health', { method: 'GET' }, PROBE_TIMEOUT);
          if (res.ok) {
            const j = await res.json();
            if (j && j.ok) {
              base = b;
              mode = 'remote';
              try {
                token = localStorage.getItem(LS_TOKEN) || '';
                username = localStorage.getItem(LS_USER) || null;
              } catch (_) {}
              if (token) {                       // 验一下旧 token 还活着没
                const me = await api('/api/me');
                if (me.ok) username = me.username;
                else saveSession('', null);
              }
              return mode;
            }
          }
        } catch (_) { /* 探测失败就是本地模式，不是错误 */ }
      }
      mode = 'local';
      return mode;
    })();
    return ready;
  }

  // ---------------------------------------------------------------- 账号

  async function register(u, p) {
    await init();
    if (mode === 'local') return UserSystem.register(u, p);
    const r = await api('/api/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    if (r.ok) saveSession(r.token, r.username);
    return r;
  }

  async function login(u, p) {
    await init();
    if (mode === 'local') return UserSystem.login(u, p);
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    if (r.ok) saveSession(r.token, r.username);
    return r;
  }

  async function logout() {
    await init();
    if (mode === 'local') { UserSystem.logout(); return { ok: true }; }
    try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
    saveSession('', null);
    return { ok: true };
  }

  async function current() {
    await init();
    return mode === 'local' ? UserSystem.current() : username;
  }

  async function isLoggedIn() {
    return !!(await current());
  }

  // ---------------------------------------------------------------- 存档

  async function listSaves() {
    await init();
    if (mode === 'local') return UserSystem.listSaves();
    const r = await api('/api/saves');
    return r.ok ? r.slots : [];
  }

  async function save(slot, snapshot, name) {
    await init();
    if (mode === 'local') return UserSystem.save(slot, snapshot, name);
    return api('/api/saves/' + slot, {
      method: 'PUT',
      body: JSON.stringify({ name: name, snapshot: snapshot }),
    });
  }

  async function load(slot) {
    await init();
    if (mode === 'local') return UserSystem.load(slot);
    const r = await api('/api/saves/' + slot);
    return r.ok ? r.save : null;
  }

  async function remove(slot) {
    await init();
    if (mode === 'local') return UserSystem.remove(slot);
    return api('/api/saves/' + slot, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------- 其它

  /** 玩家在标题界面手动填后端地址后调用：重置探测状态并重新连接。 */
  async function setBase(url) {
    try {
      if (url) localStorage.setItem(LS_BASE, normalizeBase(url));
      else localStorage.removeItem(LS_BASE);
    } catch (_) {}
    window.API_BASE = normalizeBase(url);
    ready = null; base = ''; mode = 'local';
    return init();
  }

  return {
    init, setBase,
    get mode() { return mode; },
    get base() { return base; },
    register, login, logout, current, isLoggedIn,
    listSaves, save, load, remove,
    MAX_SAVES: 10,
  };
})();

window.AuthAPI = AuthAPI;
