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
Game.prototype.applyPCLayout = function() {
  const vW = window.innerWidth;
  const vH = window.innerHeight;
  // 留出一点边距避免贴边
  const pad = 40;
  const scale = Math.min((vW - pad) / W, (vH - pad) / H);
  // 限制最小比例 0.5，最大比例 2.5
  const finalScale = Math.max(0.5, Math.min(2.5, scale));
  const cssW = Math.floor(W * finalScale);
  const cssH = Math.floor(H * finalScale);
  const container = document.getElementById('gameContainer');
  this.canvas.style.width = cssW + 'px';
  this.canvas.style.height = cssH + 'px';
  container.style.width = cssW + 'px';
  container.style.height = cssH + 'px';
  this._pc = { vW, vH, scale: finalScale, cssW, cssH };
};

// ---- 手机端视觉横屏布局 ----
Game.prototype.applyMobileLayout = function() {
  const vW = window.innerWidth;
  const vH = window.innerHeight;
  const scale = Math.min(vH / W, vW / H);
  const cssW = W * scale;
  const cssH = H * scale;
  const container = document.getElementById('gameContainer');
  this.canvas.style.width = cssW + 'px';
  this.canvas.style.height = cssH + 'px';
  container.style.width = cssW + 'px';
  container.style.height = cssH + 'px';
  const offsetX = (vW - cssW) / 2;
  const offsetY = (vH - cssH) / 2;
  container.style.position = 'fixed';
  container.style.transformOrigin = '50% 50%';
  container.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(90deg)`;
  container.style.top = '0';
  container.style.left = '0';
  this._mobile = { vW, vH, scale, cssW, cssH, offsetX, offsetY };
};

// ---- 屏幕坐标 → 游戏逻辑坐标（处理手机旋转逆变换） ----
Game.prototype.screenToGameCoords = function(clientX, clientY) {
  if (this.deviceMode !== 'mobile' || !this._mobile) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (W / rect.width);
    const my = (clientY - rect.top) * (H / rect.height);
    return { mx, my };
  }
  // CSS transform: translate(offsetX, offsetY) rotate(90deg) around 50% 50%
  // 旋转中心在屏幕坐标 = (vW/2, vH/2)
  // rotate(90deg) 顺时针的前向变换: (x,y) → (-y, x)
  // 逆变换: (sx,sy) → (sy, -sx)
  const { vW, vH, cssW, cssH, offsetX, offsetY } = this._mobile;
  const cx_c = vW / 2, cy_c = vH / 2;
  const a = clientX - cx_c;   // 屏幕坐标相对中心的 x
  const b = clientY - cy_c;   // 屏幕坐标相对中心的 y
  // 逆旋转
  const dx = b;               // local x = sy
  const dy = -a;              // local y = -sx
  // 还原平移
  const lx = cx_c + dx - offsetX;
  const ly = cy_c + dy - offsetY;
  // 缩放映射回游戏坐标
  const mx = lx * (W / cssW);
  const my = ly * (H / cssH);
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
  window.addEventListener('keydown', (e) => {
    this.input.keys[e.code] = true;
    // ESC：暂停面板打开时→恢复；否则→关闭建造菜单
    if (e.code === 'Escape') {
      if (this.paused) this.togglePause(false);
      else this.hideBuildPopup();
    }
    // P 键：切换暂停
    if (e.code === 'KeyP' && this.running && !this.gameOver) {
      this.togglePause();
    }
  });
  window.addEventListener('keyup', (e) => {
    this.input.keys[e.code] = false;
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
    if (this.running && !this.gameOver) this.togglePause(true);
  });
  if (resumeBtn) resumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    this.togglePause(false);
  });
  if (saveSlotBtn) saveSlotBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const slot = this._autoSaveSlot || parseInt(prompt('保存到哪个槽位（1-10）？', '1'));
    if (slot) this.saveToSlot(slot);
  });
  if (quitBtn) quitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const c = confirm('退出后将回到存档选择界面。确定退出吗？');
    if (!c) return;
    this.running = false;
    const saveModal = document.getElementById('saveModal');
    if (saveModal) saveModal.classList.remove('hidden');
    // 重新渲染存档列表
    if (UserSystem.isLoggedIn()) {
      const grid = document.getElementById('saveGrid');
      const uName = document.getElementById('saveUsername');
      if (uName) uName.textContent = UserSystem.current();
      if (grid) {
        const slots = UserSystem.listSaves();
        grid.innerHTML = '';
        slots.forEach(s => {
          const div = document.createElement('div');
          div.className = 'save-slot ' + (s.filled ? 'filled' : 'empty');
          div.innerHTML = `<div class="slot-num">${s.slot}</div>
            ${s.filled ? `<div class="slot-name">${s.name}</div><div class="slot-info">第${s.wave}波</div>` : `<div class="slot-name">— 空 —</div>`}`;
          div.onclick = () => { alert('请刷新页面进入存档管理'); };
          grid.appendChild(div);
        });
      }
    }
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

  const RADIUS = 82;
  let joyActive = false;
  let joyStartX = 0, joyStartY = 0;
  let joyTouchId = null;

  const moveStick = (dx, dy) => {
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
