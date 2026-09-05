// ==================== 8-bit 音频引擎 ====================
//
// 全部声音都是**实时合成**的，仓库里没有任何音频文件。
// 理由有三条：
//   1. 8-bit 游戏的声音本来就该是方波/三角波/噪声，合成才是「原生做法」，
//      比压一堆 mp3 更贴题
//   2. 和项目的零依赖原则一致 —— 不增加一个字节的二进制资源，
//      GitHub Pages 上加载没有任何额外开销
//   3. 参数化之后想改音色、改调、改速度都是改几个数字的事
//
// 两个必须处理好的浏览器现实：
//   · 自动播放限制：AudioContext 在用户产生交互之前是 suspended 的，
//     必须在第一次点击/按键时 resume，否则一声不响
//   · 定时精度：绝不能用 setTimeout 直接触发音符（会飘、会卡顿）。
//     这里用标准的「前瞻调度」：定时器只负责把未来 100ms 内的音符
//     按 AudioContext 的采样时钟排进去，实际发声时间由音频线程保证
// ============================================================================

const Sound = (() => {
  const LS_KEY = 'game_audio_prefs';

  let ctx = null;
  let master = null, bgmBus = null, sfxBus = null;
  let unlocked = false;
  let prefs = { bgm: true, sfx: true, volume: 0.7 };

  // ---------------------------------------------------------------- 偏好

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) prefs = Object.assign(prefs, JSON.parse(raw));
  } catch (_) {}

  function savePrefs() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch (_) {}
  }

  // ---------------------------------------------------------------- 初始化

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;                       // 环境不支持就整体静默，不报错
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = prefs.volume;
    master.connect(ctx.destination);

    bgmBus = ctx.createGain();
    bgmBus.gain.value = prefs.bgm ? 1 : 0;
    bgmBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = prefs.sfx ? 1 : 0;
    sfxBus.connect(master);
    return ctx;
  }

  /**
   * 浏览器要求必须有用户交互才能出声。
   * 在第一次 pointerdown / keydown / touchend 时调用一次即可。
   */
  function unlock() {
    if (unlocked) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
    if (pendingTrack) playBGM(pendingTrack);     // 解锁前请求过的曲子，现在补上
  }

  // ---------------------------------------------------------------- 音符

  // 十二平均律：A4 = 440Hz
  const SEMITONE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const freqCache = Object.create(null);

  function noteFreq(name) {
    if (name in freqCache) return freqCache[name];
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return (freqCache[name] = 0);
    let n = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    n += (parseInt(m[3], 10) - 4) * 12;
    return (freqCache[name] = 440 * Math.pow(2, n / 12));
  }

  /**
   * 一个带 ADSR 包络的振荡器音符。
   * 包络非常关键：直接开关振荡器会「啪」的一声（爆音），
   * 起音和释放各留几毫秒的斜坡就干净了。
   */
  function tone(opts) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = opts.at != null ? opts.at : c.currentTime;
    const dur = opts.dur || 0.15;
    const dest = opts.dest || sfxBus;

    const osc = c.createOscillator();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.sweepTo) {                                   // 滑音（打击感、失败音）
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.sweepTo), t0 + dur);
    }

    const g = c.createGain();
    const vol = opts.vol != null ? opts.vol : 0.2;
    const atk = opts.attack != null ? opts.attack : 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 白噪声：打击乐、爆炸、挥空的风声都靠它。 */
  function noise(opts) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = opts.at != null ? opts.at : c.currentTime;
    const dur = opts.dur || 0.1;
    const dest = opts.dest || sfxBus;

    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const filt = c.createBiquadFilter();
    filt.type = opts.filter || 'bandpass';
    filt.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t0 + dur);
    filt.Q.value = opts.q != null ? opts.q : 1;

    const g = c.createGain();
    const vol = opts.vol != null ? opts.vol : 0.2;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filt).connect(g).connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---------------------------------------------------------------- 音效

  const SFX = {
    // 挥剑：短促的噪声「唰」
    swing: () => noise({ dur: 0.09, freq: 2600, sweepTo: 700, vol: 0.16, q: 0.8 }),

    // 砍中丧尸：低频冲击 + 一点噪声，钝重感
    hit: () => {
      tone({ freq: 220, sweepTo: 70, dur: 0.11, type: 'square', vol: 0.22 });
      noise({ dur: 0.07, freq: 900, sweepTo: 200, vol: 0.16, q: 0.6 });
    },

    // 丧尸倒地：下滑的锯齿，像泄气
    zombieDie: () => {
      tone({ freq: 300, sweepTo: 60, dur: 0.26, type: 'sawtooth', vol: 0.16 });
      noise({ dur: 0.2, freq: 600, sweepTo: 120, vol: 0.1, q: 0.5 });
    },

    // 玩家受伤：刺耳的下滑
    hurt: () => {
      tone({ freq: 520, sweepTo: 130, dur: 0.22, type: 'square', vol: 0.24 });
    },

    // 建造完成：上行三音，明确的「成了」
    build: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      [440, 587, 880].forEach((f, i) =>
        tone({ freq: f, dur: 0.1, type: 'square', vol: 0.17, at: t + i * 0.055 }));
    },

    // 拾取资源：清脆的两音
    pickup: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      tone({ freq: 988, dur: 0.06, type: 'square', vol: 0.13, at: t });
      tone({ freq: 1319, dur: 0.09, type: 'square', vol: 0.13, at: t + 0.05 });
    },

    // 升级：四音上行琶音，最有仪式感的一个
    upgrade: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, dur: 0.13, type: 'square', vol: 0.18, at: t + i * 0.075 }));
    },

    // 大门被啃：沉闷的木头撞击
    doorHit: () => {
      tone({ freq: 150, sweepTo: 55, dur: 0.15, type: 'triangle', vol: 0.26 });
      noise({ dur: 0.1, freq: 400, sweepTo: 120, vol: 0.14, filter: 'lowpass', q: 0.4 });
    },

    // 新一波来袭：警报式的两声
    waveStart: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      [0, 0.22].forEach(off => {
        tone({ freq: 330, dur: 0.18, type: 'square', vol: 0.2, at: t + off });
        tone({ freq: 494, dur: 0.18, type: 'square', vol: 0.14, at: t + off + 0.09 });
      });
    },

    // 一波清除：胜利小调
    waveClear: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      [659, 784, 988, 1319].forEach((f, i) =>
        tone({ freq: f, dur: 0.14, type: 'square', vol: 0.17, at: t + i * 0.08 }));
    },

    // 资源不足 / 位置不对：短促的否定音
    error: () => {
      tone({ freq: 200, sweepTo: 110, dur: 0.16, type: 'square', vol: 0.18 });
    },

    // UI 点击
    click: () => tone({ freq: 660, dur: 0.045, type: 'square', vol: 0.1 }),

    // 存档成功
    save: () => {
      const c = ensureCtx(); if (!c) return;
      const t = c.currentTime;
      tone({ freq: 784, dur: 0.09, type: 'square', vol: 0.15, at: t });
      tone({ freq: 1047, dur: 0.14, type: 'square', vol: 0.15, at: t + 0.08 });
    },
  };

  function sfx(name) {
    if (!prefs.sfx || !unlocked) return;
    const f = SFX[name];
    if (f) { try { f(); } catch (_) {} }
  }

  // ---------------------------------------------------------------- BGM
  //
  // 记谱：每个声部是一串以空格分隔的 token，一格 = 一个八分音符。
  //   'A3'  发这个音     '-' 延续上一个音（不重新触发）    '.' 休止
  //   'x'   噪声打击（只在 drum 声部里有意义）
  // ----------------------------------------------------------------

  const TRACKS = {
    // 标题界面：A 小调，慢，空旷。低音走 Am–F–G–Em，上面挂一层稀疏的琶音
    title: {
      bpm: 84,
      parts: [
        { type: 'triangle', vol: 0.20, oct: 0, seq:
          'A2 .  .  .  A2 .  .  .  F2 .  .  .  F2 .  .  . ' +
          'G2 .  .  .  G2 .  .  .  E2 .  .  .  E2 .  .  . ' },
        { type: 'square', vol: 0.075, seq:
          'A4 .  E4 .  C5 .  E4 .  F4 .  C4 .  A4 .  C4 . ' +
          'G4 .  D4 .  B4 .  D4 .  E4 .  B3 .  G4 .  B3 . ' },
        { type: 'square', vol: 0.045, seq:
          '.  .  .  .  A5 .  .  .  .  .  .  .  F5 .  .  . ' +
          '.  .  .  .  G5 .  .  .  .  .  .  .  B4 .  .  . ' },
      ],
    },

    // 战斗：同样是 A 小调，但速度快一倍，低音改成推进的八分音符，加鼓
    battle: {
      bpm: 132,
      parts: [
        { type: 'triangle', vol: 0.19, seq:
          'A2 A2 A2 A3 A2 A2 A2 A3 F2 F2 F2 F3 F2 F2 F2 F3 ' +
          'G2 G2 G2 G3 G2 G2 G2 G3 E2 E2 E2 E3 E2 E2 E2 E3 ' },
        { type: 'square', vol: 0.085, seq:
          'A4 .  C5 .  E5 C5 A4 .  .  A4 C5 .  E5 .  D5 C5 ' +
          'F4 .  A4 .  C5 A4 F4 .  G4 .  B4 .  D5 B4 G4 .  ' },
        { type: 'square', vol: 0.05, seq:
          'E5 .  .  .  .  .  .  .  A5 .  .  .  .  .  G5 .  ' +
          'C5 .  .  .  .  .  .  .  B4 .  .  .  .  .  D5 .  ' },
        { drum: true, vol: 0.13, seq:
          'k  .  h  .  k  h  .  h  k  .  h  .  s  .  h  h  ' +
          'k  .  h  .  k  h  .  h  k  .  h  .  s  .  h  h  ' },
      ],
    },

    // 失败：四个下行的长音，不循环
    gameover: {
      bpm: 76,
      loop: false,
      parts: [
        { type: 'triangle', vol: 0.24, seq: 'A3 -  -  -  G3 -  -  -  F3 -  -  -  E3 -  -  -  ' },
        { type: 'square', vol: 0.10, seq: 'E4 -  -  -  D4 -  -  -  C4 -  -  -  B3 -  -  -  ' },
      ],
    },
  };

  let currentName = null;
  let schedTimer = null;
  let stepIndex = 0;
  let nextTime = 0;
  let pendingTrack = null;         // 解锁之前请求的曲子

  const LOOKAHEAD = 0.12;          // 提前 120ms 排程
  const TICK = 25;                 // 每 25ms 检查一次

  function drumHit(kind, at) {
    if (kind === 'k') {            // 底鼓
      tone({ freq: 150, sweepTo: 45, dur: 0.12, type: 'sine', vol: 0.5, at, dest: bgmBus });
    } else if (kind === 's') {     // 军鼓
      noise({ dur: 0.13, freq: 1800, vol: 0.32, q: 0.7, at, dest: bgmBus });
    } else if (kind === 'h') {     // 踩镲
      noise({ dur: 0.045, freq: 7000, filter: 'highpass', vol: 0.12, at, dest: bgmBus });
    }
  }

  function scheduler() {
    const c = ctx;
    const track = TRACKS[currentName];
    if (!c || !track) return;
    const stepDur = 60 / track.bpm / 2;          // 一格 = 八分音符

    // 标签页切到后台时，浏览器会把 setInterval 节流到 1 秒甚至更久，
    // nextTime 会被现实时间远远甩在后面。若不管，切回前台的一瞬间
    // while 循环会把积压的几十个音符全部按「过去的时间」排进去 ——
    // 听感上就是「哗」的一声全炸出来。落后太多就直接对齐到当前时刻，
    // 宁可丢掉这段，也不要那声爆音。
    if (nextTime < c.currentTime - 0.35) nextTime = c.currentTime + 0.02;

    while (nextTime < c.currentTime + LOOKAHEAD) {
      const len = track.parts[0].seq.trim().split(/\s+/).length;
      if (stepIndex >= len) {
        if (track.loop === false) { stopBGM(); return; }
        stepIndex = 0;
      }
      for (const part of track.parts) {
        const tok = part.seq.trim().split(/\s+/)[stepIndex];
        if (!tok || tok === '.' || tok === '-') continue;
        if (part.drum) {
          drumHit(tok, nextTime);
        } else {
          const f = noteFreq(tok);
          if (f) {
            tone({
              freq: f, dur: stepDur * 0.92, type: part.type || 'square',
              vol: part.vol != null ? part.vol : 0.1, at: nextTime, dest: bgmBus,
            });
          }
        }
      }
      nextTime += stepDur;
      stepIndex++;
    }
  }

  function playBGM(name) {
    if (!TRACKS[name]) return;
    if (!unlocked) { pendingTrack = name; return; }   // 还没解锁，记下来等会儿补
    pendingTrack = null;
    if (currentName === name && schedTimer) return;   // 同一首就不重开，避免打断
    stopBGM();
    const c = ensureCtx();
    if (!c) return;
    currentName = name;
    stepIndex = 0;
    nextTime = c.currentTime + 0.06;
    schedTimer = setInterval(scheduler, TICK);
    scheduler();
  }

  function stopBGM() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    currentName = null;
  }

  /** 暂停时把音乐压低而不是掐断 —— 掐断再起会有明显的断层感。 */
  function duck(on) {
    if (!bgmBus || !ctx) return;
    const target = on ? (prefs.bgm ? 0.25 : 0) : (prefs.bgm ? 1 : 0);
    bgmBus.gain.cancelScheduledValues(ctx.currentTime);
    bgmBus.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.2);
  }

  // ---------------------------------------------------------------- 开关

  function setBGM(on) {
    prefs.bgm = !!on; savePrefs();
    if (bgmBus && ctx) bgmBus.gain.linearRampToValueAtTime(prefs.bgm ? 1 : 0, ctx.currentTime + 0.1);
  }
  function setSFX(on) {
    prefs.sfx = !!on; savePrefs();
    if (sfxBus && ctx) sfxBus.gain.value = prefs.sfx ? 1 : 0;
  }
  function setVolume(v) {
    prefs.volume = Math.max(0, Math.min(1, v)); savePrefs();
    if (master && ctx) master.gain.linearRampToValueAtTime(prefs.volume, ctx.currentTime + 0.1);
  }

  // 标签页切走时把音乐停掉，回来再续上。
  // 一来后台放音乐本来就没意义（游戏自身的 rAF 也停了），
  // 二来彻底绕开了后台定时器节流带来的走音问题。
  let resumeAfterHidden = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (currentName) { resumeAfterHidden = currentName; stopBGM(); }
    } else if (resumeAfterHidden) {
      const t = resumeAfterHidden;
      resumeAfterHidden = null;
      playBGM(t);
    }
  });

  return {
    unlock, sfx, playBGM, stopBGM, duck,
    setBGM, setSFX, setVolume,
    get bgmOn() { return prefs.bgm; },
    get sfxOn() { return prefs.sfx; },
    get volume() { return prefs.volume; },
    get ready() { return unlocked; },
  };
})();

window.Sound = Sound;
