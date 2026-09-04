/* ============================================================================
 * 8-BIT 地牢求生 —— 账号 / 存档 后端
 * ============================================================================
 * 刻意保持和前端一致的「零依赖」原则：只用 Node 内置模块
 * （http / crypto / fs / path），克隆下来 `node server/index.js` 就能跑，
 * 不需要 npm install，也不需要注册任何第三方服务。
 *
 * 它同时干两件事：
 *   1. 提供 /api/* 接口（注册、登录、10 个存档槽的读写删）
 *   2. 托管仓库根目录的静态文件 —— 所以直接开 http://localhost:8080 就能玩，
 *      前端会自动探测到同源后端并切换到「云端存档」模式
 *
 * 安全性说明（这是个玩具项目，但没有理由把密码存成明文）：
 *   · 密码用 scrypt + 每用户随机盐做哈希，只存哈希，不存原文
 *   · 比对哈希用 timingSafeEqual，避免时序侧信道
 *   · 会话是随机 32 字节的 token，有过期时间，存在服务端
 *   · 不是给公网裸奔用的：没有速率限制、没有 HTTPS。放公网请套一层反向代理。
 *
 * 用法：
 *     node server/index.js                  # 默认 8080
 *     PORT=3000 node server/index.js        # 换端口
 *     DB_FILE=/data/db.json node server/index.js
 * ==========================================================================*/

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const ROOT = path.resolve(__dirname, '..');            // 仓库根 = 静态资源目录
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const MAX_SAVES = 10;
const SESSION_TTL = 30 * 24 * 3600 * 1000;             // 30 天
const MAX_BODY = 4 * 1024 * 1024;                      // 单个存档上限 4MB

// ============================================================================
// 持久化：整个 db 常驻内存，写盘用「临时文件 + rename」保证原子性，
// 避免进程在写一半时被杀掉导致 db.json 损坏。
// ============================================================================

let db = { users: {}, sessions: {} };

function loadDB() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.users = db.users || {};
    db.sessions = db.sessions || {};
  } catch (_) {
    db = { users: {}, sessions: {} };
  }
  // 启动时顺手清掉过期会话
  const now = Date.now();
  for (const t of Object.keys(db.sessions)) {
    if (db.sessions[t].expires < now) delete db.sessions[t];
  }
}

let writeTimer = null;
function saveDB() {
  // 合并短时间内的多次写入：存档是玩家高频操作，没必要每次都落盘
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const tmp = DB_FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(db), 'utf8');
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.error('[db] 写入失败:', e.message);
    }
  }, 120);
}

// ============================================================================
// 密码与会话
// ============================================================================

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expected) {
  const actual = hashPassword(password, salt);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);      // 定长比较，不泄漏匹配了几位
}

function newToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { username, expires: Date.now() + SESSION_TTL };
  saveDB();
  return token;
}

/** 从 Authorization: Bearer <token> 解出用户名；无效返回 null。 */
function authenticate(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const sess = db.sessions[m[1]];
  if (!sess) return null;
  if (sess.expires < Date.now()) { delete db.sessions[m[1]]; saveDB(); return null; }
  return db.users[sess.username] ? sess.username : null;
}

function emptySaves() {
  return new Array(MAX_SAVES).fill(null);
}

// ============================================================================
// HTTP 小工具
// ============================================================================

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

// CORS：前端可能部署在 GitHub Pages，而后端在另一个域名/端口上，
// 不开 CORS 浏览器会直接拦掉请求。
function setCORS(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  // 目录穿越防护：解析后必须仍在 ROOT 之内
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // index.html 绝不缓存，否则改了前端玩家还看旧版
      'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=300',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ============================================================================
// 路由
// ============================================================================

async function handleAPI(req, res, urlPath) {
  const method = req.method.toUpperCase();

  // ---- 健康检查：前端就是靠它判断「后端在不在」 ----
  if (urlPath === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, service: '8bit-dungeon-survival', maxSaves: MAX_SAVES });
  }

  // ---- 注册 ----
  if (urlPath === '/api/register' && method === 'POST') {
    const b = await readBody(req);
    const username = String(b.username || '').trim();
    const password = String(b.password || '');
    if (username.length < 2 || username.length > 16) return sendJSON(res, 400, { ok: false, msg: '用户名需 2-16 个字符' });
    if (password.length < 3) return sendJSON(res, 400, { ok: false, msg: '密码至少 3 位' });
    if (db.users[username]) return sendJSON(res, 409, { ok: false, msg: '该用户名已被占用' });

    const salt = crypto.randomBytes(16).toString('hex');
    db.users[username] = {
      salt,
      hash: hashPassword(password, salt),
      createdAt: Date.now(),
      saves: emptySaves(),
      notes: '',
    };
    saveDB();
    return sendJSON(res, 200, { ok: true, msg: '注册成功', username, token: newToken(username) });
  }

  // ---- 登录 ----
  if (urlPath === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const username = String(b.username || '').trim();
    const password = String(b.password || '');
    const u = db.users[username];
    // 用户不存在和密码错误返回同一句话，不给撞库的人做用户名枚举
    if (!u || !verifyPassword(password, u.salt, u.hash)) {
      return sendJSON(res, 401, { ok: false, msg: '用户名或密码错误' });
    }
    return sendJSON(res, 200, { ok: true, msg: '登录成功', username, token: newToken(username) });
  }

  // ---- 以下全部需要登录 ----
  const me = authenticate(req);

  if (urlPath === '/api/logout' && method === 'POST') {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '');
    if (m) { delete db.sessions[m[1]]; saveDB(); }
    return sendJSON(res, 200, { ok: true });
  }

  if (!me) return sendJSON(res, 401, { ok: false, msg: '未登录或登录已过期' });

  if (urlPath === '/api/me' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, username: me });
  }

  // ---- 游戏心得（每账号一份纯文本）----
  if (urlPath === '/api/notes') {
    if (method === 'GET') return sendJSON(res, 200, { ok: true, notes: db.users[me].notes || '' });
    if (method === 'PUT') {
      const b = await readBody(req);
      db.users[me].notes = String(b.notes || '').slice(0, 20000);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }
  }

  // ---- 存档列表（只回元信息，不回整包快照，列表接口不该拖着几 MB 数据）----
  if (urlPath === '/api/saves' && method === 'GET') {
    const user = db.users[me];
    if (!Array.isArray(user.saves) || user.saves.length !== MAX_SAVES) user.saves = emptySaves();
    return sendJSON(res, 200, {
      ok: true,
      slots: user.saves.map((s, i) => ({
        slot: i + 1,
        filled: !!s,
        name: s ? s.name : '',
        wave: s ? s.wave : 0,
        playTime: s ? s.playTime : 0,
        savedAt: s ? s.savedAt : 0,
      })),
    });
  }

  // ---- 单个存档槽 ----
  const m = /^\/api\/saves\/(\d+)$/.exec(urlPath);
  if (m) {
    const slot = parseInt(m[1], 10);
    if (slot < 1 || slot > MAX_SAVES) return sendJSON(res, 400, { ok: false, msg: '槽位需在 1-' + MAX_SAVES });
    const user = db.users[me];
    if (!Array.isArray(user.saves) || user.saves.length !== MAX_SAVES) user.saves = emptySaves();

    if (method === 'GET') {
      const s = user.saves[slot - 1];
      if (!s) return sendJSON(res, 404, { ok: false, msg: '该槽位为空' });
      return sendJSON(res, 200, { ok: true, save: s });
    }
    if (method === 'PUT') {
      const b = await readBody(req);
      const snap = b.snapshot;
      if (!snap || typeof snap !== 'object') return sendJSON(res, 400, { ok: false, msg: '快照无效' });
      user.saves[slot - 1] = {
        name: String(b.name || '').slice(0, 30) || ('存档 ' + slot),
        wave: snap.wave || 1,
        playTime: snap.playTime || 0,
        savedAt: Date.now(),
        data: snap,
      };
      saveDB();
      return sendJSON(res, 200, { ok: true, msg: '已保存到槽位 ' + slot });
    }
    if (method === 'DELETE') {
      user.saves[slot - 1] = null;
      saveDB();
      return sendJSON(res, 200, { ok: true, msg: '已删除槽位 ' + slot });
    }
  }

  return sendJSON(res, 404, { ok: false, msg: '接口不存在' });
}

// ============================================================================
// 服务器
// ============================================================================

loadDB();

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  setCORS(res, req.headers.origin);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (urlPath.startsWith('/api/')) {
    handleAPI(req, res, urlPath).catch(err => {
      console.error('[api]', err);
      sendJSON(res, 400, { ok: false, msg: err.message || '请求处理失败' });
    });
    return;
  }
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  8-BIT 地牢求生 · 后端已启动');
  console.log('  ---------------------------------------------');
  console.log('  游戏地址   http://localhost:' + PORT + '/');
  console.log('  接口前缀   http://localhost:' + PORT + '/api');
  console.log('  数据文件   ' + DB_FILE);
  console.log('  账号数量   ' + Object.keys(db.users).length);
  console.log('');
  console.log('  前端会自动探测到同源后端并切到「云端存档」模式。');
  console.log('  若前端部署在别处（如 GitHub Pages），在标题界面右下角');
  console.log('  填入本机地址即可连接。');
  console.log('');
});

// 退出前把还没落盘的改动刷掉，避免丢掉最后一次存档
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    try {
      fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db), 'utf8');
      fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    } catch (_) {}
    process.exit(0);
  });
}
