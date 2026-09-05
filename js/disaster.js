// ==================== 自然灾害系统 ====================
//
// 三种天灾，各自的「破坏形状」不同 —— 这是它们在玩法上唯一真正的区别：
//   陨石 meteor    一个**大坑**：中心整段洞穿，边缘按距离递减地削薄
//   地震 quake     **满地小坑**：撒出十几个浅坑，单次穿不透，反复几次就千疮百孔
//   火山 volcano   **均匀侵蚀整个地表**：所有列同时削掉相同的一层，一视同仁
//
// 三者的差别刻意做成「面积 × 深度」的两个极端：
// 陨石是窄而深，地震是广而浅，火山是全场等深。
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
    desc: '砸出一个大坑，中心洞穿、边缘削薄',
  },
  quake: {
    name: '地震', icon: '〰',
    color: '#c9a227',
    warn: '地壳开始震动',
    desc: '满地小坑，地下室大范围震损',
  },
  volcano: {
    name: '火山喷发', icon: '🌋',
    color: '#ff4422',
    warn: '地底传来轰鸣',
    desc: '均匀侵蚀整个地表，全场同时变薄',
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
    // 一个**大坑**：中心整段洞穿，边缘按距离递减地削薄，
    // 所以坑沿是斜的而不是一刀切下去 —— 这才像被砸出来的。
    const radius = 2 + Math.floor(Math.random() * 3);        // 2~4，总宽 5~9 列
    for (let d = -radius; d <= radius; d++) {
      const c = col + d;
      if (c < 0 || c >= BASEMENT_COLS) continue;
      const t = 1 - Math.abs(d) / (radius + 1);              // 中心 1，边缘趋 0
      // 中心那几列直接洞穿，越靠边只是削薄
      g.damageSurface(c, t >= 0.7 ? 1 : t * 0.9);
    }
    // 冲击波额外砸伤中心正下方的房间
    for (let d = -1; d <= 1; d++) g.damageRoomsInColumn(col + d, 70, 3);

    this.effects.push({ kind: 'crater', x: col * TILE + TILE / 2, y: GROUND_Y,
                        t: 1.4, w: (radius * 2 + 1) * TILE });
    for (let i = 0; i < 30; i++) {
      g.spawnParticles((col + (Math.random() - 0.5) * radius * 2) * TILE,
                       GROUND_Y - Math.random() * 24, '#ff8844', 1);
    }
  }

  _quake(col) {
    const g = this.game;
    // **满地小坑**：撒出很多个浅坑，单次基本穿不透，
    // 但地震反复来几次，整片地表就会被啃得千疮百孔。
    // 这跟陨石「一个大洞」形成鲜明对比 —— 面积广、深度浅。
    const pits = 10 + Math.floor(Math.random() * 8);         // 10~17 个
    const hit = new Set();
    for (let i = 0; i < pits; i++) {
      const c = Math.floor(Math.random() * BASEMENT_COLS);
      hit.add(c);
      g.damageSurface(c, 0.28 + Math.random() * 0.34);       // 浅
    }
    // 地下的破坏才是地震的主场：沿一条水平带广域震坏房间
    const row = 1 + Math.floor(Math.random() * Math.max(1, BASEMENT_ROWS - 3));
    for (const r of g.rooms.slice()) {
      if (r.row <= row + 1 && r.row + r.size.h >= row) g.damageRoom(r, 45);
    }
    this.effects.push({ kind: 'quake', t: 2.0 });
    for (const c of hit) g.spawnParticles(c * TILE + TILE / 2, GROUND_Y, '#c9a227', 4);
  }

  _volcano(col) {
    const g = this.game;
    // **均匀侵蚀整个地表**：所有列同时削掉相同的一层，一视同仁。
    // 这是三种天灾里唯一「全场生效」的 —— 它不挑地方，它就是把整层地皮
    // 磨薄一圈。单次通常穿不透，但每喷发一次全场就离塌陷更近一步，
    // 而且已经被砸薄过的地方会先破。
    const erosion = 0.22 + Math.random() * 0.16;
    let breached = 0;
    for (let c = 0; c < BASEMENT_COLS; c++) {
      if (g.damageSurface(c, erosion)) breached++;
    }
    g.log(`🌋 熔岩漫过整片地表，全场侵蚀 ${Math.round(erosion * 100)}%` +
          (breached ? `，${breached} 处塌陷` : ''), '#ff6644');

    // 喷发口附近额外掉岩浆，让「从哪里喷的」仍然看得出来
    for (let i = 0; i < 20; i++) {
      this.effects.push({
        kind: 'lava',
        x: (col + (Math.random() - 0.5) * 6) * TILE,
        y: GROUND_Y - 40 - Math.random() * 70,
        vx: (Math.random() - 0.5) * 40,
        vy: 90 + Math.random() * 90,
        t: 1.4 + Math.random(),
      });
    }
    // 全场覆盖一层熔岩光，强调「平等」
    this.effects.push({ kind: 'ash', t: 2.2 });
    this.effects.push({ kind: 'crater', x: col * TILE + TILE / 2, y: GROUND_Y, t: 1.6, w: 6 * TILE });
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
