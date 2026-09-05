// ==================== 开发者模式 ====================
//
// 入口：游戏中连续点击地表中央的**地窖门 7 次**（间隔别超过 2.5 秒）。
// 解锁后暂停面板里会多出一个 🛠 按钮，方便随时再打开。
//
// 面板刻意做成「不阻塞游戏」的浮动窗口，而不是模态框 ——
// 调参的意义就在于边改边看效果，弹个遮罩把画面挡住就本末倒置了。
//
// 解锁状态只存在于本次会话，刷新即失效：它是调试工具，不该变成常驻档位。
// ============================================================================

const DevMode = (() => {
  let game = null;
  let panel = null;

  function init(g) { game = g; }

  // ---------------------------------------------------------------- 面板

  function row(label, inner) {
    const d = document.createElement('div');
    d.className = 'dev-row';
    d.innerHTML = '<span class="dev-label">' + label + '</span>';
    d.appendChild(inner);
    return d;
  }

  function numberField(label, get, set, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'dev-field';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = opts.min != null ? opts.min : 0;
    if (opts.max != null) input.max = opts.max;
    input.value = get();
    const apply = document.createElement('button');
    apply.textContent = '应用';
    const commit = () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) set(v);
      input.value = get();
    };
    apply.onclick = commit;
    input.addEventListener('keydown', e => {
      e.stopPropagation();                       // 别让数字键漏进游戏的按键处理
      if (e.key === 'Enter') commit();
    });
    wrap.appendChild(input);
    wrap.appendChild(apply);
    if (opts.extra) {
      for (const [txt, fn] of opts.extra) {
        const b = document.createElement('button');
        b.textContent = txt;
        b.onclick = () => { fn(); input.value = get(); };
        wrap.appendChild(b);
      }
    }
    wrap._sync = () => { if (document.activeElement !== input) input.value = get(); };
    return row(label, wrap);
  }

  function toggleField(label, get, set) {
    const wrap = document.createElement('div');
    wrap.className = 'dev-field';
    const btn = document.createElement('button');
    const paint = () => {
      btn.textContent = get() ? '开' : '关';
      btn.className = get() ? 'dev-on' : '';
    };
    btn.onclick = () => { set(!get()); paint(); };
    paint();
    wrap.appendChild(btn);
    wrap._sync = paint;
    return row(label, wrap);
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'devPanel';

    const head = document.createElement('div');
    head.className = 'dev-head';
    head.innerHTML = '<b>🛠 开发者模式</b>';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.onclick = () => hide();
    head.appendChild(close);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'dev-body';
    panel.appendChild(body);

    const fields = [];
    const add = (el) => { fields.push(el); body.appendChild(el); };

    add(numberField('大门血量',
      () => Math.round(game.doorHp),
      v => { game.doorHp = Math.max(0, Math.min(game.doorMaxHp, v)); game.updateUI(); },
      { max: 9999, extra: [['回满', () => { game.doorHp = game.doorMaxHp; game.updateUI(); }]] }));

    add(numberField('玩家血量',
      () => Math.round(game.player.hp),
      v => { game.player.hp = Math.max(0, Math.min(game.player.maxHp, v)); game.updateUI(); },
      { max: 9999, extra: [['回满', () => { game.player.hp = game.player.maxHp; game.updateUI(); }]] }));

    add(numberField('波数',
      () => game.wave,
      v => { game.wave = Math.max(0, Math.floor(v)); game.updateUI(); },
      { max: 999, extra: [['+1 波', () => { game.wave++; game.updateUI(); }]] }));

    // 丧尸数量：设成目标值 —— 多了就删、少了就补，比「生成 N 只」更直观
    add(numberField('丧尸数量',
      () => game.zombies.length,
      v => setZombieCount(Math.max(0, Math.floor(v))),
      { max: 200, extra: [['清空', () => setZombieCount(0)], ['+5', () => setZombieCount(game.zombies.length + 5)]] }));

    add(toggleField('玩家无敌', () => game.dev.god, v => { game.dev.god = v; }));
    add(toggleField('大门无敌', () => game.dev.doorGod, v => { game.dev.doorGod = v; }));
    add(toggleField('无限资源', () => game.dev.infiniteRes, v => {
      game.dev.infiniteRes = v;
      if (v) game.updateUI();
    }));

    const foot = document.createElement('div');
    foot.className = 'dev-foot';
    const fill = document.createElement('button');
    fill.textContent = '资源给满';
    fill.onclick = () => {
      for (const k of Object.keys(game.resources)) game.resources[k] = game.capacity[k] || 999;
      game.updateUI();
    };
    const clearWave = document.createElement('button');
    clearWave.textContent = '秒杀全场';
    clearWave.onclick = () => { game.damageAllZombies(99999); };
    foot.appendChild(fill);
    foot.appendChild(clearWave);
    panel.appendChild(foot);

    const tip = document.createElement('div');
    tip.className = 'dev-tip';
    tip.textContent = '刷新页面即退出开发者模式';
    panel.appendChild(tip);

    document.body.appendChild(panel);

    // 数值会被游戏本身改动（掉血、刷怪），所以定时把没在编辑的字段刷新一遍
    panel._timer = setInterval(() => {
      for (const f of fields) {
        const w = f.querySelector('.dev-field');
        if (w && w._sync) w._sync();
      }
    }, 400);
  }

  /** 把场上丧尸数调整到目标值：多则删、少则补。 */
  function setZombieCount(target) {
    if (!game) return;
    while (game.zombies.length > target) game.zombies.pop();
    let guard = 0;
    while (game.zombies.length < target && guard++ < 300) game.spawnZombie();
  }

  // ---------------------------------------------------------------- 开关

  function show() {
    if (!game) return;
    if (!panel) build();
    panel.style.display = '';
    syncPauseBtn();
  }

  function hide() {
    if (panel) panel.style.display = 'none';
    syncPauseBtn();
  }

  function toggle() {
    if (!panel || panel.style.display === 'none') show();
    else hide();
  }

  /** 解锁后在暂停面板里补一个入口，省得每次都去点 7 下门。 */
  function syncPauseBtn() {
    const actions = document.querySelector('#pausePanel .pause-actions');
    if (!actions) return;
    let b = document.getElementById('devBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'devBtn';
      b.style.cssText = 'background:#3a2a4a;color:#d9f';
      b.onclick = (e) => { e.preventDefault(); b.blur(); toggle(); };
      actions.appendChild(b);
    }
    b.textContent = (panel && panel.style.display !== 'none') ? '🛠 关闭开发者' : '🛠 开发者模式';
  }

  return { init, show, hide, toggle, get opened() { return !!panel; } };
})();

window.DevMode = DevMode;
