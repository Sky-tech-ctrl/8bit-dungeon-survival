// ==================== 游戏引擎核心 ====================
// Game 类：状态管理、更新逻辑、波次系统、建造系统、玩家控制

let game = null;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.tick = 1/60;
    this.deviceMode = 'pc';
    this._mobile = null;

    // 贴图加载器
    this.assets = new AssetLoader();
    this.assets.preloadRoomTextures();

    // 输入状态（虚拟摇杆+键盘）
    this.input = {
      moveX: 0, moveY: 0,    // 摇杆方向 -1~1
      attackPressed: false,
      keys: {}
    };

    // 建造弹窗状态
    this.buildPopup = null;   // {col, row, x, y} 或 null
    this.playerRoomDialog = null; // {roomId, type: 'blacksmith'}

    this.reset();

    // ===== 用户系统：登录/注册 → 存档选择 → 再启动 =====
    this._pendingLoadedSave = null;  // 若选了"读取存档"，暂存在这里
    this.setupAuth();
  }

  // ---- 用户系统：显示登录/存档模态框 ----
  setupAuth() {
    const game = this;
    const authModal = document.getElementById('authModal');
    const saveModal = document.getElementById('saveModal');
    const authSubmit = document.getElementById('authSubmit');
    const authSwitch = document.getElementById('authSwitchLink');
    const authSwitchText = document.getElementById('authSwitchText');
    const authError = document.getElementById('authError');
    const authUser = document.getElementById('authUsername');
    const authPwd = document.getElementById('authPassword');
    const saveGrid = document.getElementById('saveGrid');
    const newGameBtn = document.getElementById('newGameBtn');
    const saveUserBar = document.getElementById('saveUsername');
    const saveLogout = document.getElementById('saveLogout');

    // ---- 设备选择（嵌入存档模态框） ----
    const dsPcBtn = document.getElementById('dsPcBtn');
    const dsMobileBtn = document.getElementById('dsMobileBtn');
    const dsHint = document.getElementById('dsHint');
    let selectedDevice = null;

    function detectUARecommend() {
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      return mobileUA ? 'mobile' : 'pc';
    }

    function setDevice(mode) {
      selectedDevice = mode;
      if (dsPcBtn) dsPcBtn.classList.toggle('selected', mode === 'pc');
      if (dsMobileBtn) dsMobileBtn.classList.toggle('selected', mode === 'mobile');
      if (dsHint) {
        if (mode === 'mobile') dsHint.textContent = '📱 竖握使用 · 画面旋转横屏 · 摇杆+攻击';
        else dsHint.textContent = '💻 WASD移动 · 空格/J挥剑 · 鼠标点击建造';
      }
    }

    function bindDeviceSelect() {
      if (dsPcBtn) dsPcBtn.onclick = () => setDevice('pc');
      if (dsMobileBtn) dsMobileBtn.onclick = () => setDevice('mobile');
      // 默认直接选中「手机端」
      setDevice('mobile');
      // 保留 UA 提示作为参考
      const uaRec = detectUARecommend();
      if (dsHint && uaRec === 'pc') {
        dsHint.innerHTML = `（默认手机端） · 💡 UA 检测为电脑端，可切换到💻电脑端`;
      } else if (dsHint) {
        dsHint.textContent = '📱 竖握使用 · 画面旋转横屏 · 摇杆+攻击（默认手机端）';
      }
    }

    function requireDevice() {
      if (!selectedDevice) {
        if (dsHint) {
          const old = dsHint.innerHTML;
          dsHint.innerHTML = `<span style="color:#f66">⚠ 请先选择设备类型（电脑端 / 手机端）</span>`;
          dsHint.style.animation = 'none';
          // 简单的闪烁提示
          setTimeout(() => { dsHint.style.animation = 'dsShake .3s'; }, 10);
          setTimeout(() => { dsHint.innerHTML = old; dsHint.style.animation = ''; }, 1800);
        } else {
          alert('请先选择设备类型（电脑端 / 手机端）');
        }
        return null;
      }
      return selectedDevice;
    }

    let isRegister = false;
    let pendingIntent = 'new';    // 登录成功后要去干嘛：'new' 开新档 / 'load' 读档

    // 从登录框或存档框退回标题界面
    function backToTitle() {
      authModal.classList.add('hidden');
      saveModal.classList.add('hidden');
      if (window.TitleScreen) TitleScreen.show();
    }
    game._backToTitle = backToTitle;

    function showAuth(intent) {
      if (intent) pendingIntent = intent;
      saveModal.classList.add('hidden');
      authModal.classList.remove('hidden');
      authUser.value = ''; authPwd.value = ''; authError.textContent = '';
      authSubmit.textContent = isRegister ? '注册账号' : '登录';
      authSwitchText.textContent = isRegister ? '已有账号？' : '还没有账号？';
      authSwitch.textContent = isRegister ? '去登录 →' : '立即注册 →';
    }

    function showSave(intent) {
      if (intent) pendingIntent = intent;
      authModal.classList.add('hidden');
      saveModal.classList.remove('hidden');
      // 「开始新游戏」和「读取存档」共用这个界面，只有提示语不同
      const hint = document.getElementById('saveModeText');
      if (hint) {
        hint.innerHTML = pendingIntent === 'load'
          ? '点击一个<b style="color:#ffd700">已有存档</b>继续游戏'
          : '点击一个<b style="color:#ffd700">空槽位</b>开始新游戏';
      }
      bindDeviceSelect();
      renderSaveGrid();
    }

    async function renderSaveGrid() {
      saveUserBar.textContent = (await AuthAPI.current()) || '';
      const slots = await AuthAPI.listSaves();
      saveGrid.innerHTML = '';
      slots.forEach(s => {
        const div = document.createElement('div');
        div.className = 'save-slot ' + (s.filled ? 'filled' : 'empty');
        div.innerHTML = `
          <div class="slot-num">${s.slot}</div>
          ${s.filled ? `<div class="slot-name">${s.name}</div><div class="slot-info">第${s.wave}波</div>` : `<div class="slot-name">— 空 —</div>`}
        `;
        div.onclick = () => handleSlotClick(s);
        saveGrid.appendChild(div);
      });
    }

    async function handleSlotClick(s) {
      const mode = requireDevice();
      if (!mode) return;
      if (s.filled) {
        // 读取
        const confirmLoad = confirm(`确定读取存档 ${s.slot}【${s.name}】吗？\n当前未保存的进度将丢失。`);
        if (!confirmLoad) return;
        const save = await AuthAPI.load(s.slot);
        if (save) {
          const result = game.importSnapshot(save.data);
          if (result.ok) {
            saveModal.classList.add('hidden');
            game._autoSaveSlot = s.slot;
            game.startAfterAuth(mode);
          } else {
            alert('读取失败：' + result.msg);
          }
        }
      } else {
        // 点空槽 → 新建游戏存到该槽位
        handleNewGame(s.slot, mode);
      }
    }

    function handleNewGame(targetSlot, forceMode) {
      const mode = forceMode || requireDevice();
      if (!mode) return;
      saveModal.classList.add('hidden');
      game.reset();
      game._autoSaveSlot = targetSlot;
      // 先启动引擎
      game.startAfterAuth(mode);
      // 自动保存
      setTimeout(() => {
        const snap = game.exportSnapshot();
        AuthAPI.save(targetSlot, snap, `存档 ${targetSlot}`);
      }, 600);
    }

    // 提交（登录或注册）
    authSubmit.onclick = async () => {
      authError.textContent = '';
      const u = authUser.value.trim();
      const p = authPwd.value;
      const label = authSubmit.textContent;
      authSubmit.disabled = true;
      authSubmit.textContent = '请稍候…';
      try {
        const r = isRegister ? await AuthAPI.register(u, p) : await AuthAPI.login(u, p);
        if (r.ok) showSave(pendingIntent);
        else authError.textContent = r.msg;
      } catch (e) {
        authError.textContent = '连接失败：' + (e && e.message ? e.message : e);
      } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = label;
      }
    };
    authSwitch.onclick = () => { isRegister = !isRegister; showAuth(); };
    authPwd.addEventListener('keydown', e => { if (e.key === 'Enter') authSubmit.click(); });

    newGameBtn.onclick = async () => {
      const mode = requireDevice();
      if (!mode) return;
      const slots = (await AuthAPI.listSaves()) || [];
      const emptySlot = slots.find(s => !s.filled);
      if (!emptySlot) {
        // 10个都满了，让用户选择要覆盖的槽
        const slot = parseInt(prompt('所有存档已满！\n请输入要覆盖的槽位（1-10）：', '1'));
        if (isNaN(slot) || slot < 1 || slot > 10) { alert('无效槽位'); return; }
        handleNewGame(slot, mode);
      } else {
        handleNewGame(emptySlot.slot, mode);
      }
    };

    saveLogout.onclick = async () => {
      await AuthAPI.logout();
      backToTitle();
    };

    // 给两个模态框补上「返回标题」入口 —— 玩家在任何一步都该能退回去
    for (const modalId of ['authModal', 'saveModal']) {
      const card = document.querySelector('#' + modalId + ' .modal-card');
      if (!card || card.querySelector('.back-to-title')) continue;
      const back = document.createElement('button');
      back.className = 'modal-btn modal-btn-secondary back-to-title';
      back.textContent = '← 返回标题界面';
      back.onclick = backToTitle;
      card.appendChild(back);
    }

    // 入口交给标题界面：这里只把两个流程暴露出去，构造时不主动弹任何窗
    game._showAuth = showAuth;
    game._showSave = showSave;
  }

  // 用户完成登录 + 存档选择 + 设备选择后，启动游戏
  startAfterAuth(deviceMode) {
    if (this.running) return;

    // 隐藏所有模态框
    const authModal = document.getElementById('authModal');
    const saveModal = document.getElementById('saveModal');
    if (authModal) authModal.classList.add('hidden');
    if (saveModal) saveModal.classList.add('hidden');

    // 设备模式：以用户在存档模态框的选择为准，否则按 UA 兜底
    if (deviceMode === 'pc' || deviceMode === 'mobile') {
      this.deviceMode = deviceMode;
    } else {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      this.deviceMode = isMobile ? 'mobile' : 'pc';
    }

    // ① 先绑定 overlay 设备选择回调（click 才能正确触发 setDevice → 改 vpad 可见性）
    this.setupDeviceSelect();
    this.setupInput();
    this.buildUI();

    // ② 同步 overlay 里的设备按钮状态（此时 setDevice 已绑定，click 会生效）
    const pcBtn = document.querySelector('#deviceSelect [data-device=pc]');
    const mobileBtn = document.querySelector('#deviceSelect [data-device=mobile]');
    if (pcBtn && mobileBtn) {
      if (this.deviceMode === 'mobile') mobileBtn.click(); else pcBtn.click();
    }

    // ③ 兜底：无论 overlay 按钮是否存在，按最终设备模式强设虚拟按键可见性（避免消失）
    const vpad = document.getElementById('virtualPad');
    if (vpad) {
      vpad.style.display = (this.deviceMode === 'mobile') ? 'block' : 'none';
    }

    // 应用设备模式（canvas 尺寸/旋转、响应式）
    if (typeof this.applyDeviceMode === 'function') this.applyDeviceMode();

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('hidden');
    this.start();
  }

  // ==================== 初始化/重置 ====================
  reset() {
    this.resources = { gold: 100, food: 50, power: 20 };
    this.capacity = { gold:500, food:300, power:200 };
    this.wave = 0;
    this.waveActive = false;
    this.nextWaveTimer = 15;
    this.waveZombieQueue = 0;
    this.kills = 0;
    this.gameOver = false;

    this.doorHp = 100;
    this.doorMaxHp = 100;

    this.zombies = [];
    this.soldiers = [];
    this.projectiles = [];
    this.particles = [];
    this.messages = [];
    this.clouds = [];
    for (let i=0;i<4;i++)
      this.clouds.push({x:Math.random()*W, y:20+Math.random()*60, s:0.3+Math.random()*0.4, w:40+Math.random()*60});

    // 地下室网格
    this.grid = [];
    for (let c=0;c<BASEMENT_COLS;c++) {
      this.grid[c] = [];
      for (let r=0;r<BASEMENT_ROWS;r++) this.grid[c][r] = null;
    }
    this.rooms = [];
    this.roomIdCounter = 0;

    // 初始指挥中心（2x2 放在地下室入口中央区域）
    this.placeRoom('command', BASEMENT_COLS/2 - 1, 0, true);

    this.selectedBuild = null;
    this.hoverCell = null;
    this.atkBonus = 0;
    this.traps = [];
    this.hasBlacksmith = false;

    // ===== 玩家 =====
    this.playerLevel = 1;
    this.player = {
      x: PLAYER.spawnX, y: PLAYER.spawnY,
      hp: BLACKSMITH_UPGRADES[0].hp,
      maxHp: BLACKSMITH_UPGRADES[0].hp,
      atk: BLACKSMITH_UPGRADES[0].atk,
      speed: BLACKSMITH_UPGRADES[0].speed,
      atkRange: PLAYER.baseAtkRange,
      atkCd: 0,
      atkInterval: PLAYER.baseAtkInterval,
      attackAnim: 0,
      hitFlash: 0,
      facing: 1,
      inBasement: false,   // 是否在地下室（不可战斗）
      respawnTimer: 0
    };

    // ===== 野生资源堆 =====
    this.resourcePiles = [];
    this.pileSpawnTimer = 3;

    // ===== 手动功能冷却 & Buff =====
    this.buffs = {};  // {playerAtk: {until, mult}, soldierAtk: {until, mult}}
    this.tempSoldierCount = 0;
    for (const r of this.rooms) r.useCd = 0;
  }

  // ===== 辅助函数 =====
  addRes(k, v) { this.resources[k] = Math.min(this.capacity[k]||9999, (this.resources[k]||0) + v); }

  getBuffMult(key) {
    const b = this.buffs[key];
    if (!b) return 1;
    if (performance.now()/1000 > b.until) { delete this.buffs[key]; return 1; }
    return b.mult;
  }

  damageAllZombies(dmg) {
    let hit = 0;
    for (const z of this.zombies) {
      if (z.hp > 0) {
        z.hp -= dmg;
        this.spawnParticles(z.x, z.y, COL.red, 6);
        hit++;
      }
    }
    this.log(`✴ 紧急陷阱！对 ${hit} 只丧尸造成 ${dmg} 伤害`, '#fa5');
  }

  // ==================== 地下室可行区域 / 墙体碰撞 / 门口 ====================
  // 返回房间的"墙体门口缺口"信息：doorSide, doorRect(穿墙缺口矩形), tunnelRect(连向中央楼梯的通道矩形)
  roomDoorInfo(room) {
    const WALL = 5;           // 墙厚
    const DOOR_W = 20;        // 门口缺口宽/高
    const TUNNEL_H = 18;      // 通道矩形宽
    const x0 = room.col * TILE;
    const y0 = GROUND_Y + room.row * TILE;
    const x1 = (room.col + room.size.w) * TILE;
    const y1 = GROUND_Y + (room.row + room.size.h) * TILE;
    const yc = (y0 + y1) / 2;
    const xc = (x0 + x1) / 2;
    const CX = DOOR_X;         // 中央楼梯中心 x
    let doorSide, doorRect, tunnelRect = null;
    // 相对于中央楼梯，判断门开在哪一侧
    if (x1 <= CX + 5) {
      // 房间整体在楼梯左边 → 门开在房间右墙
      doorSide = 'right';
      doorRect = { x: x1 - WALL, y: yc - DOOR_W/2, w: WALL + 2, h: DOOR_W };
      // 通道：从房间右侧到楼梯左边缘
      tunnelRect = { x: x1, y: yc - TUNNEL_H/2, w: Math.max(0, (CX - 28) - x1), h: TUNNEL_H };
    } else if (x0 >= CX - 5) {
      // 房间整体在楼梯右边 → 门开在房间左墙
      doorSide = 'left';
      doorRect = { x: x0 - 2, y: yc - DOOR_W/2, w: WALL + 2, h: DOOR_W };
      tunnelRect = { x: CX + 28, y: yc - TUNNEL_H/2, w: Math.max(0, x0 - (CX + 28)), h: TUNNEL_H };
    } else {
      // 横跨中央楼梯（如指挥中心）→ 门开在房间顶墙，位置对齐中央楼梯
      doorSide = 'top';
      doorRect = { x: CX - DOOR_W/2, y: y0 - 2, w: DOOR_W, h: WALL + 2 };
      // 顶部门直通楼梯，不需要额外通道
    }
    return { doorSide, doorRect, tunnelRect, box: {x0,y0,x1,y1}, wall: WALL, yc, xc };
  }

  // 点 (x,y) 是否在地下室"可行走区域"
  isBasementWalkable(x, y) {
    // 1. 中央垂直楼梯通道（从活板门直通最底层）
    if (x >= DOOR_X - 28 && x <= DOOR_X + 28) return true;
    // 2. 遍历每个房间：检查通道、门口、内部空心
    for (const r of this.rooms) {
      const info = this.roomDoorInfo(r);
      const { box, doorRect, tunnelRect, wall } = info;
      // 2a. 水平通道矩形（房间门口 → 中央楼梯）
      if (tunnelRect && tunnelRect.w > 1 &&
          x >= tunnelRect.x && x <= tunnelRect.x + tunnelRect.w &&
          y >= tunnelRect.y && y <= tunnelRect.y + tunnelRect.h) return true;
      // 2b. 穿墙门口（把房间内墙打开一个缺口，连通内部与通道）
      if (x >= doorRect.x && x <= doorRect.x + doorRect.w &&
          y >= doorRect.y && y <= doorRect.y + doorRect.h) return true;
      // 2c. 房间内部空心区域（除了四周 wall 厚度）
      if (x >= box.x0 + wall && x <= box.x1 - wall &&
          y >= box.y0 + wall && y <= box.y1 - wall) return true;
    }
    return false;
  }

  // 检查玩家 BBox（玩家宽 20，高 22）在新位置是否合法
  canPlayerStand(nx, ny, inBasement) {
    if (inBasement) {
      if (nx < 8 || nx > W - 8) return false;
      if (ny < GROUND_Y + 6 || ny > H - 12) return false;
      // 检查四角：头部 (x±9, y-12)、腰部 (x±9, y)、脚部 (x±9, y+8)
      const probes = [
        [nx - 9, ny - 12], [nx + 9, ny - 12],
        [nx - 9, ny - 4],  [nx + 9, ny - 4],
        [nx - 9, ny + 8],  [nx + 9, ny + 8],
        [nx,     ny - 12], [nx,     ny + 8]
      ];
      for (const [px, py] of probes) {
        if (!this.isBasementWalkable(px, py)) return false;
      }
      return true;
    } else {
      if (nx < 8 || nx > W - 8) return false;
      if (ny < GROUND_Y - 40 || ny > GROUND_Y - 4) return false;
      return true;
    }
  }

  summonTempSoldier() {
    const pos = { x: DOOR_X + (Math.random()-0.5)*80, y: GROUND_Y - 20 };
    this.soldiers.push({
      x: pos.x, y: pos.y, targetX: pos.x,
      hp: 25, maxHp: 25, attackRange: 130,
      attackCd: 0.3, attackInterval: 1.2,
      damage: 7 * (1 + this.atkBonus), shootAnim: 0,
      temp: true
    });
    this.tempSoldierCount++;
    this.log('⚔ 临时援军士兵已到达地面战场！', '#f88');
  }

  // ==================== UI 建造按钮（不常驻，点击格子才显示） ====================
  buildUI() {
    const menu = document.getElementById('buildMenu');
    menu.innerHTML = '';
    // 初始状态下不生成按钮，点击格子时动态构造并显示
  }

  showBuildPopup(col, row) {
    // 检查该格子是否已有房间
    if (col<0||row<0||col>=BASEMENT_COLS||row>=BASEMENT_ROWS) return;
    // 如果点击了已有房间，打开房间交互
    const roomId = this.grid[col][row];
    if (roomId !== null) {
      const room = this.rooms.find(r => r.id === roomId);
      if (room) { this.openRoomDialog(room); return; }
    }
    // 该格为空，显示建造弹窗 —— 目标："点哪里就建在哪里"
    // 对于宽=2的房间，如果点击了右格子，则左对齐为起点
    this.buildPopup = { col, row };
    this.renderBuildMenu(col, row);
  }

  hideBuildPopup() {
    this.buildPopup = null;
    this.selectedBuild = null;
    const menu = document.getElementById('buildMenu');
    menu.innerHTML = '';
  }

  // 动态构造建造按钮
  renderBuildMenu(col, row) {
    const menu = document.getElementById('buildMenu');
    menu.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'build-popup-title';
    header.innerHTML = `<span>建造选择 （位置 ${col},${row}）</span>
      <button class="close-popup" onclick="game.hideBuildPopup()">✕</button>`;
    menu.appendChild(header);

    for (const [key, t] of Object.entries(ROOM_TYPES)) {
      if (key === 'command') continue;
      const size = t.size;
      const startCol = (size.w === 2 && col % 2 === 1) ? col - 1 : col;
      // 对于 1-wide 房间：直接建在点击的那格
      // 对于 2-wide 房间：如果点击的是奇数列，回退一格（保证双格子包含点击位置）
      let spaceOk = true;
      if (startCol<0||row<0||startCol+size.w>BASEMENT_COLS||row+size.h>BASEMENT_ROWS) spaceOk=false;
      if (t.unique && this.rooms.some(r => r.type === key)) spaceOk = false;
      if (spaceOk) {
        for (let dc=0;dc<size.w;dc++) for (let dr=0;dr<size.h;dr++) {
          if (this.grid[startCol+dc][row+dr] !== null) spaceOk = false;
        }
      }
      const btn = document.createElement('div');
      btn.className = 'build-btn';
      btn.dataset.type = key;
      btn.dataset.startCol = startCol;
      btn.dataset.row = row;
      if (!spaceOk) btn.classList.add('no-space');
      let costStr = Object.entries(t.cost).map(([k,v]) => `${this.resIcon(k)}${v}`).join(' ');
      btn.innerHTML = `<div class="icon">${t.icon}</div><div>${t.name}</div><div class="cost">${costStr}</div>`;
      btn.title = t.desc;
      btn.onclick = () => {
        if (!this.canAfford(t.cost)) { this.log('资源不足！', '#f55'); return; }
        if (!spaceOk) { this.log('位置不足！', '#f55'); return; }
        this.tryBuild(key, parseInt(btn.dataset.startCol), parseInt(btn.dataset.row));
        this.hideBuildPopup();
      };
      menu.appendChild(btn);
    }
    this.updateBuildBtns();
  }

  resIcon(k) {
    return k==='gold'?'◉':k==='food'?'♥':k==='power'?'⚡':'';
  }

  selectBuild(type) {
    if (!this.running || this.gameOver) return;
    if (this.selectedBuild === type) {
      this.selectedBuild = null;
    } else {
      if (!this.canAfford(ROOM_TYPES[type].cost)) {
        this.log('资源不足！', '#f55');
        return;
      }
      this.selectedBuild = type;
    }
    this.updateBuildBtns();
  }

  updateBuildBtns() {
    document.querySelectorAll('.build-btn').forEach(btn => {
      const t = btn.dataset.type;
      if (!t) return;
      const type = ROOM_TYPES[t];
      btn.classList.toggle('active', t === this.selectedBuild);
      btn.disabled = !this.canAfford(type.cost);
      const costEl = btn.querySelector('.cost');
      if (costEl) {
        const costStr = Object.entries(type.cost).map(([k,v]) => `${this.resIcon(k)}${v}`).join(' ');
        costEl.textContent = costStr;
        costEl.style.color = this.canAfford(type.cost) ? '#ffcc44' : '#f55';
      }
    });
  }

  canAfford(cost) {
    for (const [k,v] of Object.entries(cost)) {
      if ((this.resources[k]||0) < v) return false;
    }
    return true;
  }

  pay(cost) {
    for (const [k,v] of Object.entries(cost)) this.resources[k] -= v;
  }

  // ==================== 建造系统 ====================
  tryBuild(typeKey, col, row) {
    const type = ROOM_TYPES[typeKey];
    const size = type.size;
    if (col<0||row<0||col+size.w>BASEMENT_COLS||row+size.h>BASEMENT_ROWS) return false;
    if (type.unique && this.rooms.some(r => r.type === typeKey)) {
      this.log(`${type.name} 只能建造一个！`, '#f55');
      return false;
    }
    for (let dc=0;dc<size.w;dc++) for (let dr=0;dr<size.h;dr++) {
      if (this.grid[col+dc][row+dr] !== null) {
        this.log('该位置已被占用！', '#f55');
        return false;
      }
    }
    if (!this.canAfford(type.cost)) { this.log('资源不足！', '#f55'); return false; }
    this.pay(type.cost);
    this.placeRoom(typeKey, col, row);
    this.log(`✓ 建造了 ${type.name}`, '#8f8');
    this.updateBuildBtns();
    return true;
  }

  placeRoom(typeKey, col, row, free=false) {
    const type = ROOM_TYPES[typeKey];
    const size = type.size;
    const id = ++this.roomIdCounter;
    const room = { id, type: typeKey, col, row, size, typeData: type, produceTimer: 0, useCd: 0 };
    this.rooms.push(room);
    for (let dc=0;dc<size.w;dc++) for (let dr=0;dr<size.h;dr++)
      this.grid[col+dc][row+dr] = id;
    this.applyRoomEffects();
    return room;
  }

  applyRoomEffects() {
    this.atkBonus = 0;
    this.capacity = { gold:500, food:300, power:200 };
    this.traps = [];
    this.hasBlacksmith = false;
    let barracksCount = 0;
    for (const r of this.rooms) {
      const e = r.typeData.effect;
      if (!e) continue;
      if (e.atkBonus) this.atkBonus += e.atkBonus;
      if (e.capacity) for (const k of Object.keys(this.capacity)) this.capacity[k] += e.capacity;
      if (e.soldier) barracksCount++;
      if (e.trapDmg) this.traps.push({dmg:e.trapDmg, count:e.trapCount||3});
      if (e.blacksmith) this.hasBlacksmith = true;
    }
    this.syncSoldiers(barracksCount);
  }

  // ==================== 房间对话（升级 + 手动使用功能） ====================
  openRoomDialog(room) {
    if (room.type === 'blacksmith') {
      this.showBlacksmithDialog();
      return;
    }
    const use = ROOM_USE[room.type];
    const menu = document.getElementById('buildMenu');
    let html = `<div class="build-popup-title">
      <span>${room.typeData.icon} ${room.typeData.name}</span>
      <button class="close-popup" onclick="game.hideBuildPopup()">✕</button>
    </div>
    <div class="bs-info">
      <div style="color:#aaa;font-size:11px">${room.typeData.desc}</div>`;
    if (room.typeData.produce) {
      const p = room.typeData.produce;
      const entries = Object.entries(p).filter(([k])=>k!=='interval');
      if (entries.length) {
        const s = entries.map(([k,v])=>`${this.resIcon(k)}+${v}/s`).join(' ');
        html += `<div style="color:#8f8;margin-top:3px">自动产出: ${s}</div>`;
      }
    }
    html += `</div>`;
    if (use) {
      const cdLeft = Math.max(0, room.useCd || 0);
      const costStr = Object.keys(use.cost).length
        ? Object.entries(use.cost).map(([k,v])=>`${this.resIcon(k)}${v}`).join(' ')
        : '—免费—';
      const canPay = this.canAfford(use.cost);
      const ready = cdLeft <= 0 && canPay;
      html += `<div class="bs-upgrade">
        <div style="color:#ff0;font-size:13px;margin-bottom:4px">${use.label}</div>
        <div style="color:#bbb;font-size:11px">${use.desc}</div>
        <div class="bs-cost">消耗: <span style="color:${canPay?'#ffcc44':'#f55'}">${costStr}</span>
          ${cdLeft > 0 ? ` · 冷却: <b style="color:#fa5">${cdLeft.toFixed(1)}s</b>` : ''}
        </div>
        <button class="bs-btn" ${ready?'':'disabled'}
          onclick="game.useRoomFeature(${room.id})">${ready ? '▶ 触发' : '等待中'}</button>
      </div>`;
    } else {
      html += `<div class="bs-upgrade" style="color:#aaa;text-align:center">该房间无可手动触发功能</div>`;
    }
    menu.innerHTML = html;
    this.playerRoomDialog = { type: 'room', roomId: room.id };
  }

  useRoomFeature(roomId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return;
    const use = ROOM_USE[room.type];
    if (!use) return;
    if ((room.useCd||0) > 0) { this.log('功能冷却中...', '#faa'); return; }
    if (!this.canAfford(use.cost)) { this.log('资源不足！', '#f55'); return; }
    this.pay(use.cost);
    room.useCd = use.cd;
    try { use.effect(this); } catch(e) { console.error(e); }
    this.log(`✓ ${room.typeData.name}：${use.label} 生效！`, '#ff0');
    this.openRoomDialog(room); // 刷新面板（冷却/资源）
  }

  showBlacksmithDialog() {
    const menu = document.getElementById('buildMenu');
    const nextLv = this.playerLevel + 1;
    const current = BLACKSMITH_UPGRADES[this.playerLevel - 1];
    let html = `<div class="build-popup-title">
      <span>⚒ 铁匠铺 · 装备升级</span>
      <button class="close-popup" onclick="game.hideBuildPopup()">✕</button>
    </div>
    <div class="bs-info">
      <div>当前等级: <b style="color:#ff0">Lv.${this.playerLevel}</b> · ${current.name}</div>
      <div>攻击: ${this.player.atk} · 生命: ${this.player.maxHp} · 速度: ${this.player.speed}</div>
    </div>`;

    if (nextLv <= BLACKSMITH_UPGRADES.length) {
      const nx = BLACKSMITH_UPGRADES[nextLv - 1];
      const costStr = Object.entries(nx.cost).map(([k,v]) => `${this.resIcon(k)}${v}`).join(' ');
      const canUp = this.canAfford(nx.cost);
      html += `<div class="bs-upgrade">
        <div>下一级: <b style="color:#8f8">Lv.${nextLv}</b> · ${nx.name}</div>
        <div>攻击 +${nx.atk - current.atk} · 生命 +${nx.hp - current.hp} · 速度 +${nx.speed - current.speed}</div>
        <div class="bs-cost">消耗: <span style="color:${canUp?'#ffcc44':'#f55'}">${costStr}</span></div>
        <button class="bs-btn" ${canUp?'':'disabled'} onclick="game.doUpgrade()">⚒ 升级装备</button>
      </div>`;
    } else {
      html += `<div class="bs-upgrade"><b style="color:#ff0">已达满级！装备已神化。</b></div>`;
    }
    menu.innerHTML = html;
    this.playerRoomDialog = { type: 'blacksmith' };
  }

  doUpgrade() {
    const nextLv = this.playerLevel + 1;
    if (nextLv > BLACKSMITH_UPGRADES.length) return;
    const nx = BLACKSMITH_UPGRADES[nextLv - 1];
    if (!this.canAfford(nx.cost)) { this.log('资源不足，无法升级！', '#f55'); return; }
    this.pay(nx.cost);
    this.playerLevel = nextLv;
    this.player.maxHp = nx.hp;
    this.player.hp = nx.hp;
    this.player.atk = nx.atk;
    this.player.speed = nx.speed;
    this.log(`⚒ 升级成功！Lv.${nextLv} · ${nx.name}`, '#ff0');
    this.showBlacksmithDialog();
  }

  syncSoldiers(targetCount) {
    const positions = [];
    const baseY = GROUND_Y - 20;
    const offsets = [40, -40, 80, -80, 120, -120, 160, -160, 200, -200];
    for (let i=0;i<Math.min(targetCount, 10);i++)
      positions.push({x: DOOR_X + (offsets[i]||((i-5)*50)), y: baseY});
    // 保留临时士兵（他们有 temp:true），只处理永久 ones
    const perms = this.soldiers.filter(s => !s.temp);
    while (perms.length < targetCount) {
      const idx = perms.length;
      const pos = positions[idx] || {x: DOOR_X + (idx*30-100), y: baseY};
      const ns = {
        x: pos.x, y: pos.y, targetX: pos.x,
        hp: 30, maxHp: 30, attackRange: 140,
        attackCd: 0, attackInterval: 1.2,
        damage: 8 * (1 + this.atkBonus), shootAnim: 0
      };
      perms.push(ns);
      this.soldiers.push(ns);
    }
    while (perms.length > targetCount) {
      const gone = perms.pop();
      const i = this.soldiers.indexOf(gone);
      if (i >= 0) this.soldiers.splice(i, 1);
    }
    for (let i=0;i<perms.length;i++) {
      const pos = positions[i] || {x: perms[i].x, y: perms[i].y};
      perms[i].targetX = pos.x;
      perms[i].damage = 8 * (1 + this.atkBonus);
    }
  }

  // ==================== 游戏循环 ====================
  start() {
    this.running = true;
    this.gameOver = false;
    this.lastTime = performance.now();
    this.updateUI();
    this.log('基地已启动！使用 WASD 或手机摇杆控制角色', '#8ff');
    this.loop();
  }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;
    if (!this.paused) this.update(dt);
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  // ==================== 暂停 / 恢复 ====================
  togglePause(forceState) {
    if (!this.running || this.gameOver) return;
    const wantPaused = (typeof forceState === 'boolean') ? forceState : !this.paused;
    this.paused = wantPaused;
    const panel = document.getElementById('pausePanel');
    if (panel) panel.classList.toggle('hidden', !this.paused);
    if (!this.paused) {
      // 恢复时重置计时，避免 dt 跳变
      this.lastTime = performance.now();
      this.hideBuildPopup();
    } else {
      this.updateUI(); // 暂停时刷新一次面板数据
    }
  }

  // ==================== 更新逻辑 ====================
  update(dt) {
    if (this.gameOver) return;

    // 云移动
    for (const c of this.clouds) {
      c.x -= c.s * 10 * dt;
      if (c.x + c.w < -50) { c.x = W + 50; c.y = 20 + Math.random()*60; }
    }

    // ===== 玩家更新 =====
    this.updatePlayer(dt);

    // ===== 野生资源堆 =====
    this.updateResourcePiles(dt);

    // 波次控制
    if (!this.waveActive) {
      this.nextWaveTimer -= dt;
      if (this.nextWaveTimer <= 0) this.startWave();
    } else {
      if (this.waveZombieQueue > 0) {
        this.zombieSpawnTimer -= dt;
        if (this.zombieSpawnTimer <= 0) {
          this.spawnZombie();
          this.waveZombieQueue--;
          this.zombieSpawnTimer = 0.6 + Math.random()*0.8;
        }
      }
      if (this.waveZombieQueue === 0 && this.zombies.length === 0) this.endWave();
    }

    // 房间产出 + 手动功能冷却
    for (const r of this.rooms) {
      if (r.useCd > 0) r.useCd = Math.max(0, r.useCd - dt);
      const p = r.typeData.produce;
      if (!p) continue;
      r.produceTimer += dt;
      if (r.produceTimer >= p.interval) {
        r.produceTimer -= p.interval;
        for (const [k,v] of Object.entries(p)) {
          if (k === 'interval') continue;
          if (k === 'doorHeal') {
            this.doorHp = Math.min(this.doorMaxHp, this.doorHp + v);
            this.spawnParticles(DOOR_X, GROUND_Y - DOOR_HEIGHT/2, COL.soldier, 3);
          } else {
            this.resources[k] = Math.min(this.capacity[k]||9999, (this.resources[k]||0) + v);
          }
        }
      }
    }

    // 丧尸移动与攻击
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      // 优先攻击玩家（如果玩家在陆地且距离近）
      let targetX = DOOR_X;
      let targetKind = 'door';
      if (!this.player.inBasement && this.player.hp > 0) {
        const pd = Math.abs(z.x - this.player.x);
        if (pd < 80) { targetX = this.player.x; targetKind = 'player'; }
      }
      const dx = targetX - z.x;
      const dist = Math.abs(dx);
      const dir = Math.sign(dx);
      if (dist > 18) {
        z.x += dir * z.speed * dt;
        z.walkAnim += dt * 8;
        z.attackAnim = Math.max(0, z.attackAnim - dt*3);
      } else {
        z.attackCd -= dt;
        if (z.attackCd <= 0) {
          z.attackCd = z.attackInterval;
          if (targetKind === 'door') {
            this.doorHp -= z.damage;
            this.shakeScreen();
            this.spawnParticles(DOOR_X, GROUND_Y - DOOR_HEIGHT/2, COL.red, 5);
            if (this.doorHp <= 0) { this.doorHp = 0; this.endGame(false); return; }
          } else {
            this.damagePlayer(z.damage);
          }
        }
        z.attackAnim = Math.min(1, z.attackAnim + dt*5);
      }
    }

    // 移除死亡丧尸
    for (let i=this.zombies.length-1;i>=0;i--) {
      if (this.zombies[i].hp <= 0) {
        const z = this.zombies[i];
        this.spawnParticles(z.x, z.y, COL.zombie, 10);
        this.kills++;
        const g = 2 + Math.floor(this.wave*0.5) + Math.floor(Math.random()*3);
        this.resources.gold = Math.min(this.capacity.gold, this.resources.gold + g);
        this.zombies.splice(i,1);
      }
    }

    // 士兵攻击
    const sAtkMult = this.getBuffMult('soldierAtk');
    for (const s of this.soldiers) {
      s.x += (s.targetX - s.x) * dt * 3;
      s.shootAnim = Math.max(0, s.shootAnim - dt*4);
      s.attackCd -= dt;
      if (s.attackCd <= 0) {
        let target = null, best = Infinity;
        for (const z of this.zombies) {
          const d = Math.abs(z.x - s.x);
          if (d < s.attackRange && d < best) { best = d; target = z; }
        }
        if (target) {
          s.attackCd = s.attackInterval;
          s.shootAnim = 1;
          const dx = target.x - s.x, dy = target.y - s.y;
          const d = Math.sqrt(dx*dx+dy*dy);
          this.projectiles.push({
            x: s.x, y: s.y - 10,
            vx: dx/d * 400, vy: dy/d * 400,
            dmg: s.damage * sAtkMult, life: 1.5, fromZombie: false
          });
        }
      }
    }

    // 子弹
    for (let i=this.projectiles.length-1;i>=0;i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      let hit = false;
      if (!p.fromZombie) {
        for (const z of this.zombies) {
          if (Math.abs(z.x - p.x) < 15 && Math.abs(z.y - p.y) < 20) {
            z.hp -= p.dmg;
            this.spawnParticles(p.x, p.y, COL.red, 4);
            hit = true; break;
          }
        }
      }
      if (hit || p.life <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H)
        this.projectiles.splice(i,1);
    }

    // 粒子
    for (let i=this.particles.length-1;i>=0;i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i,1);
    }

    // 消息
    for (let i=this.messages.length-1;i>=0;i--) {
      this.messages[i].life -= dt;
      if (this.messages[i].life <= 0) this.messages.splice(i,1);
    }

    // 震动衰减
    this.shakeT = (this.shakeT||0) * Math.pow(0.001, dt);

    this.updateUI();
  }

  // ===== 玩家控制更新 =====
  updatePlayer(dt) {
    const p = this.player;
    if (p.hp <= 0) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) this.respawnPlayer();
      return;
    }

    // 输入方向
    let ix = this.input.moveX;
    let iy = this.input.moveY;

    // 键盘输入叠加（摇杆已有输入时以摇杆为准）
    // 用「相加」而不是原来的 ix = (ix !== 0) ? ix : -1：
    // 那种写法是「先判定的赢」，左永远压过右。一旦某个方向键卡在按下状态
    // （按住 A 的同时 Alt-Tab 走人，keyup 就永远收不到），右方向键会就此
    // 彻底失灵 —— 表现出来正是「部分按键失效」。相加则让相反方向自然抵消。
    const K = this.input.keys;
    if (ix === 0) {
      if (K['ArrowLeft'] || K['KeyA']) ix -= 1;
      if (K['ArrowRight'] || K['KeyD']) ix += 1;
    }
    if (iy === 0) {
      if (K['ArrowUp'] || K['KeyW']) iy -= 1;
      if (K['ArrowDown'] || K['KeyS']) iy += 1;
    }

    // 归一化
    const mag = Math.sqrt(ix*ix + iy*iy);
    if (mag > 1) { ix/=mag; iy/=mag; }

    // ===== 地窖活板门 上下切换 =====
    const atDoorX = Math.abs(p.x - DOOR_X) < DOOR_WIDTH * 0.55;
    if (atDoorX) {
      // 地面→下：走到活板门附近 + 按下 方向下
      if (!p.inBasement && p.y >= GROUND_Y - 10 && iy > 0.2) {
        p.inBasement = true;
        p.y = GROUND_Y + 16;
        p.x = DOOR_X;
        this.log('▼ 进入地下室', '#8cf');
        return;
      }
      // 地下室→上：在中央楼梯顶部 + 按 方向上
      if (p.inBasement && p.y <= GROUND_Y + 22 && iy < -0.2) {
        p.inBasement = false;
        p.y = GROUND_Y - 10;
        p.x = DOOR_X;
        this.log('▲ 返回地面战场', '#8cf');
        return;
      }
    }

    // ===== 按轴移动 + 墙体/泥土碰撞 =====
    const stepX = ix * p.speed * dt;
    const stepY = iy * p.speed * dt;

    // 地面：简单区域 clamp（地面没有泥土碰撞限制，只有 y 高度范围）
    if (!p.inBasement) {
      const nx = p.x + stepX;
      const ny = p.y + stepY;
      if (this.canPlayerStand(nx, p.y, false)) p.x = nx;
      if (this.canPlayerStand(p.x, ny, false)) p.y = ny;
      if (ix !== 0) p.facing = ix > 0 ? 1 : -1;
    } else {
      // 地下室：按轴尝试移动，泥土/墙体阻挡
      const nx = p.x + stepX;
      if (this.canPlayerStand(nx, p.y, true)) {
        p.x = nx;
      } else if (ix !== 0) {
        // 地下室除了中央竖井和已建房间之外全是实心泥土，竖井里左右一共只有
        // 几十像素的余地。玩家按 A/D 顶住土墙时，画面上什么都不会发生 ——
        // 看着就像按键失灵。这里给一句话说清楚，别让人以为是 bug。
        this.hintBlocked(dt);
      }
      const ny = p.y + stepY;
      if (this.canPlayerStand(p.x, ny, true)) p.y = ny;
      if (Math.abs(ix) > Math.abs(iy) && ix !== 0) p.facing = ix > 0 ? 1 : -1;
    }

    // 攻击动画衰减
    p.attackAnim = Math.max(0, p.attackAnim - dt * 5);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 5);
    p.atkCd = Math.max(0, p.atkCd - dt);

    // 攻击
    const wantAtk = this.input.attackPressed || this.input.keys['Space'] || this.input.keys['KeyJ'];
    if (wantAtk && p.atkCd <= 0) {
      p.atkCd = p.atkInterval;
      p.attackAnim = 1;
      this.playerMeleeAttack();
    }

    // 自动拾取资源堆（只在地面）
    if (!p.inBasement) this.autoCollectPiles();
  }

  // ---- 两条「按键其实没坏」的提示，都做了限流，免得刷屏 ----
  hintBlocked(dt) {
    this._blockedT = (this._blockedT || 0) + (dt || 0.016);
    if (this._blockedT < 0.45) return;            // 顶住土墙约半秒才提示
    this._blockedT = 0;
    if (Date.now() - (this._blockedLogAt || 0) < 6000) return;
    this._blockedLogAt = Date.now();
    this.log('这里是实心泥土 —— 点击空格子建造房间，才能往两边拓宽', '#c9a');
  }

  hintNoTargetBelow() {
    if (Date.now() - (this._belowLogAt || 0) < 6000) return;
    this._belowLogAt = Date.now();
    this.log('丧尸都在地面上 —— 从中央竖井按 W / ↑ 回地面再挥剑', '#c9a');
  }

  playerMeleeAttack() {
    const p = this.player;
    const range = p.atkRange;
    const hitX = p.x + p.facing * range * 0.7;
    const hitY = p.y;
    const atkMult = this.getBuffMult('playerAtk');
    const dmg = p.atk * atkMult;
    let hit = false;
    // 如果玩家在地下室，就不攻击丧尸（丧尸在地面），只产生挥动特效。
    // 同样要说明原因：在下面挥剑没有任何命中反馈，很容易被当成攻击键坏了。
    if (p.inBasement) {
      this.hintNoTargetBelow();
    }
    if (!p.inBasement) {
      for (const z of this.zombies) {
        const dx = z.x - hitX;
        const dy = z.y - hitY;
        if (Math.abs(dx) < range*0.7 && Math.abs(dy) < 30) {
          z.hp -= dmg;
          this.spawnParticles(z.x, z.y, COL.red, 6);
          hit = true;
        }
      }
    }
    // 挥砍特效
    this.spawnParticles(hitX, hitY-10, hit?COL.gold:COL.stoneLight, hit?8:3);
  }

  damagePlayer(dmg) {
    const p = this.player;
    p.hp -= dmg;
    p.hitFlash = 1;
    this.spawnParticles(p.x, p.y-15, COL.red, 8);
    if (p.hp <= 0) {
      p.hp = 0;
      p.respawnTimer = 5;
      this.log('☠ 你倒在了丧尸群中... 5秒后在指挥中心复活', '#f55');
    }
  }

  respawnPlayer() {
    // 复活在指挥中心上方（门口内侧）
    this.player.x = DOOR_X;
    this.player.y = GROUND_Y - 22;
    this.player.hp = this.player.maxHp;
    this.player.inBasement = false;
    this.log('✚ 你已重生！', '#8ff');
  }

  // ===== 野生资源堆 =====
  updateResourcePiles(dt) {
    this.pileSpawnTimer -= dt;
    if (this.pileSpawnTimer <= 0) {
      this.pileSpawnTimer = RESOURCE_PILE.spawnInterval;
      if (this.resourcePiles.length < RESOURCE_PILE.maxCount) {
        this.spawnResourcePile();
      }
    }
    for (const pile of this.resourcePiles) {
      pile.bob = (pile.bob||0) + dt * 3;
    }
  }

  spawnResourcePile() {
    // 只在陆地上生成，避开大门正前方
    let x, y, tries = 0;
    do {
      const fromLeft = Math.random() < 0.5;
      x = fromLeft ? (20 + Math.random() * (DOOR_X - DOOR_WIDTH/2 - 60))
                   : (DOOR_X + DOOR_WIDTH/2 + 60 + Math.random() * (W - DOOR_X - DOOR_WIDTH/2 - 80));
      y = GROUND_Y - 15 - Math.random() * 20;
      tries++;
    } while (tries < 10 && Math.abs(x - DOOR_X) < 80);

    const types = ['gold', 'food', 'power'];
    const weights = [0.5, 0.35, 0.15];
    let r = Math.random(), acc = 0, type = 'gold';
    for (let i=0;i<types.length;i++) { acc += weights[i]; if (r <= acc) { type = types[i]; break; } }
    const [mn, mx] = RESOURCE_PILE.values[type];
    const amount = mn + Math.floor(Math.random() * (mx - mn + 1));
    this.resourcePiles.push({ x, y, type, amount, bob: Math.random()*Math.PI*2 });
  }

  autoCollectPiles() {
    if (this.player.hp <= 0) return;
    for (let i=this.resourcePiles.length-1;i>=0;i--) {
      const pile = this.resourcePiles[i];
      const dx = pile.x - this.player.x;
      const dy = (pile.y + 10) - (this.player.y + 5);
      if (Math.sqrt(dx*dx + dy*dy) < RESOURCE_PILE.collectRadius) {
        this.resources[pile.type] = Math.min(this.capacity[pile.type], this.resources[pile.type] + pile.amount);
        this.spawnParticles(pile.x, pile.y, pile.type==='gold'?COL.gold:pile.type==='food'?COL.food:COL.power, 10);
        this.log(`✦ 拾取 ${pile.amount} ${this.resIcon(pile.type)}`, pile.type==='gold'?'#ff0':pile.type==='food'?'#8f8':'#8af');
        this.resourcePiles.splice(i,1);
      }
    }
  }

  // ==================== 波次系统 ====================
  shakeScreen() { this.shakeT = 0.6; }

  startWave() {
    this.wave++;
    this.waveActive = true;
    this.waveZombieQueue = 5 + this.wave * 3 + Math.floor(this.wave*this.wave*0.3);
    this.zombieSpawnTimer = 0.5;
    this.showWaveText(`第 ${this.wave} 波来袭！`);
    this.log(`⚠ 第 ${this.wave} 波丧尸来袭！(${this.waveZombieQueue}只)`, '#f55');

    // 陷阱效果
    let remaining = [...Array(this.waveZombieQueue).keys()];
    for (const trap of this.traps) {
      for (let i=0;i<trap.count && remaining.length>0;i++) {
        const idx = Math.floor(Math.random()*remaining.length);
        remaining.splice(idx,1);
      }
    }
    const trappedCount = this.waveZombieQueue - remaining.length;
    if (trappedCount > 0) {
      this.log(`✴ 陷阱触发！预先击杀 ${trappedCount} 只`, '#fa5');
      this.waveZombieQueue = remaining.length;
      this.kills += trappedCount;
    }
  }

  endWave() {
    this.waveActive = false;
    this.nextWaveTimer = 20 + this.wave * 2;
    const bonus = 20 + this.wave * 10;
    this.resources.gold = Math.min(this.capacity.gold, this.resources.gold + bonus);
    // 清理波结束时的临时援军士兵
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      if (this.soldiers[i].temp) this.soldiers.splice(i, 1);
    }
    this.tempSoldierCount = 0;
    this.showWaveText(`第 ${this.wave} 波清除！+${bonus}金币`);
    this.log(`✓ 第 ${this.wave} 波清除！奖励 ${bonus} 金币，下次 ${Math.ceil(this.nextWaveTimer)}s 后`, '#8f8');
  }

  showWaveText(txt) {
    const el = document.getElementById('waveInfo');
    el.textContent = txt;
    el.style.opacity = 1;
    setTimeout(()=>{ el.style.opacity = 0; }, 2500);
  }

  spawnZombie() {
    const fromLeft = Math.random() < 0.5;
    const type = Math.random();
    const w = this.wave;
    // 逐波递增：HP 指数增长，速度线性增长，伤害线性增长
    const baseHp = 12 + w * 3 + Math.floor(w * w * 0.4);
    const baseSpeed = 32 + w * 2.5 + Math.random() * 12;
    const baseDmg = 4 + Math.floor(w * 0.8);
    let z = {
      x: fromLeft ? -20 : W + 20,
      y: GROUND_Y - 22,
      hp: baseHp,
      maxHp: baseHp,
      speed: baseSpeed,
      damage: baseDmg,
      attackCd: 0, attackInterval: Math.max(0.5, 1.3 - w * 0.03),
      walkAnim: 0, attackAnim: 0,
      type: 'normal'
    };
    // 快速丧尸：波数>=3，概率随波数增大
    const fastChance = Math.min(0.25, 0.08 + w * 0.01);
    // 坦克丧尸：波数>=5，概率随波数增大
    const tankChance = Math.min(0.20, 0.05 + w * 0.01);
    if (type < fastChance && w >= 3) {
      z.hp = Math.floor(z.hp * 0.55); z.maxHp = z.hp;
      z.speed *= 2.2; z.type = 'fast';
      z.damage = Math.floor(z.damage * 0.7);
    } else if (type < fastChance + tankChance && w >= 5) {
      z.hp = Math.floor(z.hp * 4); z.maxHp = z.hp;
      z.speed *= 0.45; z.type = 'tank';
      z.damage = Math.floor(z.damage * 2.5); z.y -= 5;
    }
    this.zombies.push(z);
  }

  spawnParticles(x, y, color, n) {
    for (let i=0;i<n;i++) {
      this.particles.push({
        x, y,
        vx: (Math.random()-0.5)*200,
        vy: (Math.random()-1)*150,
        color, life: 0.3 + Math.random()*0.5,
        size: 2 + Math.floor(Math.random()*3)
      });
    }
  }

  log(txt, color='#8ff') {
    this.messages.unshift({txt, color, life: 4});
    if (this.messages.length > 6) this.messages.length = 6;
    const el = document.getElementById('messageLog');
    el.innerHTML = '';
    for (const m of this.messages) {
      const d = document.createElement('div');
      d.className = 'log-msg';
      d.style.color = m.color;
      d.style.borderLeftColor = m.color;
      d.textContent = m.txt;
      el.appendChild(d);
    }
  }

  endGame(win) {
    this.gameOver = true;
    this.running = false;
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    if (!win) {
      ov.innerHTML = `
        <h1 style="color:#ff4444;text-shadow:4px 4px 0 #000,0 0 30px #f00">☠ 基地沦陷 ☠</h1>
        <h2>大门已被攻破！</h2>
        <p>你存活了 <span style="color:#ff0;font-size:20px">${this.wave}</span> 波</p>
        <p>击杀丧尸：<span style="color:#f88;font-size:18px">${this.kills}</span></p>
        <p>建造房间：<span style="color:#8f8;font-size:18px">${this.rooms.length}</span></p>
        <p>装备等级：<span style="color:#fa5;font-size:18px">Lv.${this.playerLevel}</span></p>
      `;
    }
    const btn = document.createElement('button');
    btn.textContent = '↻ 重新开始';
    btn.onclick = () => location.reload();
    ov.appendChild(btn);
    ov.classList.remove('hidden');
  }

  updateUI() {
    // —— 极简 HUD（游戏中常驻）：波数 + 资源 + 武器等级/耐久 ——
    const waveEl = document.getElementById('waveTxt');
    if (waveEl) waveEl.textContent = this.wave;

    // 左上角资源（精简数字）
    const setHud = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setHud('goldTxt', Math.floor(this.resources.gold));
    setHud('foodTxt', Math.floor(this.resources.food));
    setHud('powerTxt', Math.floor(this.resources.power));

    // 玩家耐久/HP 条
    const php = document.getElementById('playerHpBar');
    if (php) php.style.width = (this.player.hp / Math.max(1,this.player.maxHp) * 100) + '%';
    const plvl = document.getElementById('playerLvlTxt');
    if (plvl) plvl.textContent = `Lv.${this.playerLevel} ${BLACKSMITH_UPGRADES[this.playerLevel-1].name}`;

    // —— 暂停面板内的详细状态 ——
    setHud('pGoldTxt', Math.floor(this.resources.gold));
    setHud('pFoodTxt', Math.floor(this.resources.food));
    setHud('pPowerTxt', Math.floor(this.resources.power));
    setHud('goldCapTxt', this.capacity.gold);
    setHud('foodCapTxt', this.capacity.food);
    setHud('powerCapTxt', this.capacity.power);
    setHud('killTxt', this.kills);
    setHud('doorHpTxt', `${Math.max(0,Math.ceil(this.doorHp))}/${this.doorMaxHp}`);
    setHud('nextWaveTxt', this.waveActive ? '进行中' : `${Math.ceil(this.nextWaveTimer)}s 后`);

    this.updateBuildBtns();
  }

  // ==================== 像素绘制辅助 ====================
  drawPixelRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  drawPixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y=-r;y<=r;y++) for (let x=-r;x<=r;x++) {
      if (x*x+y*y <= r*r) ctx.fillRect(Math.floor(cx+x), Math.floor(cy+y), 1, 1);
    }
  }

  drawStar(ctx, cx, cy, spikes, r) {
    ctx.beginPath();
    let rot = Math.PI/2*3;
    const step = Math.PI/spikes;
    ctx.moveTo(cx, cy-r);
    for (let i=0;i<spikes;i++) {
      ctx.lineTo(cx+Math.cos(rot)*r, cy+Math.sin(rot)*r);
      rot += step;
      ctx.lineTo(cx+Math.cos(rot)*(r/2), cy+Math.sin(rot)*(r/2));
      rot += step;
    }
    ctx.lineTo(cx, cy-r);
    ctx.closePath();
    ctx.fill();
  }

  // ==================== 存档：导出/导入快照 ====================
  exportSnapshot() {
    return {
      resources: { ...this.resources },
      capacity: { ...this.capacity },
      wave: this.wave,
      nextWaveTimer: this.nextWaveTimer,
      kills: this.kills,
      doorHp: this.doorHp,
      doorMaxHp: this.doorMaxHp,
      playerLevel: this.playerLevel,
      player: JSON.parse(JSON.stringify(this.player)),
      rooms: JSON.parse(JSON.stringify(this.rooms)),
      roomIdCounter: this.roomIdCounter,
      grid: this.grid.map(col => col.slice()),
      atkBonus: this.atkBonus,
      hasBlacksmith: this.hasBlacksmith,
      waveActive: false,          // 恢复时取消波次进行中状态
      waveZombieQueue: 0,
      gameOver: false,
      playTime: this._playTime || 0,
    };
  }

  importSnapshot(data) {
    try {
      if (!data || !data.player || !Array.isArray(data.grid)) {
        return { ok: false, msg: '存档数据格式异常' };
      }
      // 用 reset 重建所有运行时状态
      this.reset();
      // 再覆盖为存档数据
      Object.assign(this.resources, data.resources || {});
      Object.assign(this.capacity, data.capacity || {});
      this.wave = data.wave || 0;
      this.nextWaveTimer = data.nextWaveTimer || 15;
      this.kills = data.kills || 0;
      this.doorHp = data.doorHp ?? 100;
      this.doorMaxHp = data.doorMaxHp || 100;
      this.playerLevel = data.playerLevel || 1;
      this.player = Object.assign(this.player, data.player);
      this.rooms = data.rooms || [];
      this.roomIdCounter = data.roomIdCounter || this.rooms.length;
      // grid：逐格复制（避免浅拷贝）
      if (data.grid && data.grid.length === BASEMENT_COLS) {
        for (let c = 0; c < BASEMENT_COLS; c++) {
          for (let r = 0; r < BASEMENT_ROWS; r++) {
            this.grid[c][r] = (data.grid[c] && data.grid[c][r] != null) ? data.grid[c][r] : null;
          }
        }
      }
      this.atkBonus = data.atkBonus || 0;
      this.hasBlacksmith = !!data.hasBlacksmith;
      this.waveActive = false;
      this.waveZombieQueue = 0;
      this.gameOver = false;
      // 清除临时战斗实体
      this.zombies = [];
      this.soldiers = [];
      this.projectiles = [];
      this.particles = [];
      this.traps = [];
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: String(err) };
    }
  }

  // 游戏中保存到指定槽位（暂停面板调用）
  async saveToSlot(slot) {
    if (slot < 1 || slot > AuthAPI.MAX_SAVES) { alert('槽位必须在 1-' + AuthAPI.MAX_SAVES); return; }
    const slots = await AuthAPI.listSaves();
    const existing = slots[slot - 1];
    const defaultName = existing && existing.filled ? existing.name : `手动存档 ${slot}`;
    const name = prompt('存档名称：', defaultName);
    if (name === null) return;
    const r = await AuthAPI.save(slot, this.exportSnapshot(), name);
    if (r.ok) {
      alert('✓ ' + r.msg);
      this._autoSaveSlot = slot;
    } else {
      alert('保存失败：' + r.msg);
    }
  }
}
