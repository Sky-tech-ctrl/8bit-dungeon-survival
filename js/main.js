// ==================== 游戏入口 ====================

// ---- 画布自适应 ----
// #gameContainer 是写死的 968×728。视口比它窄时，body 的 flex 居中
// 会把它「两头等量溢出」，左半边直接滚不到 —— 标题界面的 LOGO 就是这么被啃掉的。
// 这里按比例缩放它。
//
// 两个前提让这个做法是安全的：
//   · PC 端的 screenToGameCoords 走 getBoundingClientRect 再按 W/rect.width 换算，
//     缩放会被自动吃掉，点击坐标不会偏
//   · 手机端有另一套基于 innerWidth/innerHeight 的旋转逆变换，
//     那套算法不认 transform，所以 mobile-mode 下必须原样放过
function fitGameContainer() {
  const gc = document.getElementById('gameContainer');
  if (!gc) return;
  if (document.body.classList.contains('mobile-mode')) {   // 手机端自有布局，别插手
    gc.style.transform = '';
    gc.style.margin = '';
    return;
  }
  const w = gc.offsetWidth, h = gc.offsetHeight;
  if (!w || !h) return;
  const s = Math.min(1, (window.innerWidth - 12) / w, (window.innerHeight - 12) / h);
  if (s >= 1) {
    gc.style.transform = '';
    gc.style.margin = '';
    return;
  }
  gc.style.transformOrigin = 'top center';
  gc.style.transform = 'scale(' + s + ')';
  // transform 不改变布局盒，缩完仍按原尺寸占位。
  // 用负 margin 把多出来的那圈收掉，否则依然会撑出滚动条。
  gc.style.margin = '0 ' + (-(w * (1 - s)) / 2) + 'px ' + (-(h * (1 - s))) + 'px';
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

document.addEventListener('DOMContentLoaded', () => {
  // 顺序要紧：Game 的构造函数会跑 setupAuth()，把 _showAuth / _showSave
  // 暴露出来，标题界面要用它们，所以必须先建 Game 再 init 标题界面。
  game = new Game();
  if (window.TitleScreen) TitleScreen.init(game);

  guardDoubleTapZoom();

  fitGameContainer();
  window.addEventListener('resize', fitGameContainer);
  // 切到手机端时 body 会加上 mobile-mode，届时要把缩放撤掉
  new MutationObserver(fitGameContainer)
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
