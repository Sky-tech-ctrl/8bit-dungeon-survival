// ==================== 标题界面 ====================
//
// 职责边界：
//   · 标题界面只负责「入口」—— 展示、以及把玩家送进已有的登录/存档流程
//   · 登录框、存档槽、设备选择这些既有逻辑一概复用（engine.js 里那套），
//     标题界面通过 game._showAuth() / game._showSave() 调它们
//
// 三个选项的去向：
//   开始新游戏 → 未登录先登录 → 存档界面（挑一个空槽）
//   读取存档   → 未登录先登录 → 存档界面（挑一个已有存档）
//   新手教程   → 教程面板，不需要登录
//
// 左侧记事本 → 「游戏心得」，纯文本，登录后存服务器，未登录存本地
// 彩蛋       → 在心得里写下 mj / MJ，或在标题界面直接敲 m-j
// ============================================================================

const TitleScreen = (() => {
  const LS_NOTES = 'game_notes_local';
  let el = null;
  let game = null;
  let notesTimer = null;
  let spiderTimer = null;
  let keyBuf = '';

  // ---------------------------------------------------------------- 显示

  function show() {
    if (!el) return;
    el.classList.remove('hidden');
    // 入场动画放完再挂上循环晃动的 class，两个 animation 才不会打架
    const z = document.getElementById('tsZombie');
    if (z) {
      z.classList.remove('idle');
      setTimeout(() => z.classList.add('idle'), 600);
    }
    Sound.playBGM('title');
    refreshStatus();
  }

  function hide() {
    if (el) el.classList.add('hidden');
  }

  // ------------------------------------------------------------ 状态栏

  async function refreshStatus() {
    const box = document.getElementById('tsStatus');
    if (!box) return;
    const online = AuthAPI.mode === 'remote';
    let who = null;
    try { who = await AuthAPI.current(); } catch (_) {}

    box.innerHTML =
      '<div><span class="dot ' + (online ? 'on' : 'off') + '"></span>' +
      (online ? '云端存档（后端已连接）' : '本地存档（未连接后端）') +
      ' · <a id="tsCfgBackend">设置</a></div>' +
      '<div>' + (who
        ? '当前账号：<span class="who">' + escapeHTML(who) + '</span> · <a id="tsLogout">退出登录</a>'
        : '尚未登录 · 开始游戏时会提示登录') + '</div>' +
      '<div><a id="tsBgm">' + (Sound.bgmOn ? '🎵 音乐 开' : '🔇 音乐 关') + '</a>' +
      ' · <a id="tsSfx">' + (Sound.sfxOn ? '🔔 音效 开' : '🔕 音效 关') + '</a></div>';

    const cfg = document.getElementById('tsCfgBackend');
    if (cfg) cfg.onclick = configureBackend;
    const lo = document.getElementById('tsLogout');
    if (lo) lo.onclick = async () => { await AuthAPI.logout(); refreshStatus(); };
    const bg = document.getElementById('tsBgm');
    if (bg) bg.onclick = () => { Sound.setBGM(!Sound.bgmOn); refreshStatus(); };
    const sf = document.getElementById('tsSfx');
    if (sf) sf.onclick = () => {
      Sound.setSFX(!Sound.sfxOn);
      if (Sound.sfxOn) Sound.sfx('click');     // 打开时响一声，确认生效
      refreshStatus();
    };
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function configureBackend() {
    const cur = (window.API_BASE || localStorage.getItem('api_base') || '');
    const v = prompt(
      '后端地址（留空则使用本地存档）\n\n' +
      '例如在本机跑 node server/index.js 后填：\n' +
      'http://localhost:8080',
      cur);
    if (v === null) return;
    const mode = await AuthAPI.setBase(v.trim());
    refreshStatus();
    alert(mode === 'remote' ? '已连接后端，存档将保存到服务器。' : '未探测到后端，继续使用本地存档。');
  }

  // -------------------------------------------------------- 三个选项

  async function onNewGame() {
    if (await AuthAPI.isLoggedIn()) {
      hide();
      game._showSave('new');
    } else {
      hide();
      game._showAuth('new');
    }
  }

  async function onLoadGame() {
    if (await AuthAPI.isLoggedIn()) {
      hide();
      game._showSave('load');
    } else {
      hide();
      game._showAuth('load');
    }
  }

  function onTutorial() {
    document.getElementById('tutorialModal').classList.remove('hidden');
  }

  // -------------------------------------------------- 游戏心得（记事本）

  async function openNotes() {
    const modal = document.getElementById('notesModal');
    const area = document.getElementById('notesArea');
    const meta = document.getElementById('notesSaved');
    meta.textContent = '';
    area.value = await loadNotes();
    modal.classList.remove('hidden');
    setTimeout(() => area.focus(), 30);
    updateNotesCount();
  }

  async function loadNotes() {
    // 登录 + 有后端 → 存服务器（换设备也能看到）；否则退回 localStorage
    if (AuthAPI.mode === 'remote' && await AuthAPI.isLoggedIn()) {
      try {
        const res = await fetch(AuthAPI.base + '/api/notes', {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('api_token') || '') },
        });
        const j = await res.json();
        if (j && j.ok) return j.notes || '';
      } catch (_) { /* 网络出问题就退回本地，别让玩家写的东西打不开 */ }
    }
    try { return localStorage.getItem(LS_NOTES) || ''; } catch (_) { return ''; }
  }

  async function saveNotes(text) {
    try { localStorage.setItem(LS_NOTES, text); } catch (_) {}   // 本地永远留一份兜底
    if (AuthAPI.mode === 'remote' && await AuthAPI.isLoggedIn()) {
      try {
        await fetch(AuthAPI.base + '/api/notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('api_token') || ''),
          },
          body: JSON.stringify({ notes: text }),
        });
        return 'cloud';
      } catch (_) { return 'local'; }
    }
    return 'local';
  }

  function updateNotesCount() {
    const area = document.getElementById('notesArea');
    const c = document.getElementById('notesCount');
    if (area && c) c.textContent = area.value.length + ' / 20000 字';
  }

  // ---------------------------------------------------- 彩蛋：蜘蛛侠

  /** mj / MJ —— 大小写都认。 */
  function isTrigger(s) {
    return /mj/i.test(s);
  }

  function dropSpider() {
    const sp = document.getElementById('tsSpider');
    const fl = document.getElementById('tsFlash');
    if (!sp || sp.classList.contains('show')) return;   // 正在挂着就不重复触发

    if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    Sound.sfx('upgrade');       // 彩蛋值得一段有仪式感的音

    // 落点按画面实际位置算。蜘蛛侠是 position:fixed 挂在 body 上的
    //（这样才能压过所有面板），但如果只让它停在视口顶端，
    // 它就吊在游戏画面上方的黑边里，和美术完全脱节。
    // 这里让它垂到画面内约 12% 的高度，正好落在标题的夜空区域。
    const gc = document.getElementById('gameContainer');
    if (gc) {
      const r = gc.getBoundingClientRect();
      sp.style.setProperty('--drop-to', Math.max(0, Math.round(r.top + r.height * 0.12)) + 'px');
    }
    sp.classList.add('show');

    clearTimeout(spiderTimer);
    spiderTimer = setTimeout(() => {                    // 挂 6 秒后自己缩回去
      sp.style.transition = 'transform .8s cubic-bezier(.6,-0.2,.8,.4)';
      sp.style.transform = 'translateY(-130%)';
      setTimeout(() => {
        sp.classList.remove('show');
        sp.style.transition = '';
        sp.style.transform = '';
      }, 820);
    }, 6000);
  }

  /** 标题界面上直接敲字母也能触发，不必先打开记事本。 */
  function onGlobalKey(e) {
    if (!el || el.classList.contains('hidden')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;  // 输入框里另有处理
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    keyBuf = (keyBuf + e.key).slice(-8);
    if (isTrigger(keyBuf)) { dropSpider(); keyBuf = ''; }
  }

  // ---------------------------------------------------------------- 装配

  function init(gameRef) {
    game = gameRef;
    el = document.getElementById('titleScreen');
    if (!el) return;

    document.querySelectorAll('.ts-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.sfx('click');
        const act = btn.dataset.act;
        if (act === 'new') onNewGame();
        else if (act === 'load') onLoadGame();
        else if (act === 'tutorial') onTutorial();
      });
    });

    const pad = document.getElementById('tsNotepad');
    if (pad) pad.addEventListener('click', () => { Sound.sfx('click'); openNotes(); });

    // ---- 心得面板 ----
    const area = document.getElementById('notesArea');
    const meta = document.getElementById('notesSaved');
    if (area) {
      area.addEventListener('input', () => {
        updateNotesCount();
        if (isTrigger(area.value)) dropSpider();          // 写下 mj 立刻触发
        // 停止输入 600ms 后自动保存，不用玩家点按钮
        clearTimeout(notesTimer);
        meta.textContent = '输入中…';
        meta.className = '';
        notesTimer = setTimeout(async () => {
          const where = await saveNotes(area.value);
          meta.textContent = where === 'cloud' ? '已保存到云端 ✓' : '已保存到本机 ✓';
          meta.className = 'saved';
        }, 600);
      });
    }
    bindClose('notesClose', 'notesModal', async () => {
      clearTimeout(notesTimer);
      if (area) await saveNotes(area.value);
    });
    bindClose('tutorialClose', 'tutorialModal');

    // 点遮罩空白处也能关
    ['notesModal', 'tutorialModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m) m.addEventListener('mousedown', e => { if (e.target === m) m.classList.add('hidden'); });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['notesModal', 'tutorialModal'].forEach(id => {
          const m = document.getElementById(id);
          if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
        });
      }
      onGlobalKey(e);
    });

    // 先探测后端，再显示界面 —— 这样状态栏一出来就是准的，不会先显示
    // 「本地存档」再跳成「云端存档」
    AuthAPI.init().then(() => { show(); }).catch(() => show());
  }

  function bindClose(btnId, modalId, before) {
    const b = document.getElementById(btnId);
    if (!b) return;
    b.addEventListener('click', async () => {
      if (before) await before();
      document.getElementById(modalId).classList.add('hidden');
    });
  }

  return { init, show, hide, refreshStatus, dropSpider };
})();

window.TitleScreen = TitleScreen;
