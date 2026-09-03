// ==================== 用户系统 + 存档管理 ====================
// 纯前端实现：账号存储在 localStorage['game_users']，存档按账号独立保存
// 每账号最多 10 个存档槽

const UserSystem = (() => {
  const LS_USERS = 'game_users';       // 所有账号数据
  const LS_CURRENT = 'game_current';   // 当前登录账号
  const MAX_SAVES = 10;

  // ---- 简易哈希（前端无 crypto.subtle 时兜底，够用）----
  function hash(pwd) {
    let h = 5381;
    for (let i = 0; i < pwd.length; i++) {
      h = ((h << 5) + h + pwd.charCodeAt(i)) | 0;
    }
    // 叠加一次
    let h2 = 0;
    for (let i = pwd.length - 1; i >= 0; i--) {
      h2 = ((h2 << 6) + h2) ^ pwd.charCodeAt(i);
    }
    return (h ^ h2).toString(36);
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(LS_USERS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveUsers(obj) {
    localStorage.setItem(LS_USERS, JSON.stringify(obj));
  }

  // ---------- 账号 ----------

  function register(username, password) {
    username = (username || '').trim();
    password = password || '';
    if (username.length < 2) return { ok: false, msg: '用户名至少 2 个字符' };
    if (password.length < 3) return { ok: false, msg: '密码至少 3 个字符' };

    const users = loadUsers();
    if (users[username]) return { ok: false, msg: '该用户名已被占用' };

    users[username] = {
      pwdHash: hash(password),
      createdAt: Date.now(),
      saves: new Array(MAX_SAVES).fill(null), // 10 个存档槽
    };
    saveUsers(users);
    localStorage.setItem(LS_CURRENT, username);
    return { ok: true, msg: '注册成功', username };
  }

  function login(username, password) {
    username = (username || '').trim();
    password = password || '';

    const users = loadUsers();
    if (!users[username]) return { ok: false, msg: '用户不存在' };
    if (users[username].pwdHash !== hash(password)) {
      return { ok: false, msg: '密码错误' };
    }
    localStorage.setItem(LS_CURRENT, username);
    return { ok: true, msg: '登录成功', username };
  }

  function logout() {
    localStorage.removeItem(LS_CURRENT);
  }

  function current() {
    return localStorage.getItem(LS_CURRENT) || null;
  }

  function isLoggedIn() {
    return !!current();
  }

  function usersList() {
    return Object.keys(loadUsers());
  }

  // ---------- 存档（10 槽） ----------

  function _requireUser() {
    const u = current();
    if (!u) return null;
    const users = loadUsers();
    return users[u] ? { users, user: users[u], username: u } : null;
  }

  function listSaves() {
    const ctx = _requireUser();
    if (!ctx) return [];
    // 确保 saves 是长度 MAX_SAVES 的数组
    let saves = ctx.user.saves;
    if (!Array.isArray(saves) || saves.length !== MAX_SAVES) {
      saves = new Array(MAX_SAVES).fill(null);
      ctx.user.saves = saves;
      saveUsers(ctx.users);
    }
    return saves.map((s, i) => ({
      slot: i + 1,
      filled: !!s,
      name: s ? s.name : '',
      wave: s ? s.wave : 0,
      playTime: s ? s.playTime : 0,
      savedAt: s ? s.savedAt : 0,
    }));
  }

  function save(slot, snapshot, name) {
    // slot: 1~10
    if (slot < 1 || slot > MAX_SAVES) return { ok: false, msg: `槽位必须在 1-${MAX_SAVES}` };
    const ctx = _requireUser();
    if (!ctx) return { ok: false, msg: '未登录' };

    ctx.user.saves[slot - 1] = {
      name: (name || '').slice(0, 30) || `存档 ${slot}`,
      wave: snapshot.wave || 1,
      playTime: snapshot.playTime || 0,
      savedAt: Date.now(),
      data: JSON.parse(JSON.stringify(snapshot)), // 深拷贝
    };
    saveUsers(ctx.users);
    return { ok: true, msg: `已保存到槽位 ${slot}` };
  }

  function load(slot) {
    if (slot < 1 || slot > MAX_SAVES) return null;
    const ctx = _requireUser();
    if (!ctx) return null;
    const s = ctx.user.saves[slot - 1];
    return s ? s : null;
  }

  function remove(slot) {
    if (slot < 1 || slot > MAX_SAVES) return { ok: false, msg: '槽位无效' };
    const ctx = _requireUser();
    if (!ctx) return { ok: false, msg: '未登录' };
    ctx.user.saves[slot - 1] = null;
    saveUsers(ctx.users);
    return { ok: true, msg: `已删除槽位 ${slot}` };
  }

  return {
    MAX_SAVES,
    register, login, logout, current, isLoggedIn, usersList,
    listSaves, save, load, remove,
  };
})();

// 挂到 window，其他脚本通过 UserSystem.xxx 访问
window.UserSystem = UserSystem;
