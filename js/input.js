// ==================== 输入与设备控制 ====================
// 所有输入/设备方法挂载到 Game.prototype 上

// ---- 设备选择（电脑端/手机端） ----
Game.prototype.setupDeviceSelect = function() {
  const btns = document.querySelectorAll('#deviceSelect .device-btn');
  const startBtn = document.getElementById('startBtn');
  const hintM = document.getElementById('hintMobile');
  const hintP = document.getElementById('hintPC');
  const setDevice = (mode) => {
    this.deviceMode = mode;
    btns.forEach(b => b.classList.toggle('selected', b.dataset.device === mode));
    hintM.classList.toggle('hidden', mode !== 'mobile');
    hintP.classList.toggle('hidden', mode !== 'pc');
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    startBtn.style.cursor = 'pointer';
    // 显示/隐藏手机端虚拟按键
    const vpad = document.getElementById('virtualPad');
    if (vpad) vpad.style.display = mode === 'mobile' ? 'block' : 'none';
  };
  btns.forEach(b => b.addEventListener('click', () => setDevice(b.dataset.device)));
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')) {
    btns.forEach(b => b.style.boxShadow = b.dataset.device === 'mobile' ? '0 0 10px #6af' : '');
  } else {
    btns.forEach(b => b.style.boxShadow = b.dataset.device === 'pc' ? '0 0 10px #6af' : '');
  }
};

// ---- 应用设备模式 ----
Game.prototype.applyDeviceMode = function() {
  const container = document.getElementById('gameContainer');
  const body = document.body;
  body.classList.remove('mobile-mode');
  container.classList.remove('mobile');
  container.style.transform = '';
  container.style.transformOrigin = '';
  container.style.position = '';
  container.style.top = '';
  container.style.left = '';
  container.style.width = '';
  container.style.height = '';
  this.canvas.style.width = '';
  this.canvas.style.height = '';
  this._mobile = null;
  if (this.deviceMode === 'mobile') {
    body.classList.add('mobile-mode');
    container.classList.add('mobile');
    this.applyMobileLayout();
    const onResize = () => this.applyMobileLayout();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  } else {
    this.applyPCLayout();
    const onResize = () => this.applyPCLayout();
    window.addEventListener('resize', onResize);
  }
};

// ---- 电脑端自适应缩放（保持4:3比例居中） ----
// ---- 标题界面缩放 ----
// 标题界面是按 960×720 设计稿布局的，这里把它整体缩放到容器实际大小。
// 图片能靠百分比自适应，但固定 px 的字号不能 —— 必须整体 transform。
Game.prototype.syncTitleScale = function() {
  const ts = document.getElementById('titleScreen');
  const gc = document.getElementById('gameContainer');
  if (!ts || !gc) return;
  const w = gc.clientWidth;
  if (w > 0) ts.style.setProperty('--ts-scale', (w / W).toFixed(5));
};

Game.prototype.applyPCLayout = function() {
  const vW = window.innerWidth;
  const vH = window.innerHeight;
  // 留出一点边距避免贴边
  const pad = 40;
  const scale = Math.min((vW - pad) / W, (vH - pad) / H);
  // 限制最小比例 0.5，最大比例 2.5
  const finalScale = Math.max(0.5, Math.min(2.5, scale));
  // 宽高各自取整会让比例产生千分之几的偏差（960/720 = 1.3333 会变成 1.3346）。
  // 先定宽，再由宽反推高，比例就被锁死了。
  const cssW = Math.round(W * finalScale);
  const cssH = Math.round(cssW * H / W);
  const container = document.getElementById('gameContainer');
  this.canvas.style.width = cssW + 'px';
  this.canvas.style.height = cssH + 'px';
  // 全局 * { box-sizing: border-box }，而容器有 4px 边框 —— 容器和画布设成
  // 同一个数值的话，容器的内容区只有 cssW-8，画布会比它宽出 8px，
  // 边框就压在画面上了。把边框宽度补进去。
  const bw = container.offsetWidth - container.clientWidth || 8;
  container.style.width = (cssW + bw) + 'px';
  container.style.height = (cssH + bw) + 'px';
  this._pc = { vW, vH, scale: finalScale, cssW, cssH };
  this.syncTitleScale();
};

// ---- 手机端视觉横屏布局（尺寸与旋转由 CSS 控制，避免 JS 与 CSS 冲突） ----
// CSS 规则：body.mobile-mode #gameContainer.mobile → width=100vh, height=100vw,
//                                        transform=rotate(90deg) translateX(-100%),
//                                        transform-origin=left top
//                                        box-shadow/border:none;
// 画布：body.mobile-mode canvas → width:100%!important, height:100%!important
// 因此这里只需通过实测 getBoundingClientRect 回填 _mobile，确保坐标换算正确。
Game.prototype.applyMobileLayout = function() {
  const vW = window.innerWidth;
  const vH = window.innerHeight;
  const container = document.getElementById('gameContainer');
  const rect = container.getBoundingClientRect();
  // 视觉上的 canvas 渲染框（rotate 后在屏幕上的实际位置）
  const cssW = rect.width;
  const cssH = rect.height;
  this._mobile = {
    vW, vH,
    cssW, cssH,
    // 给 screenToGameCoords 提供实测的 render-box 四个角（用于逆变换）
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom
  };
  this.syncTitleScale();
};

// ---- 屏幕坐标 → 游戏逻辑坐标（处理手机旋转逆变换） ----
// 手机端布局由 CSS 统一控制（画面朝左 = 顺时针 90° 旋转）：
//   body.mobile-mode #gameContainer.mobile {
//     position: fixed; top:0; left:0;
//     width : 100vh / 100dvh;   // Hp = viewport innerHeight
//     height: 100vw / 100dvw;   // Wp = viewport innerWidth
//     transform-origin: left top;
//     transform: translateX(100vw) rotate(90deg);
//     // CSS transform 从右向左执行：
//     //   ① rotate(90°) 顺时针 → 矩阵 (x,y) → (-y, x)
//     //   ② translateX(Wp)      → x 方向 + Wp
//   }
//   body.mobile-mode canvas { width:100%!important; height:100%!important; }
//
// 正向变换：容器本地 (cx, cy) → 屏幕 (sx, sy)
//   ① rotate(90deg) 顺时针 → (-cy, cx)
//   ② translateX(+Wp)      → (Wp - cy, cx)
//   ∴  sx = Wp - cy,   sy = cx
// 逆变换（屏幕 → 容器本地）：
//   cx = sy,   cy = Wp - sx
// 再映射到逻辑画布 W×H → 容器本地 Hp×Wp：
//   mx / W = cx / Hp   →   mx = W * sy / Hp
//   my / H = cy / Wp   →   my = H * (Wp - sx) / Wp = H * (1 - sx / Wp)
Game.prototype.screenToGameCoords = function(clientX, clientY) {
  if (this.deviceMode !== 'mobile' || !this._mobile) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (W / rect.width);
    const my = (clientY - rect.top) * (H / rect.height);
    return { mx, my };
  }
  const Wp = window.innerWidth;
  const Hp = window.innerHeight;
  const mx = Math.max(0, Math.min(W, W * clientY / Hp));
  const my = Math.max(0, Math.min(H, H * (1 - clientX / Wp)));
  return { mx, my };
};

// ---- 虚拟按键坐标转换（虚拟按键是独立DOM，不做旋转） ----
Game.prototype.screenToVPad = function(clientX, clientY) {
  // 直接返回屏幕坐标，因为虚拟按键不参与 canvas 旋转
  return { x: clientX, y: clientY };
};

// ---- 输入事件绑定 ----
Game.prototype.setupInput = function() {
  const c = this.canvas;
  const g = this;

  // ===== 键盘输入（电脑端玩家控制） =====

  // 这些键在游戏进行中要独占：方向键和空格默认会滚动页面，
  // 而空格/回车还会「按下」当前获得焦点的按钮 —— 比如刚点过暂停按钮，
  // 之后每次按空格都会顺手把它再触发一遍。
  const GAME_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyJ',
  ]);

  // KeyboardEvent.code 是「物理键位」，正常情况下最可靠。但它并非永远存在：
  // 部分输入法、远程桌面、虚拟键盘、以及老浏览器给出的 code 是空的，
  // 只剩 key 或已废弃的 keyCode。那种情况下如果只认 code，
  // 按键就会静默失效 —— 从玩家角度看就是「这个键坏了」。
  // 所以按 code → key → keyCode 的顺序逐级降级。
  function normCode(e) {
    if (e.code) return e.code;
    const k = e.key;
    if (k) {
      if (k.length === 1 && /[a-zA-Z]/.test(k)) return 'Key' + k.toUpperCase();
      if (k === ' ' || k === 'Spacebar') return 'Space';
      if (/^Arrow(Left|Right|Up|Down)$/.test(k)) return k;
      if (k === 'Escape' || k === 'Esc') return 'Escape';
    }
    const kc = e.keyCode || e.which || 0;
    if (kc >= 65 && kc <= 90) return 'Key' + String.fromCharCode(kc);
    if (kc === 32) return 'Space';
    if (kc === 27) return 'Escape';
    if (kc >= 37 && kc <= 40) return ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][kc - 37];
    return '';
  }

  // 诊断面板要用同一套降级逻辑，挂到实例上
  this._normCode = normCode;

  // 松开所有按键。
  // 必须在窗口失焦时调用：按住 A 的同时 Alt-Tab 切走，keyup 事件是收不到的，
  // KeyA 会永久卡在 true。再配合移动逻辑里的方向抵消，卡住的键至多让人物
  // 站住不动，而不会让反方向的键彻底失灵。
  const releaseAllKeys = () => {
    this.input.keys = {};
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.input.attackPressed = false;
  };

  window.addEventListener('keydown', (e) => {
    // 焦点在输入框里时（登录框、游戏心得）键盘归输入框，游戏不抢
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    // 输入法正在处理这次按键（中文模式下敲字母就是这种情况）。
    // 此时字母键会被输入法吃掉，游戏收到的是一个「正在组词」的占位事件，
    // 方向键和空格却不受影响 —— 于是表现为「字母键失灵、方向键正常」。
    // 这种事从 JS 里救不回来，只能告诉玩家切到英文输入模式。
    if (e.isComposing || e.keyCode === 229) {
      this.warnIME();
      return;
    }

    const code = normCode(e);
    if (!code) return;
    this.input.keys[code] = true;

    if (GAME_KEYS.has(code) && this.running && !this.paused && !this.gameOver) {
      e.preventDefault();
    }

    // ESC：暂停面板打开时→恢复；否则→关闭建造菜单
    if (code === 'Escape') {
      if (this.paused) this.togglePause(false);
      else this.hideBuildPopup();
    }
    // P 键：切换暂停
    if (code === 'KeyP' && this.running && !this.gameOver) {
      this.togglePause();
    }
    // 反引号 ` （Esc 下面那个键）：按键诊断面板。
    // 原来用的是 F2 —— F 区在不少浏览器和笔记本上另有用途，换成反引号，
    // 它不是任何浏览器快捷键，也是老牌游戏开控制台的习惯键位。
    // 但这只是顺手的入口，正经入口在暂停面板里那个按钮（鼠标可达）。
    if (code === 'Backquote' || e.key === '`') {
      e.preventDefault();
      this.toggleKeyDebug();
    }
  });

  window.addEventListener('keyup', (e) => {
    const code = normCode(e);
    if (code) this.input.keys[code] = false;
  });

  // 切走窗口 / 切走标签页：一律松开所有键，避免按键卡死
  window.addEventListener('blur', releaseAllKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAllKeys();
    } else {
      // 标签页在后台时浏览器会暂停 requestAnimationFrame，
      // 回到前台要重置计时，否则第一帧的 dt 是整段离开的时长
      this.lastTime = performance.now();
    }
  });

  // ===== 鼠标/触摸（画布：点击地下室格子→建造菜单，点击陆地上资源→不拦截） =====
  const onHover = (mx, my) => {
    if (my > GROUND_Y) {
      const col = Math.floor(mx / TILE);
      const row = Math.floor((my - GROUND_Y) / TILE);
      this.hoverCell = { col, row, mx, my };
    } else {
      this.hoverCell = null;
    }
  };

  const onClickGame = (mx, my) => {
    if (!this.running || this.gameOver) return;
    // 地窖门的连击检测要排在最前面。它不吞掉点击 —— 门在地表，
    // 常规处理只是关掉建造菜单，两者不冲突。
    this.registerDoorClick(mx, my);
    if (my > GROUND_Y) {
      const col = Math.floor(mx / TILE);
      const row = Math.floor((my - GROUND_Y) / TILE);
      // 点击地下室格子 → 弹出建造菜单或房间功能面板
      this.showBuildPopup(col, row);
    } else {
      // 点击陆地 → 关闭建造菜单
      this.hideBuildPopup();
    }
  };

  // 鼠标事件
  c.addEventListener('mousemove', (e) => {
    const { mx, my } = this.screenToGameCoords(e.clientX, e.clientY);
    onHover(mx, my);
  });
  c.addEventListener('mouseleave', () => { this.hoverCell = null; });
  c.addEventListener('click', (e) => {
    const { mx, my } = this.screenToGameCoords(e.clientX, e.clientY);
    onClickGame(mx, my);
  });

  // 触摸事件（手机端：点击画布）
  let touchMoved = false;
  c.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const { mx, my } = this.screenToGameCoords(t.clientX, t.clientY);
    onHover(mx, my);
    touchMoved = false;
  }, { passive: false });
  c.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const { mx, my } = this.screenToGameCoords(t.clientX, t.clientY);
    onHover(mx, my);
    touchMoved = true;
  }, { passive: false });
  c.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (touchMoved) return;
    const t = e.changedTouches[0];
    const { mx, my } = this.screenToGameCoords(t.clientX, t.clientY);
    onClickGame(mx, my);
  }, { passive: false });

  // ===== 开始游戏按钮 =====
  document.getElementById('startBtn').onclick = () => {
    this.applyDeviceMode();
    document.getElementById('overlay').classList.add('hidden');
    this.start();
  };

  // ===== 暂停按钮 / 继续按钮 =====
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const saveSlotBtn = document.getElementById('saveSlotBtn');
  const quitBtn = document.getElementById('quitBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    pauseBtn.blur();   // 不失焦的话，之后每次按空格都会把这个按钮再触发一遍
    if (this.running && !this.gameOver) this.togglePause(true);
  });
  if (resumeBtn) resumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    resumeBtn.blur();
    this.togglePause(false);
  });
  if (saveSlotBtn) saveSlotBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const slot = this._autoSaveSlot || parseInt(prompt('保存到哪个槽位（1-10）？', '1'));
    if (slot) this.saveToSlot(slot);
  });
  const keyDebugBtn = document.getElementById('keyDebugBtn');
  if (keyDebugBtn) keyDebugBtn.addEventListener('click', (e) => {
    e.preventDefault();
    keyDebugBtn.blur();
    // 面板本身是 position:fixed，暂停面板关掉后它照样留在屏幕上，
    // 所以点完可以直接继续游戏，一边玩一边看
    this.toggleKeyDebug();
  });

  // 音频开关（暂停面板）
  const bgmBtn = document.getElementById('bgmBtn');
  const sfxBtn = document.getElementById('sfxBtn');
  const syncAudioBtns = () => {
    if (bgmBtn) {
      bgmBtn.textContent = Sound.bgmOn ? '🎵 音乐' : '🔇 音乐';
      bgmBtn.style.opacity = Sound.bgmOn ? '1' : '.5';
    }
    if (sfxBtn) {
      sfxBtn.textContent = Sound.sfxOn ? '🔔 音效' : '🔕 音效';
      sfxBtn.style.opacity = Sound.sfxOn ? '1' : '.5';
    }
  };
  if (bgmBtn) bgmBtn.addEventListener('click', (e) => {
    e.preventDefault(); bgmBtn.blur();
    Sound.setBGM(!Sound.bgmOn);
    syncAudioBtns();
  });
  if (sfxBtn) sfxBtn.addEventListener('click', (e) => {
    e.preventDefault(); sfxBtn.blur();
    Sound.setSFX(!Sound.sfxOn);
    syncAudioBtns();
    if (Sound.sfxOn) Sound.sfx('click');     // 打开时立刻响一声，确认生效
  });
  syncAudioBtns();

  if (quitBtn) quitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const c = confirm('退出后将回到标题界面。未保存的进度会丢失，确定退出吗？');
    if (!c) return;
    this.running = false;
    // 直接回标题界面。旧版是在这里重新画一遍存档格子，但那份拷贝里
    // 点存档只会弹「请刷新页面进入存档管理」—— 等于是个死胡同。
    // 标题界面本来就是所有入口的集散地，回这里最省事也最不会错。
    document.getElementById('pausePanel').classList.add('hidden');
    if (this._backToTitle) this._backToTitle();
    else if (window.TitleScreen) TitleScreen.show();
  });

  // ===== 虚拟摇杆 & 攻击键（仅手机端显示） =====
  this.setupVirtualPad();
};

// ---- 虚拟按键 ----
Game.prototype.setupVirtualPad = function() {
  const g = this;
  const joyBase = document.getElementById('joyBase');
  const joyStick = document.getElementById('joyStick');
  const atkBtn = document.getElementById('attackBtn');
  if (!joyBase) return;

  // 动态计算摇杆 RADIUS：joyBase 现在由 clamp() 自适应尺寸，
  // 顶盘最大位移 = (底盘宽度 - 顶盘宽度) / 2，保证顶盘永远不超出底盘边界
  function calcRadius() {
    const baseRect = joyBase.getBoundingClientRect();
    const stickRect = joyStick.getBoundingClientRect();
    const baseW = baseRect.width || joyBase.offsetWidth;
    const stickW = stickRect.width || joyStick.offsetWidth;
    return Math.max(20, (baseW - stickW) / 2);
  }

  let joyActive = false;
  let joyStartX = 0, joyStartY = 0;
  let joyTouchId = null;

  const moveStick = (dx, dy) => {
    const RADIUS = calcRadius();
    const d = Math.sqrt(dx*dx + dy*dy);
    let rx = dx, ry = dy;
    if (d > RADIUS) { rx = dx * RADIUS / d; ry = dy * RADIUS / d; }
    joyStick.style.transform = `translate(${rx}px, ${ry}px)`;
    // 写入输入
    const mag = Math.min(1, d / RADIUS);
    const angle = Math.atan2(dy, dx);
    let mvx = Math.cos(angle) * mag;
    let mvy = Math.sin(angle) * mag;
    // 横屏（画面 rotate 90°顺时针）：摇杆方向全部反转
    // 原映射 (ix,iy)→(-iy,ix) 反转为 (ix,iy)→(iy,-ix)
    if (g.deviceMode === 'mobile') {
      const ixOld = mvx, iyOld = mvy;
      mvx =  iyOld;
      mvy = -ixOld;
    }
    g.input.moveX = mvx;
    g.input.moveY = mvy;
  };
  const resetStick = () => {
    joyStick.style.transform = `translate(0,0)`;
    g.input.moveX = 0;
    g.input.moveY = 0;
    joyActive = false;
    joyTouchId = null;
  };

  // 鼠标（调试）
  joyBase.addEventListener('mousedown', (e) => {
    joyActive = true;
    const r = joyBase.getBoundingClientRect();
    joyStartX = r.left + r.width/2;
    joyStartY = r.top + r.height/2;
    moveStick(e.clientX - joyStartX, e.clientY - joyStartY);
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!joyActive) return;
    moveStick(e.clientX - joyStartX, e.clientY - joyStartY);
  });
  window.addEventListener('mouseup', () => { if (joyActive) resetStick(); });

  // 触摸
  joyBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    joyActive = true;
    const r = joyBase.getBoundingClientRect();
    joyStartX = r.left + r.width/2;
    joyStartY = r.top + r.height/2;
    moveStick(t.clientX - joyStartX, t.clientY - joyStartY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!joyActive || joyTouchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) {
        moveStick(t.clientX - joyStartX, t.clientY - joyStartY);
        break;
      }
    }
  }, { passive: false });

  const endJoy = (e) => {
    if (!joyActive || joyTouchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) { resetStick(); break; }
    }
  };
  window.addEventListener('touchend', endJoy);
  window.addEventListener('touchcancel', endJoy);

  // ===== 攻击按钮 =====
  const pressAtk = () => { g.input.attackPressed = true; };
  const releaseAtk = () => { g.input.attackPressed = false; };
  atkBtn.addEventListener('mousedown', (e) => { pressAtk(); e.preventDefault(); });
  atkBtn.addEventListener('mouseup', releaseAtk);
  atkBtn.addEventListener('mouseleave', releaseAtk);
  atkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); pressAtk(); }, { passive: false });
  atkBtn.addEventListener('touchend', (e) => { e.preventDefault(); releaseAtk(); }, { passive: false });
  atkBtn.addEventListener('touchcancel', releaseAtk);
};

// ============================================================================
// 按键诊断
// ============================================================================
// 排查「某个键没反应」时，最难的是分不清究竟是
//   (a) 浏览器/输入法/系统快捷键把键吃了，游戏压根没收到
//   (b) 游戏收到了但逻辑没生效
// 这两件事的修法完全不同，靠猜没有意义。下面两个东西就是用来把它们分开的。
// ============================================================================

// ---- 输入法拦截提示 ----
// 中文输入法处于中文模式时会吞掉字母键（游戏只能收到一个 keyCode 229 的
// 占位事件），而方向键和空格不受影响 —— 于是表现为「WASD/J 失灵、方向键
// 和空格正常」。这在 JS 里救不回来，只能明确告诉玩家。
Game.prototype.warnIME = function() {
  if (Date.now() - (this._imeWarnAt || 0) < 8000) return;
  this._imeWarnAt = Date.now();
  this.log('输入法正在拦截字母键 —— 按 Shift 切到英文模式（或用方向键+空格操作）', '#fc6');
};

// ---- 按键诊断面板 ----
// 第一版是「显示最近一次按键」，但那个设计有个致命缺陷：
// 面板只在收到 keydown 时才刷新 —— 而要查的恰恰是「收不到的那个键」。
// 按下去面板纹丝不动，玩家看到的只是一片空白，什么也说明不了。
//
// 所以改成清单式：把每个控制键都列出来，按到过就打勾。
// 玩家把键盘上这几个键挨个按一遍，没被勾上的就是从未送达的 ——
// 这个判断不需要故障键自己能用。
Game.prototype.toggleKeyDebug = function() {
  // 按钮文案的同步放在这里，而不是放在按钮的点击回调里 ——
  // 面板还能用反引号开关，写在回调里的话，用键盘切换一次文案就对不上了。
  const syncBtn = () => {
    const b = document.getElementById('keyDebugBtn');
    if (b) b.textContent = document.getElementById('keyDebug') ? '🔧 关闭诊断' : '🔧 按键诊断';
  };

  let box = document.getElementById('keyDebug');
  if (box) {                                   // 再切一次关掉
    box.remove();
    if (this._dbgOff) this._dbgOff();
    this._dbgOff = null;
    syncBtn();
    return;
  }

  box = document.createElement('div');
  box.id = 'keyDebug';
  box.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:100001;background:rgba(8,8,16,.94);' +
    'color:#9fe;font:12px/1.65 Consolas,monospace;padding:10px 14px;border:2px solid #4a4a6a;' +
    'border-radius:8px;white-space:pre;pointer-events:none;max-width:94vw';
  document.body.appendChild(box);
  syncBtn();

  const WATCH = [
    ['移动', [['KeyW', 'W'], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D']]],
    ['方向', [['ArrowUp', '↑'], ['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]],
    ['攻击', [['Space', '空格'], ['KeyJ', 'J']]],
  ];
  const seen = Object.create(null);
  const recent = [];
  let last = null;

  const norm = (e) => (this._normCode ? this._normCode(e) : (e.code || ''));

  const render = () => {
    let s = '按键诊断        关闭：` 或暂停面板\n';
    s += '────────────────────────────────────\n';
    s += '把下面每个键都按一遍，看谁没被勾上：\n';
    for (const [label, keys] of WATCH) {
      s += '  ' + label + '  ' +
        keys.map(([code, name]) => name + (seen[code] ? ' ✓' : ' ✗')).join('   ') + '\n';
    }
    const missing = [];
    for (const [, keys] of WATCH) for (const [code, name] of keys) if (!seen[code]) missing.push(name);
    s += '────────────────────────────────────\n';
    if (missing.length === 0) {
      s += '全部收到 —— 事件都进了页面。\n若人物仍不动，问题在游戏逻辑，请截图给我。\n';
    } else {
      s += '未收到：' + missing.join(' ') + '\n';
      s += '（按过却仍是 ✗ = 事件根本没进页面，\n';
      s += '  被浏览器 / 输入法 / 系统快捷键吃掉了）\n';
    }
    s += '────────────────────────────────────\n';
    if (last) {
      s += '最近一次  code=' + (last.code || '(空)') + '  key=' + JSON.stringify(last.key) +
           '  keyCode=' + last.keyCode + (last.keyCode === 229 ? ' ←输入法拦截' : '') + '\n';
      s += '          修饰键=' + (last.mods || '(无)') +
           '  isComposing=' + last.composing + '  目标=' + last.target + '\n';
    } else {
      s += '最近一次  （还没收到任何按键）\n';
    }
    s += '最近按键  ' + (recent.length ? recent.join(' ') : '(无)');
    box.textContent = s;
  };

  const onKey = (e) => {
    const code = norm(e);
    if (code) {
      seen[code] = true;
      recent.push(code);
      if (recent.length > 10) recent.shift();
    }
    last = {
      code: e.code,
      key: e.key,
      keyCode: e.keyCode || e.which || 0,
      composing: !!e.isComposing,
      target: ((e.target && e.target.tagName) || '?') +
              (e.target && e.target.id ? '#' + e.target.id : ''),
      mods: [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta']
              .filter(Boolean).join('+'),
    };
    render();
  };

  // 挂在捕获阶段：这是页面上最早能拿到键盘事件的位置。
  // 如果连这里都收不到，就说明事件压根没进页面，而不是被页面里的某段代码吞了。
  window.addEventListener('keydown', onKey, true);
  this._dbgOff = () => window.removeEventListener('keydown', onKey, true);
  render();
};
