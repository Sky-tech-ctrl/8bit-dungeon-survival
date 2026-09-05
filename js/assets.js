// ==================== 贴图预加载器 ====================
// 从 assets/ 文件夹加载本地图片（PNG 已由 Python 脚本预先抠好白底）
class AssetLoader {
  constructor() {
    this.textures = {};   // key -> HTMLImageElement
  }

  // 预加载所有带 texture 字段的房间类型贴图
  preloadRoomTextures() {
    for (const [key, type] of Object.entries(ROOM_TYPES)) {
      if (!type.texture) continue;
      this.load(key, 'assets/' + type.texture);
    }
    // 玩家与丧尸精灵图（PNG，已预先抠好白底，自带透明通道）
    this.load('player_sprite', 'assets/player_sprite.png');
    this.load('zombie_sprite', 'assets/zombie_sprite.png');
    this.load('soldier_sprite', 'assets/soldier_sprite.png');
    // 山丘背景贴图
    this.load('hills_bg', 'assets/hills_bg.jpg');
  }

  // 资源版本号（每次改贴图时同步更新，强制浏览器绕过缓存）
  static VERSION = '28';

  load(key, src) {
    const img = new Image();
    img.loaded = false;
    img.onload = () => { img.loaded = true; };
    img.onerror = (e) => { img.loaded = false; console.warn('贴图加载失败:', key, src); };
    // 附加版本号查询参数，强制刷新图片缓存
    const sep = src.includes('?') ? '&' : '?';
    img.src = src + sep + 'v=' + AssetLoader.VERSION;
    this.textures[key] = img;
  }

  // 获取贴图（已加载返回 img，否则 null）
  get(key) {
    const img = this.textures[key];
    if (img && img.loaded) return img;
    return null;
  }

  // 批量预加载回调（全部完成或超时后调用 cb）
  preloadAll(cb, timeoutMs = 5000) {
    const keys = Object.keys(this.textures);
    if (keys.length === 0) { cb(); return; }
    let done = 0;
    const total = keys.length;
    const check = () => { if (++done >= total) cb(); };
    for (const k of keys) {
      const img = this.textures[k];
      if (img.loaded) { check(); }
      else {
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
      }
    }
    setTimeout(cb, timeoutMs);
  }
}
