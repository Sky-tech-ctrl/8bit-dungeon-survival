// ==================== 渲染系统 ====================
// 所有 draw 方法挂载到 Game.prototype 上

// ---- 主渲染入口 ----
Game.prototype.render = function() {
  const ctx = this.ctx;
  ctx.save();
  if (this.shakeT > 0.01) {
    const s = this.shakeT * 8;
    ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
  }
  this.drawSky(ctx);
  this.drawGround(ctx);
  this.drawDoor(ctx);

  // 野生资源堆（在丧尸前）
  for (const pile of this.resourcePiles) this.drawResourcePile(ctx, pile);

  // 士兵、丧尸、子弹
  for (const s of this.soldiers) this.drawSoldier(ctx, s);
  for (const z of this.zombies) this.drawZombie(ctx, z);
  for (const p of this.projectiles) this.drawProjectile(ctx, p);

  // 地下室
  this.drawBasement(ctx);
  this.drawBuildPreview(ctx);

  // 玩家（最上层，除了粒子）
  if (this.player.hp > 0) this.drawPlayer(ctx, this.player);

  // 粒子
  for (const p of this.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.restore();
};

// ---- 天空 ----
Game.prototype.drawSky = function(ctx) {
  // 山丘背景贴图（优先）
  const hillsTex = this.assets.get('hills_bg');
  if (hillsTex) {
    ctx.imageSmoothingEnabled = false;
    // 把山丘图拉伸到整个天空区域
    try { ctx.drawImage(hillsTex, 0, 0, W, GROUND_Y); } catch(e) {}
  } else {
    const grad = ctx.createLinearGradient(0,0,0,GROUND_Y);
    grad.addColorStop(0, '#5a8fc9');
    grad.addColorStop(0.6, COL.sky1);
    grad.addColorStop(1, '#b5daf0');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,GROUND_Y);
  }

  // 云
  for (const c of this.clouds) this.drawCloud(ctx, c.x, c.y, c.w);

  // 太阳
  this.drawPixelCircle(ctx, W-100, 40, 24, '#ffee88');
  this.drawPixelCircle(ctx, W-100, 40, 18, '#ffdd44');
};

Game.prototype.drawCloud = function(ctx, x, y, w) {
  const h = w*0.4;
  this.drawPixelRect(ctx, x, y+8, w, h-8, '#fff');
  this.drawPixelRect(ctx, x+w*0.2, y, w*0.4, h*0.7, '#fff');
  this.drawPixelRect(ctx, x+w*0.5, y+4, w*0.35, h*0.8, '#fff');
};

// ---- 地面 ----
Game.prototype.drawGround = function(ctx) {
  // 草皮层
  ctx.fillStyle = COL.grass;
  ctx.fillRect(0, GROUND_Y-8, W, 8);
  ctx.fillStyle = COL.grassDark;
  for (let x=0;x<W;x+=8) {
    if ((x/8)%2===0) ctx.fillRect(x, GROUND_Y-6, 4, 2);
    if ((x/4)%5===0) ctx.fillRect(x+2, GROUND_Y-10, 2, 4);
  }

  // 泥土层
  ctx.fillStyle = COL.dirt;
  ctx.fillRect(0, GROUND_Y, W, 8);
  ctx.fillStyle = COL.dirtDark;
  for (let x=0;x<W;x+=12) ctx.fillRect(x+2, GROUND_Y+2, 3, 3);

  // ===== 草根 / 根茎效果：草皮底边向下扎入泥土 =====
  // 1. 不规则的草-土交界线（锯齿状深色凹陷）
  ctx.fillStyle = COL.dirtDark;
  for (let x=0;x<W;x+=6) {
    const dip = (Math.sin(x*0.7)+Math.sin(x*0.31+1.3))*1.5;
    ctx.fillRect(x, GROUND_Y-1+Math.round(dip), 6, 2);
  }
  // 2. 垂直根须：从草皮底部向下延伸到泥土中的细线
  const rootCol = '#4a3a1a';
  ctx.fillStyle = rootCol;
  for (let x=0;x<W;x+=7) {
    // 用伪随机决定根须长度与是否生成
    const seed = (x*9301+49297)%233280;
    const r = seed/233280;
    if (r < 0.45) continue;          // 约 55% 的位置长根
    const len = 2 + Math.floor(r*7);  // 根须长度 2~8px
    const w = r < 0.75 ? 1 : 2;       // 偶尔粗一点的根
    const xj = x + Math.floor(r*3);   // 轻微水平抖动
    ctx.fillRect(xj, GROUND_Y, w, len);
    // 根须末端分叉小须
    if (len >= 5 && r > 0.6) {
      ctx.fillRect(xj-1, GROUND_Y+len-2, 1, 2);
      ctx.fillRect(xj+w, GROUND_Y+len-3, 1, 2);
    }
  }
  // 3. 草皮底边悬垂的小草须（从草层底部向下冒出一点绿色）
  ctx.fillStyle = COL.grassDark;
  for (let x=0;x<W;x+=9) {
    const seed = (x*7919+104729)%233280;
    const r = seed/233280;
    if (r < 0.5) continue;
    const len = 1 + Math.floor(r*3);
    ctx.fillRect(x + Math.floor(r*3), GROUND_Y-len, 1, len+1);
  }
};

// ---- 地窖活板门（横向，嵌入地面） ----
Game.prototype.drawDoor = function(ctx) {
  const hpRatio = this.doorHp / this.doorMaxHp;
  const x = DOOR_X - DOOR_WIDTH/2;
  // 活板门顶部就在草地下方一点点，整体埋入泥土层
  const y = GROUND_Y - DOOR_HEIGHT * 0.35;  // 顶部略高于草皮
  const w = DOOR_WIDTH;
  const h = DOOR_HEIGHT;

  // 石框（地窖入口外围）
  this.drawPixelRect(ctx, x-10, y-6, w+20, h+14, COL.stoneDark);
  this.drawPixelRect(ctx, x-7, y-4, w+14, h+10, COL.stone);
  this.drawPixelRect(ctx, x-5, y-2, w+10, h+6, COL.stoneLight);
  // 石框铆钉
  ctx.fillStyle = '#333';
  ctx.fillRect(x-8, y-5, 2, 2); ctx.fillRect(x+w+6, y-5, 2, 2);
  ctx.fillRect(x-8, y+h+3, 2, 2); ctx.fillRect(x+w+6, y+h+3, 2, 2);

  // 活板门主体（木板横向铺设，模拟可向上掀开的门）
  const woodCol = hpRatio > 0.6 ? COL.wood : hpRatio > 0.3 ? '#a04820' : '#801818';
  const woodDark = hpRatio > 0.6 ? COL.woodDark : hpRatio > 0.3 ? '#70301a' : '#500';
  this.drawPixelRect(ctx, x, y, w, h, woodCol);
  // 木板纹路（6 条横向木板）
  ctx.fillStyle = woodDark;
  const plankCount = 6;
  for (let i = 1; i < plankCount; i++) {
    const py = y + Math.floor(h * i / plankCount);
    ctx.fillRect(x, py, w, 2);
  }
  // 木板纵向暗纹
  for (let i = 0; i < 5; i++) {
    const px = x + Math.floor(w * (i+1) / 6);
    ctx.fillStyle = woodDark;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(px, y+1, 1, h-2);
    ctx.globalAlpha = 1;
  }

  // 左右两个金属合页（连接石框与木板，代表向上掀开）
  ctx.fillStyle = COL.doorMetal;
  ctx.fillRect(x+4, y+2, 10, 5);
  ctx.fillRect(x+w-14, y+2, 10, 5);
  ctx.fillStyle = '#777';
  ctx.fillRect(x+4, y+7, 10, 2);
  ctx.fillRect(x+w-14, y+7, 10, 2);
  // 铆钉
  ctx.fillStyle = '#333';
  ctx.fillRect(x+5, y+3, 1, 1); ctx.fillRect(x+12, y+3, 1, 1);
  ctx.fillRect(x+w-13, y+3, 1, 1); ctx.fillRect(x+w-6, y+3, 1, 1);

  // 中央大锁扣（金色圆环）
  ctx.fillStyle = '#555';
  ctx.fillRect(x + w/2 - 10, y + h/2 - 4, 20, 8);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x + w/2 - 8, y + h/2 - 3, 16, 6);
  ctx.fillStyle = COL.goldDark;
  ctx.fillRect(x + w/2 - 6, y + h/2 - 1, 12, 2);

  // 破损程度（裂痕）
  if (hpRatio < 0.75) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 10, y + 3, 2, 8);
    ctx.fillRect(x + 12, y + 5, 6, 2);
  }
  if (hpRatio < 0.5) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w - 20, y + h - 10, 2, 7);
    ctx.fillRect(x + w - 30, y + h - 7, 10, 2);
    ctx.fillStyle = '#100';
    ctx.fillRect(x + w/3, y + 2, 2, h - 4);
  }
  if (hpRatio < 0.25) {
    ctx.fillStyle = '#300';
    ctx.fillRect(x + 5, y + 2, w - 10, h - 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 5, 3, 3);
    ctx.fillRect(x + w - 15, y + h - 12, 4, 4);
  }

  // 门下方"黑洞"入口效果：泥土层下露出一段黑暗阶梯
  if (hpRatio > 0.1) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x + 8, y + h + 2, w - 16, 5);
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 10 + i * 4, y + h + 3, 2, 3);
    }
  }

  // 活板门上方呼吸提示 (玩家靠近时闪烁)
  if (Math.abs(this.player.x - DOOR_X) < w/2 + 20) {
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(Date.now()/200);
    ctx.fillStyle = this.player.inBasement ? '#5ef' : '#ffd';
    const arrow = this.player.inBasement ? '▲' : '▼';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(arrow, DOOR_X, y - 8);
    ctx.font = '9px monospace';
    ctx.fillText(this.player.inBasement ? 'W/↑ 出去' : 'S/↓ 进入', DOOR_X, y + h + 18);
    ctx.restore();
  }

  // HP 条（放在活板门上方）
  ctx.fillStyle = '#300';
  ctx.fillRect(x, y - 18, w, 6);
  const fillCol = hpRatio > 0.5 ? '#5e5' : hpRatio > 0.25 ? '#fc4' : '#f44';
  ctx.fillStyle = fillCol;
  ctx.fillRect(x + 1, y - 17, Math.floor((w - 2) * hpRatio), 4);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`地窖门 ${Math.ceil(this.doorHp)}/${this.doorMaxHp}`, DOOR_X, y - 20);
};

// ---- 地下室 ----
Game.prototype.drawBasement = function(ctx) {
  const bx = 0, by = GROUND_Y, bw = W, bh = H - GROUND_Y;
  // ========== 1. 整块区域填满深色泥土 ==========
  ctx.fillStyle = COL.dirtDark;
  ctx.fillRect(bx, by, bw, bh);
  // 泥土碎石纹理（深色基底）
  ctx.fillStyle = '#2a1508';
  for (let i=0;i<250;i++) ctx.fillRect(bx+(i*137)%bw, by+(i*89)%bh, 3, 3);
  ctx.fillStyle = '#1a0d05';
  for (let i=0;i<120;i++) ctx.fillRect(bx+(i*241)%bw, by+(i*173)%bh, 2, 2);

  // 地下室边界岩石墙（顶部石头梁 + 左右墙）
  ctx.fillStyle = COL.stoneDark;
  ctx.fillRect(bx, by, bw, 4);
  ctx.fillRect(bx, by, 4, bh);
  ctx.fillRect(bx+bw-4, by, 4, bh);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(bx+4, by+4, bw-8, 2);

  // ========== 2. 画出"被挖空"的可行区域（通道+房间内部+中央楼梯） ==========
  // 2a. 中央垂直楼梯（活板门正下方）
  const SW = 56;  // 楼梯宽度 (DOOR_X ± 28)
  const CX = DOOR_X;
  // 地板
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(CX - SW/2, by + 4, SW, bh - 8);
  // 地板砖纹理
  ctx.fillStyle = '#3a2a1a';
  for (let y = 10; y < bh; y += 8)
    ctx.fillRect(CX - SW/2, by + y, SW, 1);
  // 两侧石阶扶手（左右）
  ctx.fillStyle = COL.stoneDark;
  ctx.fillRect(CX - SW/2 - 3, by + 4, 3, bh - 8);
  ctx.fillRect(CX + SW/2, by + 4, 3, bh - 8);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(CX - SW/2 - 3, by + 4, 1, bh - 8);
  // 楼梯阶梯向下延伸（视觉）
  ctx.fillStyle = '#2a1810';
  for (let k = 0; k < 10; k++) {
    const sy = by + 6 + k*2;
    ctx.fillRect(CX - SW/2 + 3, sy, SW - 6, 1);
  }
  // 活板门正下方光柱
  ctx.save();
  ctx.globalAlpha = 0.15;
  const grad = ctx.createLinearGradient(0, by, 0, by + 200);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(CX - 25, by + 4, 50, 180);
  ctx.restore();

  // 2b. 每个房间的通道（从门口 → 中央楼梯）与房间本身的内部空心
  for (const r of this.rooms) {
    const info = this.roomDoorInfo ? this.roomDoorInfo(r)
      : (() => { const i = {box: {x0:r.col*TILE, y0:GROUND_Y+r.row*TILE,
        x1:(r.col+r.size.w)*TILE, y1:GROUND_Y+(r.row+r.size.h)*TILE}}; return i; })();
    // 通道挖空
    if (info.tunnelRect && info.tunnelRect.w > 1) {
      const tr = info.tunnelRect;
      // 通道地板
      ctx.fillStyle = '#4a3525';
      ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
      // 通道地板横线
      ctx.fillStyle = '#3a2515';
      for (let x = 0; x < tr.w; x += 6) ctx.fillRect(tr.x + x, tr.y + tr.h/2, 3, 1);
      // 通道顶部与底部泥土阴影
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(tr.x, tr.y - 2, tr.w, 2);
      ctx.fillRect(tr.x, tr.y + tr.h, tr.w, 2);
    }
  }

  // ========== 3. 网格提示（微弱可见，方便点击建造） ==========
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let c=0;c<=BASEMENT_COLS;c++) {
    ctx.beginPath(); ctx.moveTo(bx+c*TILE, by); ctx.lineTo(bx+c*TILE, by+BASEMENT_ROWS*TILE); ctx.stroke();
  }
  for (let r=0;r<=BASEMENT_ROWS;r++) {
    ctx.beginPath(); ctx.moveTo(bx, by+r*TILE); ctx.lineTo(bx+BASEMENT_COLS*TILE, by+r*TILE); ctx.stroke();
  }

  // ========== 4. 点击高亮格子 ==========
  if (this.buildPopup) {
    const {col, row} = this.buildPopup;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,0,0.12)';
    ctx.fillRect(bx+col*TILE, by+row*TILE, TILE, TILE);
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.setLineDash([4,3]);
    ctx.strokeRect(bx+col*TILE+1, by+row*TILE+1, TILE-2, TILE-2);
    ctx.restore();
  }

  // ========== 5. 所有房间（带墙体 + 门口缺口） ==========
  for (const r of this.rooms) this.drawRoom(ctx, r);
};

// ---- 房间（墙体 + 门口缺口 + 地板 + 内饰） ----
Game.prototype.drawRoom = function(ctx, room) {
  const td = room.typeData;
  const size = td.size;
  const rx = room.col * TILE;
  const ry = GROUND_Y + room.row * TILE;
  const rw = size.w * TILE;
  const rh = size.h * TILE;

  // 获取门口信息
  let info = null;
  if (this.roomDoorInfo) info = this.roomDoorInfo(room);
  const WALL = info ? info.wall : 5;
  const doorRect = info ? info.doorRect : null;
  const doorSide = info ? info.doorSide : 'top';

  // ===== 房间地板（内部空心区域） =====
  const fx = rx + WALL, fy = ry + WALL;
  const fw = rw - WALL*2, fh = rh - WALL*2;
  this.drawPixelRect(ctx, fx, fy, fw, fh, td.color);
  // 地板纹理
  ctx.fillStyle = td.colorDark;
  ctx.globalAlpha = 0.2;
  for (let x = 0; x < fw; x += 8) ctx.fillRect(fx + x, fy + fh/2, 5, 1);
  for (let y = 0; y < fh; y += 8) ctx.fillRect(fx + fw/2, fy + y, 1, 5);
  ctx.globalAlpha = 1;

  // ===== 墙体 =====
  // 画四面墙（先画全墙，后面"挖掉"门口缺口涂黑=去掉墙、露出通道地板）
  // 顶墙
  this.drawPixelRect(ctx, rx, ry, rw, WALL, COL.stoneDark);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(rx, ry, rw, 1);
  // 底墙
  this.drawPixelRect(ctx, rx, ry+rh-WALL, rw, WALL, COL.stoneDark);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(rx, ry+rh-1, rw, 1);
  // 左墙
  this.drawPixelRect(ctx, rx, ry, WALL, rh, COL.stoneDark);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(rx, ry, 1, rh);
  // 右墙
  this.drawPixelRect(ctx, rx+rw-WALL, ry, WALL, rh, COL.stoneDark);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(rx+rw-1, ry, 1, rh);

  // 墙上石砖细节（小方块花纹）
  ctx.fillStyle = '#2a2a2a';
  for (let i=0;i<Math.floor(rw/10);i++) {
    if (i % 2 === 0) ctx.fillRect(rx + i*10 + 2, ry + 1, 2, 1);
    else ctx.fillRect(rx + i*10 + 2, ry + rh - 2, 2, 1);
  }

  // ===== 挖掉门口缺口（去掉墙体，铺相同色地板与通道连通） =====
  if (doorRect) {
    const dr = doorRect;
    // 用"地板 + 门口框"覆盖墙上缺口
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
    // 门口门框（更亮的石框边，左右/上下）
    ctx.fillStyle = COL.stone;
    if (doorSide === 'left') {
      // 缺口在左墙：画上下两条门框
      ctx.fillRect(dr.x - 1, dr.y - 2, 4, 2);
      ctx.fillRect(dr.x - 1, dr.y + dr.h, 4, 2);
    } else if (doorSide === 'right') {
      ctx.fillRect(dr.x + dr.w - 3, dr.y - 2, 4, 2);
      ctx.fillRect(dr.x + dr.w - 3, dr.y + dr.h, 4, 2);
    } else if (doorSide === 'top') {
      // 顶墙缺口：画左右两条门框
      ctx.fillRect(dr.x - 2, dr.y - 1, 2, 4);
      ctx.fillRect(dr.x + dr.w, dr.y - 1, 2, 4);
    }
    // 门口阴影（进入房间暗一点）
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    const inset = 2;
    ctx.fillRect(dr.x + inset, dr.y + inset, dr.w - inset*2, dr.h - inset*2);
    ctx.restore();
  }

  // ===== 内饰（贴图优先 / 代码 fallback）=====
  ctx.save();
  ctx.translate(rx+rw/2, ry+rh/2);
  const tex = this.assets.get(room.type);
  if (tex) {
    ctx.imageSmoothingEnabled = false;
    try {
      // 仅绘制在墙内空心矩形中（不覆盖墙）
      ctx.drawImage(tex, -(fw/2), -(fh/2), fw, fh);
    } catch(e) {}
    ctx.restore();
  } else {
    this.drawRoomInterior(ctx, room.type, td, fw, fh);
    ctx.restore();
  }

  // 产出指示条
  const p = td.produce;
  if (p) {
    const prog = room.produceTimer / (p.interval || 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(fx + 2, fy + fh - 4, fw - 4, 3);
    ctx.fillStyle = td.colorDark;
    ctx.fillRect(fx + 2, fy + fh - 4, (fw - 4) * prog, 3);
  }

  // 手动功能冷却提示
  if (room.useCd && room.useCd > 0.1) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(fx, fy, fw, 12);
    ctx.fillStyle = '#fa5';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CD ${room.useCd.toFixed(1)}s`, rx + rw/2, fy + 10);
  }

  // 铁匠铺闪光标记
  if (room.type === 'blacksmith' && this.playerLevel < BLACKSMITH_UPGRADES.length) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now()/250);
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3*pulse;
    ctx.fillStyle = '#fa5';
    ctx.fillRect(rx + rw - 12, ry + 1, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UP', rx + rw - 7, ry + 10);
    ctx.restore();
  }
};

// ---- 房间内饰 fallback（代码绘制） ----
Game.prototype.drawRoomInterior = function(ctx, type, td, rw, rh) {
  // 注意：坐标系已平移到房间中心 (rx+rw/2, ry+rh/2)
  // rw = width*TILE = 80 (width=2) 或 40 (width=1)
  // rh = height*TILE = 40 (大部分，height=1) 或 80 (command height=2)
  switch (type) {
    case 'command':
      this.drawPixelRect(ctx, -20, 0, 40, 20, '#333');
      this.drawPixelRect(ctx, -18, 2, 36, 10, '#222');
      ctx.fillStyle = '#4af'; ctx.fillRect(-15, 4, 14, 6);
      ctx.fillStyle = '#f44'; ctx.fillRect(1, 4, 14, 6);
      this.drawPixelCircle(ctx, 0, -8, 6, '#fc2');
      ctx.fillStyle = '#222'; ctx.fillRect(-2, -8, 1, 2); ctx.fillRect(1, -8, 1, 2);
      break;
    case 'goldmine':
      this.drawPixelRect(ctx, -30, 8, 50, 10, '#5a3a0a');
      this.drawPixelRect(ctx, -28, 9, 46, 7, '#8b5a2b');
      for (let i=0;i<4;i++) {
        const gx = -24 + i*12;
        ctx.fillStyle = COL.gold; ctx.fillRect(gx, 2, 8, 6);
        ctx.fillStyle = COL.goldDark; ctx.fillRect(gx, 2, 8, 2); ctx.fillRect(gx, 7, 2, 1);
      }
      ctx.fillStyle = '#444'; ctx.fillRect(-35, 18, 70, 2);
      break;
    case 'farm':
      this.drawPixelRect(ctx, -35, 8, 70, 10, '#5a3a1a');
      for (let i=-24;i<=24;i+=8) { ctx.fillStyle = '#3a2a0a'; ctx.fillRect(i, 8, 2, 10); }
      for (let i=-28;i<=28;i+=8) {
        ctx.fillStyle = COL.food; ctx.fillRect(i-2, 1, 4, 7);
        ctx.fillRect(i-4, -2, 2, 4); ctx.fillRect(i+2, -2, 2, 4);
      }
      break;
    case 'powerplant':
      this.drawPixelRect(ctx, -32, -2, 64, 20, '#222');
      const t = Date.now()/100;
      for (let i=0;i<4;i++) {
        ctx.fillStyle = (Math.sin(t+i*1.5)>0) ? COL.power : COL.powerDark;
        ctx.fillRect(-28+i*14, 1, 10, 14);
      }
      ctx.fillStyle = '#fff'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
      ctx.fillText('⚡', 0, -6);
      break;
    case 'barracks':
      this.drawPixelRect(ctx, -34, -2, 68, 24, '#4a3020');
      for (let i=0;i<4;i++) {
        ctx.fillStyle = COL.red; ctx.fillRect(-28+i*14, 3, 5, 17);
        ctx.fillStyle = '#888'; ctx.fillRect(-30+i*14, -1, 9, 5);
      }
      ctx.fillStyle = COL.gold; this.drawStar(ctx, 0, -6, 4, 3);
      break;
    case 'armory':
      this.drawPixelRect(ctx, -36, -8, 72, 32, '#3a3a5a');
      for (let y=0;y<2;y++) { ctx.fillStyle = '#5a5a8a'; ctx.fillRect(-34, -6+y*16, 68, 2); }
      for (let i=0;i<8;i++) { ctx.fillStyle = COL.gold; ctx.fillRect(-32+i*8, -2, 5, 7); }
      ctx.fillStyle = '#aaa'; ctx.fillRect(-28, 10, 56, 5);
      ctx.fillStyle = '#666'; ctx.fillRect(-8, 8, 18, 10);
      this.drawPixelCircle(ctx, 22, -2, 3, '#3a5');
      this.drawPixelCircle(ctx, -22, -2, 3, '#3a5');
      break;
    case 'infirmary':
      this.drawPixelRect(ctx, -36, -2, 72, 22, '#fff');
      ctx.fillStyle = '#ddd'; ctx.fillRect(-36, 4, 72, 2); ctx.fillRect(-36, 12, 72, 2);
      ctx.fillStyle = '#e33'; ctx.fillRect(-3, -12, 6, 18); ctx.fillRect(-10, -5, 20, 6);
      ctx.fillStyle = COL.food; ctx.fillRect(-30, 0, 4, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(-30, 0, 4, 2);
      break;
    case 'warehouse':
      for (let i=0;i<2;i++) for (let j=0;j<3;j++) {
        const bx = -32 + j*22, by = -6 + i*12;
        this.drawPixelRect(ctx, bx, by, 18, 10, td.color);
        ctx.strokeStyle = td.colorDark; ctx.lineWidth = 2;
        ctx.strokeRect(bx+2, by+2, 14, 6);
        ctx.beginPath();
        ctx.moveTo(bx+2,by+2); ctx.lineTo(bx+16,by+8);
        ctx.moveTo(bx+16,by+2); ctx.lineTo(bx+2,by+8);
        ctx.stroke();
      }
      break;
    case 'trap':
      ctx.fillStyle = td.color;
      for (let i=-3;i<=3;i++) {
        ctx.beginPath();
        ctx.moveTo(i*9-5, 14); ctx.lineTo(i*9, -8); ctx.lineTo(i*9+5, 14);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = td.colorDark; ctx.lineWidth = 1;
      for (let i=-3;i<=3;i++) {
        ctx.beginPath();
        ctx.moveTo(i*9-5, 14); ctx.lineTo(i*9, -8); ctx.lineTo(i*9+5, 14);
        ctx.stroke();
      }
      this.drawPixelRect(ctx, -36, 12, 72, 6, '#444');
      break;
    case 'blacksmith':
      // 铁砧
      this.drawPixelRect(ctx, -16, 4, 32, 12, '#555');
      this.drawPixelRect(ctx, -12, 0, 24, 6, '#777');
      this.drawPixelRect(ctx, -20, 14, 40, 4, '#333');
      // 锤子
      ctx.fillStyle = '#888'; ctx.fillRect(12, -10, 10, 8);
      ctx.fillStyle = '#6b4420'; ctx.fillRect(15, -2, 4, 12);
      // 火焰
      const fb = Math.sin(Date.now()/120)*1;
      ctx.fillStyle = '#ff6'; ctx.fillRect(-6, -10+fb, 4, 6);
      ctx.fillStyle = '#f83'; ctx.fillRect(-4, -12+fb, 3, 4);
      ctx.fillStyle = '#ff6'; ctx.fillRect(-18, -8+fb, 3, 5);
      break;
    case 'wall':
      ctx.fillStyle = td.colorDark; ctx.fillRect(-rw/2+4, -rh/2+4, rw-8, rh-8);
      ctx.fillStyle = td.color;
      for (let by=-rh/2+6; by<rh/2-6; by+=8) {
        const offset = ((by+rh/2)/8)%2===0 ? 0 : 6;
        for (let bx=-rw/2+6+offset; bx<rw/2-6; bx+=12) ctx.fillRect(bx, by, 10, 6);
      }
      break;
  }
};

// ---- 建造预览 ----
Game.prototype.drawBuildPreview = function(ctx) {
  if (!this.selectedBuild || !this.hoverCell) return;
  const td = ROOM_TYPES[this.selectedBuild];
  const size = td.size;
  const {col, row} = this.hoverCell;
  if (col<0||row<0||col+size.w>BASEMENT_COLS||row+size.h>BASEMENT_ROWS) return;

  let valid = true;
  if (td.unique && this.rooms.some(r=>r.type===this.selectedBuild)) valid = false;
  for (let dc=0;dc<size.w;dc++) for (let dr=0;dr<size.h;dr++)
    if (this.grid[col+dc][row+dr] !== null) valid = false;
  if (!this.canAfford(td.cost)) valid = false;

  const rx = col*TILE, ry = GROUND_Y + row*TILE;
  const rw = size.w*TILE, rh = size.h*TILE;
  ctx.fillStyle = valid ? COL.buildGhost : COL.buildInvalid;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = valid ? '#8f8' : '#f55';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx+1, ry+1, rw-2, rh-2);
};

// ---- 玩家角色 ----
Game.prototype.drawPlayer = function(ctx, p) {
  const levelColor = this.playerLevel >= 4 ? '#ffcc00' : this.playerLevel >= 2 ? '#c0c0ff' : COL.player;
  const levelColorDark = this.playerLevel >= 4 ? '#b8860b' : this.playerLevel >= 2 ? '#7070b0' : COL.playerDark;

  const bob = Math.sin(Date.now()/180 + p.x*0.1) * 1;
  const x = p.x, y = p.y + bob;

  // 阴影（根据当前所在的地面线）
  const groundShadowY = p.inBasement
    ? Math.min(H - 6, p.y + 10)
    : GROUND_Y - 3;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x-16, groundShadowY, 32, 4);

  ctx.save();
  // 地下室中：稍微加一层蓝紫光，但完全不透明清晰可见
  if (p.inBasement) {
    // 留空，保持清晰
  }

  // 受击闪烁
  if (p.hitFlash > 0.2) {
    ctx.globalAlpha *= 0.5;
  }

  // 精灵图（若已加载）—— 3 帧横向排列：idle(0) walk(1) attack(2)
  const spr = this.assets.get('player_sprite');
  if (spr) {
    const frames = 3;
    const fw = spr.naturalWidth / frames;
    // 每帧的实际内容边界框（代码生成的 8-bit 玩家，确保头发/腰带/腕带完整）
    // frame: [srcX(相对帧起点), srcY, srcW, srcH]
    const FRAME_BBOX = [
      [108, 40, 47, 113],  // frame0 idle (ratio 0.613)
      [364, 40, 47, 113],  // frame1 walk (ratio 0.633)
      [603, 40, 61, 100],  // frame2 attack (剑伸出宽 ratio 0.685)
    ];
    // 选帧：攻击动画时 → frame 2；走动中 → frame 1；否则 frame 0
    let fi = 0;
    if (p.attackAnim > 0.3) fi = 2;
    else if (Math.abs(this.input.moveX) + Math.abs(this.input.moveY) > 0.1 ||
             (this.input.keys['ArrowLeft']||this.input.keys['ArrowRight']||
              this.input.keys['KeyA']||this.input.keys['KeyD']||
              this.input.keys['KeyW']||this.input.keys['KeyS']||
              this.input.keys['ArrowUp']||this.input.keys['ArrowDown'])) fi = 1;
    const bb = FRAME_BBOX[fi];
    // 目标尺寸：用户要求缩小玩家体型（马里奥比例）绘制高度 36px
    const groundContactY = p.inBasement ? Math.min(H - 6, p.y + 10) : GROUND_Y - 3;
    const targetH = 36;
    const targetW = Math.round(targetH * (bb[2] / bb[3]));
    const drawTopY = groundContactY - targetH + 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (p.facing < 0) {
      ctx.translate(x, drawTopY);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, fi*fw + bb[0], bb[1], bb[2], bb[3], -targetW/2, 0, targetW, targetH);
    } else {
      ctx.drawImage(spr, fi*fw + bb[0], bb[1], bb[2], bb[3], x - targetW/2, drawTopY, targetW, targetH);
    }
    ctx.restore();
  }

  if (!spr) {
    // 代码绘制 fallback（无贴图时）
    // 腿
    ctx.fillStyle = levelColorDark;
    ctx.fillRect(x-5, y-2, 4, 10);
    ctx.fillRect(x+1, y-2, 4, 10);
    ctx.fillStyle = '#222';
    ctx.fillRect(x-5, y+6, 4, 2);
    ctx.fillRect(x+1, y+6, 4, 2);

    // 身体
    this.drawPixelRect(ctx, x-8, y-14, 16, 14, levelColor);
    this.drawPixelRect(ctx, x-8, y-6, 16, 2, levelColorDark);
    // 肩膀阴影
    ctx.fillStyle = levelColorDark;
    ctx.fillRect(x-9, y-13, 2, 6);
    ctx.fillRect(x+7, y-13, 2, 6);

    // 头
    this.drawPixelCircle(ctx, x, y-20, 6, '#f5cba7');
    // 头发（随等级变样）
    if (this.playerLevel >= 4) {
      // 金冠
      ctx.fillStyle = '#ff0';
      ctx.fillRect(x-6, y-28, 12, 3);
      ctx.fillRect(x-6, y-31, 2, 3);
      ctx.fillRect(x-1, y-33, 2, 5);
      ctx.fillRect(x+4, y-31, 2, 3);
    } else if (this.playerLevel >= 3) {
      // 头盔
      ctx.fillStyle = '#888';
      ctx.fillRect(x-6, y-28, 12, 5);
      ctx.fillStyle = '#f00';
      ctx.fillRect(x-1, y-32, 2, 5);
    } else if (this.playerLevel >= 2) {
      // 短发
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x-6, y-27, 12, 3);
      ctx.fillRect(x-6, y-25, 2, 2);
      ctx.fillRect(x+4, y-25, 2, 2);
    } else {
      // 新手乱发
      ctx.fillStyle = '#5a4020';
      ctx.fillRect(x-5, y-27, 10, 2);
      ctx.fillRect(x-6, y-25, 2, 1);
      ctx.fillRect(x+4, y-25, 2, 1);
    }
    // 眼睛（根据面朝）
    ctx.fillStyle = '#000';
    const ex = p.facing > 0 ? 1 : -2;
    ctx.fillRect(x + ex, y-21, 1, 2);
    ctx.fillRect(x + ex + 2, y-21, 1, 2);
  }

  // 武器/攻击动画 (代码绘制，总是叠加，贴图基础上加武器特效)
  const wx = x + p.facing * 6;
  const wy = y - 10;
  ctx.save();
  ctx.translate(wx, wy);
  const atkAngle = p.attackAnim > 0 ? (p.facing>0 ? -1 : 1) * (p.attackAnim * Math.PI * 0.6) : (p.facing>0?0.2:-0.2);
  ctx.rotate(atkAngle);
  if (spr) {
    // 精灵图已自带武器，这里只叠加挥砍弧光
  } else {
    if (this.playerLevel >= 4) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, -1, 22, 2);
      ctx.fillStyle = '#f0f'; ctx.fillRect(2, -2, 18, 4);
      ctx.fillStyle = '#a0a'; ctx.fillRect(-4, -3, 6, 6);
    } else if (this.playerLevel >= 3) {
      ctx.fillStyle = '#dde'; ctx.fillRect(0, -1, 20, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 20, 1);
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-6, -4, 6, 8);
      ctx.fillStyle = '#fc0'; ctx.fillRect(-2, -5, 2, 10);
    } else if (this.playerLevel >= 2) {
      ctx.fillStyle = '#bbc'; ctx.fillRect(0, -1, 14, 2);
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-4, -3, 4, 6);
    } else {
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(0, -1, 12, 2);
      ctx.fillStyle = '#6a3a0a'; ctx.fillRect(10, -3, 4, 6);
    }
  }
  // 挥砍特效
  if (p.attackAnim > 0) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = p.attackAnim * 0.7;
    ctx.beginPath();
    ctx.arc(14, 0, 18, -0.5, 0.5);
    ctx.lineTo(14, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.restore();

  // 玩家HP条
  if (p.hp < p.maxHp) {
    const bw = 36;
    ctx.fillStyle = '#200';
    ctx.fillRect(x-bw/2, y-40, bw, 5);
    ctx.fillStyle = p.hp/p.maxHp > 0.5 ? '#4c4' : p.hp/p.maxHp > 0.25 ? '#fc4' : '#f44';
    ctx.fillRect(x-bw/2, y-40, bw*(p.hp/p.maxHp), 5);
  }

  // 复活倒计时
  if (p.hp <= 0 && p.respawnTimer > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`复活 ${Math.ceil(p.respawnTimer)}s`, p.x, GROUND_Y - 50);
  }

  // 状态 Buff 标记
  const playerAtkBuff = this.buffs && this.buffs.playerAtk;
  if (playerAtkBuff) {
    const remain = Math.max(0, playerAtkBuff.until - performance.now()/1000);
    ctx.fillStyle = '#ff0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ATK×${playerAtkBuff.mult} ${remain.toFixed(0)}s`, x, y - 44);
  }
};

// ---- 资源堆 ----
Game.prototype.drawResourcePile = function(ctx, pile) {
  const bob = Math.sin(pile.bob) * 2;
  const x = pile.x, y = pile.y + bob;
  const col = pile.type === 'gold' ? COL.pileGold : pile.type === 'food' ? COL.pileFood : COL.pilePower;
  const colDark = pile.type === 'gold' ? COL.goldDark : pile.type === 'food' ? COL.foodDark : COL.powerDark;
  const icon = pile.type === 'gold' ? '◉' : pile.type === 'food' ? '♥' : '⚡';

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x-10, GROUND_Y-3, 20, 3);

  // 小堆主体
  this.drawPixelRect(ctx, x-10, y-4, 20, 16, colDark);
  this.drawPixelRect(ctx, x-8, y-6, 16, 14, col);
  ctx.fillStyle = colDark;
  ctx.fillRect(x-6, y-2, 2, 2);
  ctx.fillRect(x+1, y+1, 2, 2);
  ctx.fillRect(x-3, y+4, 2, 2);

  // 光泽
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.4;
  ctx.fillRect(x-7, y-5, 4, 2);
  ctx.globalAlpha = 1;

  // 图标
  ctx.fillStyle = colDark;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(icon, x, y+5);

  // 数量气泡（当有玩家靠近时显示）
  if (this.player.hp > 0) {
    const dx = x - this.player.x, dy = y - this.player.y;
    if (Math.sqrt(dx*dx+dy*dy) < RESOURCE_PILE.collectRadius + 30) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x-16, y-22, 32, 12);
      ctx.fillStyle = col;
      ctx.font = '10px monospace';
      ctx.fillText(`+${pile.amount}${icon}`, x, y-13);
    }
  }
};

// ---- 士兵 ----
Game.prototype.drawSoldier = function(ctx, s) {
  const bob = Math.sin(Date.now()/200 + s.x)*1;
  const shoot = s.shootAnim;
  const x = s.x, y = s.y + bob;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x-8, GROUND_Y-3, 16, 3);

  // 精灵图（3 帧 idle/walk/shoot）
  const sspr = this.assets.get('soldier_sprite');
  if (sspr) {
    const frames = 3;
    const fw = sspr.naturalWidth / frames;
    const fh = sspr.naturalHeight;
    let fi = 0;
    if (shoot > 0.4) fi = 2;
    else if (Math.abs(s.x - (s.targetX||s.x)) > 2) fi = 1;
    const tw = 34, th = 60;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // 士兵面朝丧尸方向（与丧尸相反）
    const faceRight = s.x > DOOR_X;  // 在右侧的士兵面朝左→但默认精灵朝右，需要翻转
    if (faceRight) {
      // 士兵在右侧，丧尸从右来，士兵面朝右→不用翻
    } else {
      // 士兵在左侧，丧尸从左来，士兵面朝左→翻转
      ctx.translate(x, y - 34);
      ctx.scale(-1, 1);
      ctx.drawImage(sspr, fi*fw, 0, fw, fh, -tw/2, 0, tw, th);
      ctx.restore();
      return;
    }
    ctx.drawImage(sspr, fi*fw, 0, fw, fh, x - tw/2, y - 34, tw, th);
    ctx.restore();
    // 枪口闪光
    if (shoot > 0.5) {
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x + 14, y - 14, 5, 5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 16, y - 12, 3, 3);
    }
    return;
  }

  // 代码绘制 fallback
  ctx.fillStyle = '#2a4a6a'; ctx.fillRect(x-5, y-4, 4, 10); ctx.fillRect(x+1, y-4, 4, 10);
  ctx.fillStyle = '#1a2a3a'; ctx.fillRect(x-5, y+4, 4, 2); ctx.fillRect(x+1, y+4, 4, 2);
  this.drawPixelRect(ctx, x-7, y-16, 14, 12, COL.soldier);
  this.drawPixelRect(ctx, x-7, y-8, 14, 2, COL.soldierDark);
  ctx.fillStyle = '#2a4a6a'; ctx.fillRect(x-10, y-14, 3, 8);
  this.drawPixelCircle(ctx, x, y-22, 5, '#f5cba7');
  this.drawPixelRect(ctx, x-6, y-28, 12, 4, COL.soldierDark);
  this.drawPixelRect(ctx, x-6, y-25, 12, 2, COL.soldier);
  ctx.fillStyle = '#000'; ctx.fillRect(x-2, y-22, 1, 2); ctx.fillRect(x+1, y-22, 1, 2);

  const gunAngle = shoot>0 ? -0.3 : 0;
  ctx.save();
  ctx.translate(x+6, y-12);
  ctx.rotate(gunAngle);
  ctx.fillStyle = '#333'; ctx.fillRect(0, -1, 14, 3);
  ctx.fillStyle = '#555'; ctx.fillRect(10, -2, 4, 5);
  if (shoot > 0.5) {
    ctx.fillStyle = COL.gold; ctx.fillRect(14, -3, 5, 7);
    ctx.fillStyle = '#fff'; ctx.fillRect(16, -1, 3, 3);
  }
  ctx.restore();
};

// ---- 丧尸 ----
Game.prototype.drawZombie = function(ctx, z) {
  let bodyCol = COL.zombie, bodyDark = COL.zombieDark, headCol = '#8ab65a';
  let scale = 1;
  if (z.type === 'fast') { bodyCol='#3ab07a'; bodyDark='#2a805a'; headCol='#5ad09a'; }
  if (z.type === 'tank') { bodyCol='#565'; bodyDark='#343'; headCol='#787'; scale=1.3; }

  const bob = Math.sin(z.walkAnim)*2;
  const x = z.x, y = z.y + bob;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x-8*scale, GROUND_Y-3, 16*scale, 3);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 精灵图（3 帧 idle/walk/attack）
  const zspr = this.assets.get('zombie_sprite');
  if (zspr) {
    const frames = 3;
    const fw = zspr.naturalWidth / frames;
    const fh = zspr.naturalHeight;
    let fi = 0;
    if (z.attackAnim > 0.4) fi = 2;
    else if (Math.abs(z.walkAnim) > 0.3) fi = 1;
    const tw = 32, th = 66;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // 丧尸朝 DOOR_X 走（面朝中央）
    const faceRight = DOOR_X > z.x;
    if (!faceRight) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(zspr, fi*fw, 0, fw, fh, -tw/2, -th+10, tw, th);
    ctx.restore();
  }

  if (!zspr) {
    // 代码绘制 fallback
    const legOffset = Math.sin(z.walkAnim)*3;
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-5, -4-legOffset, 4, 10+legOffset);
    ctx.fillRect(1, -4+legOffset, 4, 10-legOffset);
    this.drawPixelRect(ctx, -7, -16, 14, 12, bodyCol);
    this.drawPixelRect(ctx, -7, -8, 14, 2, bodyDark);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(-3, -12, 3, 2);
    const armF = z.attackAnim;
    ctx.fillStyle = bodyCol;
    ctx.fillRect(-10 - armF*4, -15, 4, 8);
    ctx.fillRect(6 + armF*4, -15, 4, 8);
    ctx.fillStyle = armF>0.5 ? '#f44' : '#2a2';
    ctx.fillRect(-11 - armF*4, -8, 2, 2);
    ctx.fillRect(9 + armF*4, -8, 2, 2);
    this.drawPixelCircle(ctx, 0, -22, 6, headCol);
    ctx.fillStyle = '#833'; ctx.fillRect(-3, -26, 2, 2); ctx.fillRect(2, -20, 3, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -23, 3, 3); ctx.fillRect(1, -23, 3, 3);
    ctx.fillStyle = '#f00'; ctx.fillRect(-3, -22, 1, 1); ctx.fillRect(2, -22, 1, 1);
    ctx.fillStyle = '#300'; ctx.fillRect(-3, -18, 6, 2);
    ctx.fillStyle = '#f00'; ctx.fillRect(-2, -17, 1, 1); ctx.fillRect(1, -17, 1, 1);
  }
  ctx.restore();

  if (z.hp < z.maxHp) {
    const bw = 30 * scale;
    ctx.fillStyle = '#400'; ctx.fillRect(z.x-bw/2, z.y-36*scale, bw, 4);
    ctx.fillStyle = COL.red; ctx.fillRect(z.x-bw/2, z.y-36*scale, bw*(z.hp/z.maxHp), 4);
  }
};

// ---- 子弹 ----
Game.prototype.drawProjectile = function(ctx, p) {
  ctx.fillStyle = p.fromZombie ? '#f55' : '#fc6';
  ctx.fillRect(p.x-2, p.y-1, 5, 3);
  ctx.fillStyle = p.fromZombie ? '#faa' : '#fff';
  ctx.fillRect(p.x-1, p.y, 2, 1);
  ctx.strokeStyle = p.fromZombie ? 'rgba(255,80,80,0.4)' : 'rgba(255,220,100,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx*0.02, p.y - p.vy*0.02);
  ctx.stroke();
};
