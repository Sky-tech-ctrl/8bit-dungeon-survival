// ==================== 主线模式 UI ====================
//
// 十关，每关只多解锁一种房间。这样安排是为了让学习曲线成立 ——
// 第一关只有金矿，玩家被迫先把「攒钱」这一件事理解透；
// 之后每关只多一个新东西，而不是一上来把十种房间糊玩家一脸。
//
// 石碑上只有三个选项槽（美术就是按三个画的），所以主线入口不新开一格，
// 而是把「开始新游戏」做成一次模式选择：主线 / 无尽。
//
// 进度存在 localStorage，按账号分开 —— 换账号不该继承别人的进度。
// ============================================================================

const CampaignUI = (() => {
  const LS_PREFIX = 'campaign_progress_';
  const LS_DEVICE = 'game_device';
  let game = null;

  // 主线模式绕开了存档界面，而设备选择原本只在那里 ——
  // 结果手机玩家进主线只能拿到默认的电脑端布局。所以关卡选择界面
  // 必须自带一份设备选择，并把结果记下来，下次不用再点。
  function savedDevice() {
    try {
      const v = localStorage.getItem(LS_DEVICE);
      if (v === 'pc' || v === 'mobile') return v;
    } catch (_) {}
    if (game && game.deviceMode) return game.deviceMode;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent || '') ? 'mobile' : 'pc';
  }

  function rememberDevice(v) {
    try { localStorage.setItem(LS_DEVICE, v); } catch (_) {}
  }

  function init(g) { game = g; }

  // ---------------------------------------------------------------- 进度

  function key(user) { return LS_PREFIX + (user || '_local'); }

  /** 已通关的最高关数；0 表示一关都没过。 */
  function getProgress(user) {
    try { return parseInt(localStorage.getItem(key(user)) || '0', 10) || 0; }
    catch (_) { return 0; }
  }

  function setProgress(user, level) {
    try {
      if (level > getProgress(user)) localStorage.setItem(key(user), String(level));
    } catch (_) {}
  }

  async function currentUser() {
    try { return (await AuthAPI.current()) || null; } catch (_) { return null; }
  }

  // ---------------------------------------------------------------- 模式选择

  /** 「开始新游戏」的第一步：主线还是无尽。 */
  function askMode(onEndless) {
    const m = ensureModal('modeModal', card => {
      card.innerHTML =
        '<div class="modal-title">▶ 选择模式</div>' +
        '<div class="modal-sub">主线循序渐进，无尽一次全开</div>';
      const mk = (title, sub, cls) => {
        const b = document.createElement('button');
        b.className = 'modal-btn ' + cls;
        b.innerHTML = '<b>' + title + '</b><br><span style="font-size:12px;opacity:.8">' + sub + '</span>';
        b.style.marginTop = '10px';
        b.style.lineHeight = '1.5';
        return b;
      };
      const a = mk('🏰 主线模式', '十关，每关解锁一种新房间', 'modal-btn-primary');
      a.onclick = () => { Sound.sfx('click'); close(m); openLevelSelect(); };
      const b = mk('♾ 无尽模式', '所有房间全开，打到守不住为止', 'modal-btn-secondary');
      b.onclick = () => { Sound.sfx('click'); close(m); onEndless(); };
      const back = mk('← 返回标题', '', 'modal-btn-secondary');
      back.onclick = () => { close(m); if (window.TitleScreen) TitleScreen.show(); };
      card.appendChild(a); card.appendChild(b); card.appendChild(back);
    });
    open(m);
  }

  // ---------------------------------------------------------------- 关卡选择

  async function openLevelSelect() {
    const user = await currentUser();
    const done = getProgress(user);
    const m = ensureModal('levelModal', () => {}, true);
    const card = m.querySelector('.modal-card');
    card.innerHTML = '<div class="modal-title">🏰 主线模式</div>' +
      '<div class="modal-sub">已通关 ' + done + ' / ' + CAMPAIGN.length + ' 关　·　每关解锁一种新房间</div>';

    const grid = document.createElement('div');
    grid.className = 'lv-grid';
    CAMPAIGN.forEach((cfg, i) => {
      const lv = i + 1;
      // 只能挑已通关的关卡 +1，防止跳关把解锁顺序打乱
      const unlocked = lv <= done + 1;
      const cell = document.createElement('div');
      cell.className = 'lv-cell' + (unlocked ? '' : ' locked') + (lv <= done ? ' cleared' : '');
      cell.innerHTML =
        '<div class="lv-no">' + lv + '</div>' +
        '<div class="lv-name">' + (unlocked ? cfg.name : '???') + '</div>' +
        '<div class="lv-sub">' + (unlocked ? cfg.waves + ' 波' : '未解锁') + '</div>' +
        (lv <= done ? '<div class="lv-tick">✓</div>' : '');
      if (unlocked) {
        cell.title = cfg.desc;
        cell.onclick = () => { Sound.sfx('click'); close(m); startLevel(lv, m._device ? m._device() : null); };
      }
      grid.appendChild(cell);
    });
    card.appendChild(grid);

    const tip = document.createElement('div');
    tip.className = 'lv-tip';
    tip.textContent = '第 ' + CAMPAIGN_DISASTER_FROM + ' 关起会出现自然灾害：陨石、地震、火山喷发';
    card.appendChild(tip);

    // ---- 设备选择 ----
    let device = savedDevice();
    const ds = document.createElement('div');
    ds.className = 'device-section';
    ds.innerHTML = '<div class="ds-title">▼ 请选择你的设备类型 ▼</div>';
    const rowEl = document.createElement('div');
    rowEl.className = 'device-select-row';
    const hint = document.createElement('div');
    hint.className = 'ds-hint';
    const mk = (val, emoji, label) => {
      const b = document.createElement('button');
      b.className = 'ds-btn';
      b.innerHTML = '<span class="emoji">' + emoji + '</span>' + label;
      b.onclick = () => { device = val; rememberDevice(val); paint(); Sound.sfx('click'); };
      return b;
    };
    const pcB = mk('pc', '💻', '电脑端');
    const mbB = mk('mobile', '📱', '手机端');
    const paint = () => {
      pcB.classList.toggle('selected', device === 'pc');
      mbB.classList.toggle('selected', device === 'mobile');
      hint.textContent = device === 'mobile'
        ? '📱 竖握使用 · 画面旋转横屏 · 摇杆+攻击'
        : '💻 WASD移动 · 空格/J挥剑 · 鼠标点击建造';
    };
    rowEl.appendChild(pcB); rowEl.appendChild(mbB);
    ds.appendChild(rowEl); ds.appendChild(hint);
    card.appendChild(ds);
    paint();
    m._device = () => device;

    const back = document.createElement('button');
    back.className = 'modal-btn modal-btn-secondary';
    back.textContent = '← 返回标题';
    back.style.marginTop = '14px';
    back.onclick = () => { close(m); if (window.TitleScreen) TitleScreen.show(); };
    card.appendChild(back);

    open(m);
  }

  // ---------------------------------------------------------------- 开打

  function startLevel(lv, device) {
    if (!game) return;
    const dev = device || savedDevice();
    rememberDevice(dev);
    game.beginCampaignLevel(lv);
    game.startAfterAuth(dev);
  }

  // ---------------------------------------------------------------- 通关结算

  async function onLevelCleared(level, cfg, hasNext) {
    const user = await currentUser();
    setProgress(user, level);

    const m = ensureModal('clearModal', () => {}, true);
    const card = m.querySelector('.modal-card');
    const unlocked = hasNext ? CAMPAIGN[level] : null;
    card.innerHTML =
      '<div class="modal-title">🎉 第 ' + level + ' 关通过</div>' +
      '<div class="modal-sub">' + cfg.name + '　·　守住了 ' + cfg.waves + ' 波</div>' +
      (unlocked
        ? '<div class="lv-unlock">新解锁：<b>' + ROOM_TYPES[unlocked.unlock].icon + ' ' +
          ROOM_TYPES[unlocked.unlock].name + '</b></div>'
        : '<div class="lv-unlock">🏆 全部十关已通关，恭喜！</div>');

    if (hasNext) {
      const nxt = document.createElement('button');
      nxt.className = 'modal-btn modal-btn-primary';
      nxt.textContent = '▶ 进入第 ' + (level + 1) + ' 关';
      nxt.onclick = () => { close(m); startLevel(level + 1, savedDevice()); };
      card.appendChild(nxt);
    }
    const back = document.createElement('button');
    back.className = 'modal-btn modal-btn-secondary';
    back.textContent = '← 返回关卡选择';
    back.style.marginTop = '8px';
    back.onclick = () => { close(m); openLevelSelect(); };
    card.appendChild(back);

    open(m);
  }

  // ---------------------------------------------------------------- 模态框工具

  function ensureModal(id, fill, rebuild) {
    let m = document.getElementById(id);
    if (m && !rebuild) return m;
    if (!m) {
      m = document.createElement('div');
      m.id = id;
      m.className = 'modal-mask hidden';
      const card = document.createElement('div');
      card.className = 'modal-card';
      m.appendChild(card);
      document.body.appendChild(m);
      fill(card);
    }
    return m;
  }

  function open(m) {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('saveModal').classList.add('hidden');
    if (window.TitleScreen) TitleScreen.hide();
    m.classList.remove('hidden');
  }

  function close(m) { m.classList.add('hidden'); }

  return { init, askMode, openLevelSelect, onLevelCleared, getProgress };
})();

window.CampaignUI = CampaignUI;
