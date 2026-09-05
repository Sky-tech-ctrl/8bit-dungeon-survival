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
    desc: '砸出一个碗形深坑，中心可挖穿数格',
  },
  quake: {
    name: '地震', icon: '〰',
    color: '#c9a227',
    warn: '地壳开始震动',
    desc: '满地浅坑，地下室大范围震损',
  },
  volcano: {
    name: '火山喷发', icon: '🌋',
    color: '#ff4422',
    warn: '地底传来轰鸣',
    desc: '均匀侵蚀整个地表，全场同时下沉',
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
      if (e.kind === 'falling') {
        // 从起点插值到落点，并叠一点下坠加速度 ——
        // 匀速直线会显得像在滑翔，而不是被引力拽下来
        const p = Math.min(1, 1 - Math.max(0, e.t) / e.dur);
        const ease = p * p * 0.35 + p * 0.65;
        e.x = e.sx + (e.tx - e.sx) * ease;
        e.y = e.sy + (e.ty - e.sy) * ease;
        if (e.t <= 0) { this._meteorImpact(e.col); this.effects.splice(i, 1); continue; }
      } else if (e.vy != null) {
        e.x += (e.vx || 0) * dt; e.y += e.vy * dt;
      }
      if (e.t <= 0) this.effects.splice(i, 1);
    }
  }

  // ------------------------------------------------------------- 降临

  strike(kind, col) {
    const g = this.game;
    const t = DISASTER_TYPES[kind];
    g.log(`${t.icon} ${t.name}降临！`, t.color);
    if (kind !== 'meteor') {          // 陨石的音效与震动留到真正落地那一刻
      Sound.sfx('doorHit');
      g.shakeScreen();
      this.shakeUntil = performance.now() / 1000 + 1.6;
    }

    if (kind === 'meteor') this._meteor(col);
    else if (kind === 'quake') this._quake(col);
    else this._volcano(col);

    g.updateUI();
  }

  _meteor(col) {
    // 陨石不是「一按就出坑」—— 先让它从左上方带着火尾飞进来，
    // 落地那一刻才真正砸出坑。没有这段坠落，天灾就只是数值突变，
    // 玩家连躲的念头都来不及产生。
    const tx = col * TILE + TILE / 2;
    this.effects.push({
      kind: 'falling', col,
      sx: tx - 300, sy: GROUND_Y - 300,    // 从左上 45° 斜切进来
      tx, ty: GROUND_Y - 4,
      x: tx - 300, y: GROUND_Y - 300,
      t: 0.85, dur: 0.85,
    });
  }

  /** 陨石真正落地：挖出一个碗形坑。 */
  _meteorImpact(col) {
    const g = this.game;
    // 碗形：中心最深，向外按二次曲线变浅 —— 现实里的撞击坑就是这个剖面，
    // 用线性递减会挖出一个 V 形尖底，看着像被斧头劈的。
    const radius = 3 + Math.floor(Math.random() * 3);          // 3~5 列
    const maxDepth = TILE * (1.4 + Math.random() * 1.0);       // 1.4~2.4 格深
    for (let d = -radius; d <= radius; d++) {
      const c = col + d;
      if (c < 0 || c >= BASEMENT_COLS) continue;
      const n = d / (radius + 0.5);
      const depth = maxDepth * (1 - n * n);                    // 抛物线碗底
      if (depth > 0) g.carveGround(c, depth);
    }

    Sound.sfx('doorHit');
    g.shakeScreen();
    this.shakeUntil = performance.now() / 1000 + 1.2;
    this.effects.push({ kind: 'crater', x: col * TILE + TILE / 2, y: GROUND_Y,
                        t: 1.4, w: (radius * 2 + 1) * TILE });
    for (let i = 0; i < 34; i++) {
      g.spawnParticles((col + (Math.random() - 0.5) * radius * 2) * TILE,
                       GROUND_Y - Math.random() * 26, '#ff8844', 1);
    }
  }

  _quake(col) {
    const g = this.game;
    // **满地小坑**：撒出很多个浅碗，每个只有 1~2 列宽。
    // 和陨石同样是真实的地形凹陷，区别只在「多而浅」对「一个而深」。
    const pits = 8 + Math.floor(Math.random() * 7);            // 8~14 个
    for (let i = 0; i < pits; i++) {
      const c = Math.floor(Math.random() * BASEMENT_COLS);
      const depth = TILE * (0.35 + Math.random() * 0.45);      // 0.35~0.8 格
      g.carveGround(c, depth);
      // 小坑也有坑沿，只是只波及紧邻的一列
      if (Math.random() < 0.6) g.carveGround(c - 1, depth * 0.45);
      if (Math.random() < 0.6) g.carveGround(c + 1, depth * 0.45);
      g.spawnParticles(c * TILE + TILE / 2, GROUND_Y, '#c9a227', 4);
    }
    // 地下的破坏才是地震的主场：沿一条水平带广域震坏房间
    const row = 1 + Math.floor(Math.random() * Math.max(1, BASEMENT_ROWS - 3));
    for (const r of g.rooms.slice()) {
      if (r.row <= row + 1 && r.row + r.size.h >= row) g.damageRoom(r, 45);
    }
    this.effects.push({ kind: 'quake', t: 2.0 });
  }

  _volcano(col) {
    const g = this.game;
    // **均匀侵蚀整个地表**：所有列同时被削掉相同的一层，一视同仁。
    // 这是三种天灾里唯一「全场生效」的 —— 它不挑地方，就是把整层地皮
    // 磨掉一圈。单次挖得浅，但每喷发一次全场就整体下沉一截，
    // 而且已经被砸出坑的地方会先见底。
    const erosion = TILE * (0.22 + Math.random() * 0.16);      // 每次约 0.2~0.4 格
    let breached = 0;
    for (let c = 0; c < BASEMENT_COLS; c++) {
      if (g.carveGround(c, erosion)) breached++;
    }
    g.log(`🌋 熔岩漫过整片地表，全场下沉 ${Math.round(erosion)}px` +
          (breached ? `，${breached} 处塌穿` : ''), '#ff6644');

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
    this.effects.push({ kind: 'ash', t: 2.2 });
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
