// ==================== 游戏入口 ====================

// ---- 画布自适应 ----
// 注意：缩放这件事**只能有一套机制**。
// 游戏本身已经有 applyPCLayout()（见 input.js）—— 它按视口算出比例，
// 直接设置 canvas 和容器的 CSS 尺寸。之前这里另起炉灶，在容器上又叠了
// 一层 transform: scale() 加负 margin，两套叠在一起，PC 端比例就歪了。
// 现在统一复用 applyPCLayout，这里只负责「在游戏开始之前也调用它一次」，
// 好让标题界面同样能铺满窗口。
function fitStage() {
  if (!window.game || !game.applyPCLayout) return;
  // 手机端是另一套（旋转 + 100dvw/100dvh），由 applyMobileLayout 全权负责
  if (document.body.classList.contains('mobile-mode')) return;
  game.applyPCLayout();      // 内部会顺带同步标题界面的缩放比
}

// ---- 双击缩放兜底 ----
// 正规做法是 CSS 的 touch-action: manipulation（见 style.css），
// 现代浏览器到此为止就够了。但 iOS Safari 有两个已知脾气：
//   · 12 以前的版本对 touch-action 支持不全
//   · 即便支持，靠近屏幕边缘的双击有时仍会被系统解释成缩放
// 所以再加一道纯 JS 的兜底：两次触摸结束间隔 < 300ms 且落点相距很近时，
// 把第二次的默认行为吃掉 —— 浏览器就没机会把它凑成一次「双击」。
//
// 只吃第二次，第一次永远原样放行，所以正常的点击不受影响；
// 输入框和文本域整个跳过，免得干扰选词、光标定位这些原生手势。
function guardDoubleTapZoom() {
  let lastTime = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const now = e.timeStamp || Date.now();
    const near = Math.abs(touch.clientX - lastX) < 40 && Math.abs(touch.clientY - lastY) < 40;

    if (now - lastTime < 300 && near) {
      if (e.cancelable) e.preventDefault();
      lastTime = 0;              // 归零：三连击时第三下要当成新的第一下，别被连锁吞掉
      return;
    }
    lastTime = now;
    lastX = touch.clientX;
    lastY = touch.clientY;
  }, { passive: false });
}


// ---- 音频解锁 ----
// 浏览器的自动播放策略：AudioContext 在用户产生交互之前一直是 suspended，
// 不 resume 就一声不响。所以在第一次点击/触摸/按键时解锁一次。
// 解锁前请求过的 BGM 会被 audio.js 记下来，解锁瞬间补上，
// 玩家不会察觉到这层延迟。
function unlockAudioOnFirstGesture() {
  const go = () => {
    Sound.unlock();
    ['pointerdown', 'keydown', 'touchend'].forEach(ev =>
      window.removeEventListener(ev, go, true));
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev =>
    window.addEventListener(ev, go, true));
}

document.addEventListener('DOMContentLoaded', () => {
  // 顺序要紧：Game 的构造函数会跑 setupAuth()，把 _showAuth / _showSave
  // 暴露出来，标题界面要用它们，所以必须先建 Game 再 init 标题界面。
  game = new Game();
  if (window.TitleScreen) TitleScreen.init(game);

  guardDoubleTapZoom();
  unlockAudioOnFirstGesture();

  // 标题界面阶段也要铺满窗口。游戏开始后 applyDeviceMode() 会自己再注册
  // 一次 resize → applyPCLayout，重复调用是幂等的，不会互相干扰。
  fitStage();
  window.addEventListener('resize', fitStage);
});
