// ==================== 自然灾害系统 ====================
//
// 三种天灾，各自的「破坏形状」不同 —— 这是它们在玩法上唯一真正的区别：
//   陨石 meteor    砸出一个窄而深的坑（1~3 列），命中列的房间重伤
//   地震 quake     不砸穿地表，但沿一条水平带广域震坏房间，并随机震裂几处地表
//   火山 volcano   从某一列喷发，摧毁一大片地表（5~7 列），并持续掉落岩浆
//
// 与地形的关系：地表被砸穿后，那一列的房间就**裸露在外**，
// 丧尸会直接跳下去啃房间，而不是绕去撞大门。修补手段是造混凝土块。
//
// 预警：默认只在天灾降临前一刻才有画面征兆。
// 造了天气预报站之后，HUD 会提前把类型和落点报出来 —— 这就是那个房间的全部价值。
// ============================================================================

const DISASTER_TYPES = {
  meteor: {
    name: '陨石', icon: '☄',
    color: '#ff8844',
    warn: '陨石正在坠落',
    desc: '砸穿地表，命中处的房间重创',
  },
  quake: {
    name: '地震', icon: '〰',
    color: '#c9a227',
    warn: '地壳开始震动',
    desc: '大范围震坏地下室，地表出现裂口',
  },
  volcano: {
    name: '火山喷发', icon: '🌋',
    color: '#ff4422',
    warn: '地底传来轰鸣',
    desc: '喷发点周围地表大面积塌陷',
  },
};

class DisasterSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.active = null;        // 正在发生的灾害
    this.next = null;          // 已排期、尚未发生的灾害
    this.revealed = false;     // 是否已对玩家公开（预报站 / 深度扫描）
    this.timer = 0;            // 距离下次灾害的秒数
    this.enabled = false;
    this.effects = [];         // 画面上的临时特效（陨石轨迹、岩浆等）
    this.shakeUntil = 0;
  }

  /** 由 engine 在开局时调用；主线前几关不开天灾。 */
  enable(on) {
    this.enabled = !!on;
    if (on && !this.next) this.schedule();
  }

  // ------------------------------------------------------------- 排期

  schedule() {
    const g = this.game;
    const kinds = Object.keys(DISASTER_TYPES);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    // 落点避开正中央的竖井：把玩家唯一的上下通道砸了，体验只有挫败没有乐趣
    const shaftCol = Math.floor(DOOR_X / TILE);
    let col;
    let guard = 0;
    do {
      col = 1 + Math.floor(Math.random() * (BASEMENT_COLS - 2));
    } while (Math.abs(col - shaftCol) < 2 && guard++ < 20);

    this.next = { kind, col };
    this.revealed = false;
    // 间隔随波数缩短，但给一个下限，免得后期变成天灾连发
    const base = Math.max(24, 52 - (g.wave || 0) * 2);
    this.timer = base + Math.random() * 16;
  }

  /** 天气预报站 / 深度扫描：把下一次灾害对玩家公开。 */
  revealNext() {
    if (!this.next) return false;
    if (!this.revealed) {
      this.revealed = true;
      const t = DISASTER_TYPES[this.next.kind];
      this.game.log(`📡 预测到 ${t.icon} ${t.name} —— 约 ${Math.ceil(this.timer)} 秒后，第 ${this.next.col} 列`, t.color);
    }
    return true;
  }

  // ------------------------------------------------------------- 更新

  update(dt) {
    const g = this.game;
    if (!this.enabled || g.gameOver) return;

    // 有预报站就自动公开
    if (this.next && !this.revealed && g.hasForecast && this.timer < 30) {
      this.revealNext();
    }

    if (this.next) {
      this.timer -= dt;
      // 最后 4 秒无论有没有预报站都给出画面征兆 —— 天灾可以突然，但不能毫无预兆
      if (this.timer <= 4 && !this.next.warned) {
        this.next.warned = true;
        const t = DISASTER_TYPES[this.next.kind];
        g.log(`${t.icon} ${t.warn}！`, t.color);
        Sound.sfx('waveStart');
        this.shakeUntil = performance.now() / 1000 + 4;
      }
      if (this.timer <= 0) {
        this.strike(this.next.kind, this.next.col);
        this.next = null;
        this.schedule();
      }
    }

    // 特效寿命
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t -= dt;
      if (e.vy != null) { e.x += (e.vx || 0) * dt; e.y += e.vy * dt; }
      if (e.t <= 0) this.effects.splice(i, 1);
    }
  }

  // ------------------------------------------------------------- 降临

  strike(kind, col) {
    const g = this.game;
    const t = DISASTER_TYPES[kind];
    g.log(`${t.icon} ${t.name}降临！`, t.color);
    Sound.sfx('doorHit');
    g.shakeScreen();
    this.shakeUntil = performance.now() / 1000 + 1.6;

    if (kind === 'meteor') this._meteor(col);
    else if (kind === 'quake') this._quake(col);
    else this._volcano(col);

    g.updateUI();
  }

  _meteor(col) {
    const g = this.game;
    const w = 1 + Math.floor(Math.random() * 3);          // 1~3 列
    const from = Math.max(0, col - (w >> 1));
    for (let c = from; c < Math.min(BASEMENT_COLS, from + w); c++) {
      g.breakSurface(c);
      g.damageRoomsInColumn(c, 70, 3);                     // 只砸穿上面三层
    }
    this.effects.push({ kind: 'crater', x: (from + w / 2) * TILE, y: GROUND_Y, t: 1.2 });
    for (let i = 0; i < 24; i++) {
      g.spawnParticles((from + Math.random() * w) * TILE, GROUND_Y - Math.random() * 20, '#ff8844', 1);
    }
  }

  _quake(col) {
    const g = this.game;
    // 地震不砸穿地表，而是沿一条水平带广域震坏 —— 破坏形状和陨石完全不同
    const row = 1 + Math.floor(Math.random() * Math.max(1, BASEMENT_ROWS - 3));
    for (const r of g.rooms.slice()) {
      if (r.row <= row + 1 && r.row + r.size.h >= row) g.damageRoom(r, 45);
    }
    // 顺带震裂几处地表
    const cracks = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cracks; i++) {
      g.breakSurface(Math.floor(Math.random() * BASEMENT_COLS));
    }
    this.effects.push({ kind: 'quake', t: 1.8 });
    g.spawnParticles(W / 2, GROUND_Y + 40, '#c9a227', 20);
  }

  _volcano(col) {
    const g = this.game;
    const w = 5 + Math.floor(Math.random() * 3);           // 5~7 列，最广
    const from = Math.max(0, col - (w >> 1));
    for (let c = from; c < Math.min(BASEMENT_COLS, from + w); c++) {
      g.breakSurface(c);
      g.damageRoomsInColumn(c, 55, 2);
    }
    // 岩浆：喷发后继续往下掉一小会儿
    for (let i = 0; i < 14; i++) {
      this.effects.push({
        kind: 'lava',
        x: (from + Math.random() * w) * TILE,
        y: GROUND_Y - 40 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 30,
        vy: 90 + Math.random() * 80,
        t: 1.4 + Math.random(),
      });
    }
    this.effects.push({ kind: 'crater', x: (from + w / 2) * TILE, y: GROUND_Y, t: 1.6 });
  }

  // ------------------------------------------------------------- 给 HUD

  /** 返回 HUD 要显示的预报信息；没有预报站、或还没排期时返回 null。 */
  forecast() {
    if (!this.enabled || !this.next) return null;
    if (!this.revealed) return null;
    const t = DISASTER_TYPES[this.next.kind];
    return {
      icon: t.icon, name: t.name, color: t.color,
      seconds: Math.max(0, Math.ceil(this.timer)),
      col: this.next.col,
      imminent: this.timer <= 8,
    };
  }
}

window.DISASTER_TYPES = DISASTER_TYPES;
window.DisasterSystem = DisasterSystem;
