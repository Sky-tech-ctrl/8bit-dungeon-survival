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

document.addEventListener('DOMContentLoaded', () => {
  // 顺序要紧：Game 的构造函数会跑 setupAuth()，把 _showAuth / _showSave
  // 暴露出来，标题界面要用它们，所以必须先建 Game 再 init 标题界面。
  game = new Game();
  if (window.TitleScreen) TitleScreen.init(game);

  fitGameContainer();
  window.addEventListener('resize', fitGameContainer);
  // 切到手机端时 body 会加上 mobile-mode，届时要把缩放撤掉
  new MutationObserver(fitGameContainer)
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
