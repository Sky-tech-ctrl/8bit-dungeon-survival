# -*- coding: utf-8 -*-
"""
========================================================================
 8-BIT 地牢求生 —— 标题界面美术资源生成器
========================================================================
 全部图像都遵循同一条 8-bit 工作流：
   1. 在「设计分辨率」（很小，几十~两百像素）上逐像素绘制
   2. 用 NEAREST 最近邻放大 SCALE 倍 → 得到硬边、无抗锯齿的像素风
 中文字同理：先用黑体渲染成很小的位图，再最近邻放大，
 这样得到的中文自带像素颗粒感，和 Latin 手绘点阵字风格统一。

 产出：
   assets/title_bg.png        标题背景图（夜色地表 + 地牢剖面）
   assets/title_logo.png      8-bit 标题 LOGO
   assets/title_zombie.png    右侧探出的丧尸半身 + 手持石碑（PVZ 风）
   assets/title_notepad.png   左侧探出的记事本（点击开启「游戏心得」）
   assets/title_spider.png    彩蛋：倒挂的蜘蛛侠（Q 版圆头）
   assets/meteor.png          坠落中的陨石（3 帧，游戏内天灾用）
   assets/world_bg.png        整张世界背景（天空 + 地层剖面，960×720）

 运行：python make_title_art.py
========================================================================
"""
import os
import math
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets')
CJK_FONT = r'C:\Windows\Fonts\simhei.ttf'   # 黑体：笔画粗、缩到极小仍可辨认

NEAREST = Image.NEAREST


# ======================================================================
# 通用像素画工具
# ======================================================================

def canvas(w, h):
    """新建一张透明的设计稿画布。"""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def upscale(img, scale):
    """最近邻放大 —— 像素风的灵魂，绝不能用双线性。"""
    return img.resize((img.width * scale, img.height * scale), NEAREST)


def px(d, x, y, col):
    d.point((x, y), fill=col)


def rect(d, x, y, w, h, col):
    if w <= 0 or h <= 0:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col)


def outline_rect(d, x, y, w, h, col):
    d.rectangle([x, y, x + w - 1, y + h - 1], outline=col)


def circle(d, cx, cy, r, col):
    """像素圆：逐像素判定，避免 PIL 椭圆的反锯齿边。"""
    for yy in range(int(cy - r), int(cy + r) + 1):
        for xx in range(int(cx - r), int(cx + r) + 1):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                d.point((xx, yy), fill=col)


def vgrad(d, x, y, w, h, top, bottom, bands=None):
    """竖直渐变，但切成有限个色带 —— 保持 8-bit 的分层感而不是平滑过渡。"""
    bands = bands or h
    for i in range(bands):
        t = i / max(1, bands - 1)
        col = tuple(int(top[c] + (bottom[c] - top[c]) * t) for c in range(3))
        y0 = y + int(h * i / bands)
        y1 = y + int(h * (i + 1) / bands)
        rect(d, x, y0, w, max(1, y1 - y0), col)


def pixel_text(text, font_px, color, spacing=0):
    """
    中文/任意文字的像素化：用黑体在极小字号上渲染，
    得到的位图本身就已经是「点阵字」，交给调用方再整体放大。
    返回 RGBA 图（紧贴文字边界）。
    """
    font = ImageFont.truetype(CJK_FONT, font_px)
    tmp = Image.new('RGBA', (font_px * len(text) * 2 + 20, font_px * 2 + 20), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    x = 5
    for ch in text:
        td.text((x, 5), ch, font=font, fill=color)
        adv = td.textlength(ch, font=font)
        x += int(adv) + spacing
    bbox = tmp.getbbox()
    return tmp.crop(bbox) if bbox else tmp


def paste(dst, src, x, y):
    dst.alpha_composite(src, (int(x), int(y)))


# ----------------------------------------------------------------------
# 手绘 5×7 点阵字库（只收录 LOGO 需要的字符）
# ----------------------------------------------------------------------
FONT5x7 = {
    '8': ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    '-': ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    'I': ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    'G': ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    'V': ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    ' ': ["00000"] * 7,
}


def blit_5x7(d, text, x, y, col, px_size=1, gap=1):
    """把 5×7 点阵字画到画布上，返回占用宽度。"""
    cx = x
    for ch in text:
        glyph = FONT5x7.get(ch.upper())
        if glyph is None:
            cx += (5 + gap) * px_size
            continue
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == '1':
                    rect(d, cx + rx * px_size, y + ry * px_size, px_size, px_size, col)
        cx += (5 + gap) * px_size
    return cx - x


# ======================================================================
# ① 标题背景图 —— 夜色地表 + 地牢剖面
# ======================================================================
def make_background():
    """
    构图刻意呼应游戏本体：上五分之一是地表（丧尸从两侧涌来），
    下面是地牢剖面（玩家建造房间的地方）。
    中左区域整体压暗，给 LOGO 和左侧记事本留出读字空间。
    """
    W, H, SCALE = 240, 180, 4
    GROUND = 52                      # 地表线
    img, d = canvas(W, H)
    rnd = random.Random(20260904)

    # ---- 夜空：分 12 段色带，避免平滑渐变破坏像素感 ----
    vgrad(d, 0, 0, W, GROUND, (10, 9, 30), (58, 30, 62), bands=12)

    # ---- 星星（越靠地平线越稀疏）----
    for _ in range(150):
        sx = rnd.randrange(W)
        sy = rnd.randrange(GROUND - 6)
        if rnd.random() > (1.0 - sy / GROUND) * 0.9:
            continue
        c = rnd.choice([(255, 255, 255), (200, 214, 255), (255, 240, 200)])
        px(d, sx, sy, c)
        if rnd.random() < 0.12:      # 少量「大星」带十字光芒
            px(d, sx - 1, sy, c)
            px(d, sx + 1, sy, c)
            px(d, sx, sy - 1, c)
            px(d, sx, sy + 1, c)

    # ---- 月亮 + 环形山 ----
    circle(d, 202, 24, 15, (244, 241, 208))
    circle(d, 202, 24, 13, (252, 250, 226))
    for cxr, cyr, rr in [(197, 20, 3), (206, 27, 2), (200, 30, 2), (208, 18, 1)]:
        circle(d, cxr, cyr, rr, (222, 218, 186))
    # 月晕
    for rr, a in [(19, 26), (23, 14), (27, 7)]:
        halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        circle(hd, 202, 24, rr, (255, 250, 210, a))
        img.alpha_composite(halo)
    d = ImageDraw.Draw(img)

    # ---- 远山剪影（两层，制造纵深）----
    def ridge(base_y, amp, col, seed, step=7):
        pts, rr = [], random.Random(seed)
        x = -4
        yv = base_y
        while x < W + 8:
            pts.append((x, yv))
            yv = base_y - rr.randrange(0, amp)
            x += step
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            for xx in range(x0, x1):
                t = (xx - x0) / max(1, (x1 - x0))
                yy = int(y0 + (y1 - y0) * t)
                if 0 <= xx < W:
                    rect(d, xx, yy, 1, base_y - yy + 14, col)

    ridge(GROUND - 4, 17, (26, 19, 48), 11, step=9)
    ridge(GROUND - 1, 10, (36, 26, 58), 22, step=6)

    # ---- 地平线上的城堡剪影（点题：这是要守的家）----
    cx0 = 40
    castle = (52, 40, 74)          # 比夜空亮一档，否则整座城堡糊在天上看不见
    castle_e = (78, 62, 104)       # 受月光的边缘
    rect(d, cx0, GROUND - 26, 46, 26, castle)          # 主楼
    rect(d, cx0 - 9, GROUND - 20, 9, 20, castle)       # 左翼
    rect(d, cx0 + 46, GROUND - 22, 10, 22, castle)     # 右翼
    for tx in (cx0 - 11, cx0 + 20, cx0 + 50):          # 塔楼
        rect(d, tx, GROUND - 38, 10, 38, castle)
        for k in range(3):                             # 城垛
            rect(d, tx + k * 4, GROUND - 41, 3, 3, castle)
        rect(d, tx - 1, GROUND - 45, 12, 4, (40, 30, 58))
        rect(d, tx, GROUND - 38, 1, 38, castle_e)      # 塔身受光棱线
    for k in range(0, 46, 6):                          # 主楼城垛
        rect(d, cx0 + k, GROUND - 29, 4, 3, castle)
    rect(d, cx0, GROUND - 26, 46, 1, castle_e)         # 屋檐受光
    rect(d, cx0, GROUND - 26, 1, 26, castle_e)
    for wx, wy in [(cx0 + 6, GROUND - 20), (cx0 + 18, GROUND - 20), (cx0 + 30, GROUND - 20),
                   (cx0 + 12, GROUND - 11), (cx0 + 34, GROUND - 11), (cx0 - 8, GROUND - 26),
                   (cx0 + 52, GROUND - 30)]:
        rect(d, wx, wy, 3, 4, (255, 204, 85))          # 亮着的窗
        rect(d, wx, wy, 3, 1, (255, 232, 150))

    # ---- 地表草皮 ----
    rect(d, 0, GROUND, W, 7, (74, 140, 58))
    rect(d, 0, GROUND, W, 2, (100, 170, 74))
    for _ in range(240):                               # 草叶噪点
        gx, gy = rnd.randrange(W), GROUND + rnd.randrange(2, 7)
        px(d, gx, gy, (58, 108, 42))
    for gx in range(0, W, 3):                          # 草尖
        if rnd.random() < 0.55:
            rect(d, gx, GROUND - 1, 1, 1, (100, 170, 74))

    # ---- 泥土层 ----
    rect(d, 0, GROUND + 7, W, 10, (139, 90, 43))
    rect(d, 0, GROUND + 7, W, 2, (160, 106, 54))
    for _ in range(160):
        rx0, ry0 = rnd.randrange(W), GROUND + 8 + rnd.randrange(9)
        px(d, rx0, ry0, (107, 68, 32))

    # ---- 地牢主腔体 ----
    CAVE_TOP = GROUND + 17
    rect(d, 0, CAVE_TOP, W, H - CAVE_TOP, (18, 13, 20))
    for _ in range(400):                               # 岩壁颗粒
        rx0, ry0 = rnd.randrange(W), rnd.randrange(CAVE_TOP, H)
        px(d, rx0, ry0, rnd.choice([(26, 19, 28), (14, 10, 16), (32, 24, 34)]))

    # 洞顶钟乳石
    for sx in range(2, W, 11):
        hgt = rnd.randrange(3, 9)
        for k in range(hgt):
            wdt = max(1, (hgt - k) // 2)
            rect(d, sx, CAVE_TOP + k, wdt, 1, (60, 44, 30))

    # ---- 地牢房间剖面（呼应游戏里的建造系统）----
    def dungeon_room(rx, ry, rw, rh, wall, floor, glow=None):
        rect(d, rx, ry, rw, rh, (36, 28, 34))
        outline_rect(d, rx, ry, rw, rh, wall)
        rect(d, rx + 1, ry + rh - 3, rw - 2, 2, floor)
        for bx in range(rx + 1, rx + rw - 1, 4):       # 砖缝
            rect(d, bx, ry + 1, 1, rh - 4, (28, 22, 28))
        if glow:
            circle(d, rx + rw // 2, ry + rh // 2, max(2, rh // 4), glow)

    dungeon_room(14, CAVE_TOP + 14, 34, 22, (122, 122, 122), (90, 90, 90), (70, 52, 24))
    dungeon_room(58, CAVE_TOP + 30, 30, 20, (122, 122, 122), (90, 90, 90), (24, 52, 70))
    dungeon_room(150, CAVE_TOP + 20, 36, 24, (122, 122, 122), (90, 90, 90), (70, 60, 20))
    dungeon_room(196, CAVE_TOP + 46, 32, 20, (122, 122, 122), (90, 90, 90), (28, 60, 40))
    dungeon_room(96, CAVE_TOP + 52, 40, 22, (122, 122, 122), (90, 90, 90), (60, 30, 30))

    # ---- 中央活板门 + 竖井（游戏里连通地表和地下室的通道）----
    door_x = 112
    rect(d, door_x, GROUND - 3, 22, 4, (139, 69, 19))
    rect(d, door_x, GROUND - 3, 22, 1, (170, 96, 40))
    for k in range(3):
        rect(d, door_x + 2 + k * 7, GROUND - 3, 1, 4, (90, 46, 12))
    rect(d, door_x + 4, CAVE_TOP, 14, H - CAVE_TOP - 60, (24, 18, 26))
    for lz in range(CAVE_TOP, H - 60, 6):              # 梯子
        rect(d, door_x + 5, lz, 12, 1, (120, 82, 38))
    rect(d, door_x + 5, CAVE_TOP, 1, H - CAVE_TOP - 60, (120, 82, 38))
    rect(d, door_x + 16, CAVE_TOP, 1, H - CAVE_TOP - 60, (120, 82, 38))

    # ---- 火把（暖光点缀，打破整片冷色）----
    def torch(tx, ty):
        rect(d, tx, ty, 2, 7, (90, 58, 26))
        circle(d, tx + 1, ty - 2, 3, (255, 154, 60))
        circle(d, tx + 1, ty - 3, 2, (255, 210, 74))
        px(d, tx + 1, ty - 5, (255, 245, 190))
        for rr, a in [(7, 40), (11, 22), (16, 11)]:    # 光晕
            g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            gd = ImageDraw.Draw(g)
            circle(gd, tx + 1, ty - 2, rr, (255, 160, 60, a))
            img.alpha_composite(g)

    for tx, ty in [(8, CAVE_TOP + 12), (92, CAVE_TOP + 26), (142, CAVE_TOP + 44),
                   (190, CAVE_TOP + 16), (52, CAVE_TOP + 58)]:
        torch(tx, ty)
    d = ImageDraw.Draw(img)

    # ---- 地表墓碑 & 枯树（气氛小物）----
    def grave(gx, gy):
        rect(d, gx, gy - 8, 8, 9, (122, 122, 122))
        rect(d, gx + 1, gy - 10, 6, 3, (122, 122, 122))
        rect(d, gx + 1, gy - 8, 6, 1, (154, 154, 154))
        rect(d, gx + 3, gy - 7, 2, 4, (90, 90, 90))
        rect(d, gx + 2, gy - 6, 4, 1, (90, 90, 90))

    for gx in (16, 30, 168, 224):
        grave(gx, GROUND)

    def dead_tree(tx, ty):
        rect(d, tx, ty - 20, 3, 20, (48, 34, 26))
        for dx0, dy0, ln in [(-6, -18, 6), (3, -15, 6), (-5, -12, 4), (4, -9, 4)]:
            rect(d, tx + dx0, ty + dy0, ln, 1, (48, 34, 26))
            rect(d, tx + dx0 + (0 if dx0 < 0 else ln - 1), ty + dy0 - 3, 1, 3, (48, 34, 26))

    dead_tree(196, GROUND)
    dead_tree(6, GROUND)

    # ---- 整体压暗 + 暗角，保证前景 UI 永远读得清 ----
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for yy in range(H):
        for xx in range(0, W, 1):
            # 左侧和中部压得更暗（LOGO / 记事本区），右侧留亮给丧尸
            dx0 = abs(xx - W * 0.42) / (W * 0.6)
            dy0 = abs(yy - H * 0.5) / (H * 0.75)
            v = min(1.0, (dx0 ** 2 + dy0 ** 2) * 0.55)
            base = 70 if xx < W * 0.66 else 40
            sd.point((xx, yy), fill=(0, 0, 16, int(base * 0.45 + v * 120)))
    img.alpha_composite(shade)

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'title_bg.png'))
    print('  title_bg.png       ', out.size)


# ======================================================================
# ② 标题 LOGO
# ======================================================================
def make_logo():
    """上层「8-BIT」用手绘 5×7 点阵字，下层中文用黑体缩小再放大。"""
    W, H, SCALE = 200, 76, 4
    img, d = canvas(W, H)

    # ---- 8-BIT：三层描边（黑外框 / 暗金 / 亮金），做出立体点阵感 ----
    txt, ps = '8-BIT', 4
    tw = len('8-BIT') * (5 + 1) * ps - ps
    x0 = (W - tw) // 2
    y0 = 4
    for ox, oy, col in [(0, 3, (0, 0, 0)), (3, 0, (0, 0, 0)), (3, 3, (0, 0, 0)),
                        (0, 0, (0, 0, 0)), (-1, -1, (0, 0, 0)),
                        (1, 1, (184, 134, 11)), (0, 0, (255, 215, 0))]:
        blit_5x7(d, txt, x0 + ox, y0 + oy, col, px_size=ps)
    # 斜面高光：整体向上偏移 1 个设计像素再压回主色，留出一条亮边
    blit_5x7(d, txt, x0, y0 - 1, (255, 245, 190), px_size=ps)
    blit_5x7(d, txt, x0, y0, (255, 215, 0), px_size=ps)

    # ---- 中文主标题 ----
    cn = pixel_text('地牢求生', 26, (255, 236, 170, 255), spacing=1)
    cn_sh = pixel_text('地牢求生', 26, (0, 0, 0, 255), spacing=1)
    cx = (W - cn.width) // 2
    cy = 40
    paste(img, cn_sh, cx + 2, cy + 2)
    paste(img, cn, cx, cy)

    # ---- 英文副标题 ----
    d2 = ImageDraw.Draw(img)
    sub = 'DUNGEON SURVIVAL'
    sw = len(sub) * (5 + 1) - 1
    blit_5x7(d2, sub, (W - sw) // 2 + 1, H - 9 + 1, (0, 0, 0), px_size=1)
    blit_5x7(d2, sub, (W - sw) // 2, H - 9, (139, 233, 255), px_size=1)

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'title_logo.png'))
    print('  title_logo.png     ', out.size)


# ======================================================================
# ③ 丧尸半身 + 手持石碑（PVZ 风）
# ======================================================================
def make_zombie_tablet():
    """
    PVZ 式构图：丧尸从画面右缘探进来，肩膀被裁掉一半（暗示身体还在画外），
    左手扣住石碑右缘、右手从下方托底 —— 两只手都必须压在石碑之上，
    「托着」的空间关系才立得住。

    绘制顺序即遮挡顺序：
      远侧手臂 → 躯干 → 脖子/头 → 石碑 → 近侧小臂 + 双手
    石碑中央留出一块内凹刻字区，三个选项由 HTML 按钮覆盖上去。
    """
    W, H, SCALE = 160, 184, 4
    img, d = canvas(W, H)

    SKIN = (122, 168, 92)
    SKIN_D = (86, 124, 62)
    SKIN_L = (152, 196, 118)
    SKIN_XD = (60, 90, 44)
    SHIRT = (92, 100, 122)
    SHIRT_D = (58, 64, 82)
    SHIRT_L = (120, 128, 150)
    HAIR = (46, 40, 52)
    HAIR_L = (72, 62, 80)
    STONE = (138, 138, 148)
    STONE_D = (90, 90, 100)
    STONE_XD = (62, 62, 72)
    STONE_L = (176, 176, 188)
    CARVE = (58, 58, 68)

    rnd = random.Random(77)

    # ------------------------------------------------------------------
    # 远侧手臂：只露出上臂，其余被石碑挡住，用来交代「两只手」的来源
    # ------------------------------------------------------------------
    rect(d, 96, 74, 16, 40, SHIRT_D)
    rect(d, 96, 74, 16, 3, SHIRT)

    # ------------------------------------------------------------------
    # 躯干：肩线自左向右抬高，做出「侧身探进来」的斜度
    # ------------------------------------------------------------------
    for i, x in enumerate(range(92, W)):
        top = 72 - int(i * 0.22)
        rect(d, x, top, 1, H - top, SHIRT)
    rect(d, 92, 72, 12, 3, SHIRT_L)
    rect(d, 140, 60, 20, H - 60, SHIRT_D)
    # 破洞与补丁 —— 丧尸的衬衫必须是烂的
    for hx, hy, hw, hh in [(112, 118, 7, 6), (132, 138, 8, 5),
                           (120, 164, 6, 7), (144, 98, 5, 5), (150, 126, 6, 4)]:
        rect(d, hx - 1, hy - 1, hw + 2, hh + 2, (34, 38, 50))   # 破口暗边
        rect(d, hx, hy, hw, hh, SKIN_XD)                        # 透出的皮肤
        rect(d, hx, hy, hw, 1, (30, 34, 44))                    # 上沿最深
        for k in range(hw):                                     # 参差的布边
            if (hx + k) % 3 == 0:
                rect(d, hx + k, hy + hh, 1, 1, (34, 38, 50))
    # 衣领 + 领带（PVZ 上班族丧尸的记忆点）
    rect(d, 108, 66, 30, 6, SHIRT_D)
    rect(d, 118, 66, 12, 10, SKIN_XD)
    rect(d, 120, 74, 8, 5, (150, 52, 52))
    rect(d, 121, 79, 6, 26, (150, 52, 52))
    rect(d, 121, 79, 2, 26, (188, 74, 74))
    rect(d, 120, 103, 8, 6, (120, 40, 40))

    # ------------------------------------------------------------------
    # 脖子与头（头略微前倾，凑向石碑）
    # ------------------------------------------------------------------
    rect(d, 116, 54, 16, 14, SKIN_D)
    rect(d, 116, 54, 16, 3, SKIN)

    HX, HY = 124, 32
    HW, HH = 42, 40
    hx0, hy0 = HX - HW // 2, HY - HH // 2
    # 圆角方脸：逐行收窄四角，避免死板的正方形
    for row in range(HH):
        inset = 0
        if row < 3:
            inset = 3 - row
        elif row > HH - 4:
            inset = row - (HH - 4)
        rect(d, hx0 + inset, hy0 + row, HW - inset * 2, 1, SKIN)
    rect(d, hx0 + 2, hy0, HW - 4, 3, SKIN_L)
    rect(d, hx0 + HW - 7, hy0 + 3, 6, HH - 7, SKIN_D)
    rect(d, hx0 - 3, HY - 4, 4, 11, SKIN_D)
    rect(d, hx0 - 2, HY - 2, 2, 6, SKIN_XD)
    # 下颌向左突出一点，强化「歪头」
    rect(d, hx0 - 1, hy0 + HH - 12, 6, 9, SKIN)
    rect(d, hx0 - 1, hy0 + HH - 4, 6, 2, SKIN_D)

    # 乱发：长短不一的发梢
    for hx in range(hx0 - 2, hx0 + HW + 2, 3):
        hh = 5 + ((hx * 13) % 7)
        rect(d, hx, hy0 - hh + 3, 3, hh, HAIR)
        rect(d, hx, hy0 - hh + 3, 1, 2, HAIR_L)
    rect(d, hx0 - 2, hy0, HW + 4, 6, HAIR)
    rect(d, hx0 - 2, hy0, HW + 4, 2, HAIR_L)

    # 凹陷的眼窝 + 红瞳
    for ex in (HX - 16, HX + 3):
        rect(d, ex, HY - 9, 13, 11, (52, 68, 40))
        rect(d, ex, HY - 9, 13, 2, SKIN_XD)
        rect(d, ex + 2, HY - 7, 8, 7, (240, 248, 220))
        rect(d, ex + 4, HY - 5, 4, 4, (216, 56, 44))
        rect(d, ex + 5, HY - 4, 2, 2, (255, 140, 120))
    rect(d, HX - 18, HY - 12, 15, 3, SKIN_D)
    rect(d, HX + 2, HY - 12, 15, 3, SKIN_D)
    # 塌陷的鼻子
    rect(d, HX - 3, HY - 1, 5, 5, SKIN_D)
    rect(d, HX - 2, HY + 1, 3, 3, SKIN_XD)
    # 咧开的嘴 + 参差的牙
    rect(d, HX - 15, HY + 8, 30, 9, (40, 20, 24))
    for tx in range(HX - 14, HX + 14, 4):
        rect(d, tx, HY + 8, 3, 4, (238, 236, 214))
    for tx in range(HX - 12, HX + 12, 4):
        rect(d, tx, HY + 13, 3, 4, (238, 236, 214))
    # 脸颊缝合线
    rect(d, HX + 12, HY - 16, 1, 9, SKIN_D)
    for sy in range(HY - 16, HY - 7, 3):
        rect(d, HX + 10, sy, 5, 1, SKIN_D)

    # 肩上的乌鸦
    rect(d, 138, 48, 12, 9, (28, 26, 34))
    rect(d, 147, 44, 6, 6, (28, 26, 34))
    rect(d, 152, 46, 4, 2, (230, 170, 40))
    px(d, 149, 45, (216, 56, 44))
    rect(d, 140, 57, 2, 3, (230, 170, 40))
    rect(d, 145, 57, 2, 3, (230, 170, 40))

    # ------------------------------------------------------------------
    # 石碑：左右边缘逐行抖动 1~2px，避免「完美矩形」的塑料感
    # ------------------------------------------------------------------
    TX, TY, TW, TH = 4, 42, 102, 134
    edge = {}
    for row in range(TH):
        jl = 0 if row < 14 or row % 3 else 1
        jr = 0 if row < 14 or row % 4 else 1
        arc = 0
        if row < 14:
            arc = int(14 - 14 * math.sqrt(max(0.0, 1 - ((13 - row) / 13.0) ** 2)))
        l = TX + arc + jl
        r = TX + TW - arc - jr
        edge[row] = (l, r)
        rect(d, l, TY + row, r - l, 1, STONE)
    for row in range(TH):
        l, r = edge[row]
        rect(d, l, TY + row, 3, 1, STONE_L)
        rect(d, r - 4, TY + row, 4, 1, STONE_D)
    rect(d, TX + 6, TY + TH - 5, TW - 14, 5, STONE_XD)
    # 石面颗粒
    for _ in range(320):
        sx = rnd.randrange(TX + 4, TX + TW - 4)
        sy = rnd.randrange(TY + 16, TY + TH - 4)
        px(d, sx, sy, rnd.choice([STONE_D, STONE_L, STONE, STONE]))
    # 裂纹
    for cx0, cy0, ln in [(18, 66, 16), (86, 104, 13), (30, 158, 10), (70, 60, 9)]:
        for k in range(ln):
            px(d, cx0 + (k % 3) - 1, cy0 + k, STONE_XD)
    # 左下磕掉一角
    for k in range(9):
        rect(d, TX + 1, TY + TH - 12 + k, 9 - k, 1, (0, 0, 0, 0))

    # 内凹刻字区（HTML 三个选项按钮覆盖于此）。
    # 起点必须落在碑首骷髅刻纹「之下」—— 上一版 IY=62 和刻纹重叠，
    # 「开始新游戏」几个字直接糊在骷髅上。
    IX, IY, IW, IH = 14, 74, 82, 88
    rect(d, IX, IY, IW, IH, (114, 114, 124))
    rect(d, IX, IY, IW, 2, STONE_XD)
    rect(d, IX, IY, 2, IH, STONE_XD)
    rect(d, IX + IW - 2, IY, 2, IH, STONE_L)
    rect(d, IX, IY + IH - 2, IW, 2, STONE_L)
    for _ in range(120):
        px(d, rnd.randrange(IX + 2, IX + IW - 2), rnd.randrange(IY + 2, IY + IH - 2),
           rnd.choice([(106, 106, 116), (122, 122, 132)]))

    # 碑首骷髅刻纹：卡在拱形碑首与刻字区之间的那条带子里
    skx, sky = TX + TW // 2 - 2, TY + 20
    rect(d, skx - 6, sky - 6, 12, 9, CARVE)
    rect(d, skx - 4, sky + 3, 8, 3, CARVE)
    rect(d, skx - 4, sky - 4, 3, 3, (150, 150, 160))
    rect(d, skx + 1, sky - 4, 3, 3, (150, 150, 160))
    for k in range(3):
        rect(d, skx - 3 + k * 3, sky + 3, 1, 3, (150, 150, 160))

    # ------------------------------------------------------------------
    # 近侧小臂 + 双手：必须压在石碑之上
    # ------------------------------------------------------------------
    def hand(hx, hy):
        """手掌 + 四根扣住碑面的手指 + 拇指。"""
        rect(d, hx + 6, hy, 12, 14, SKIN)
        rect(d, hx + 6, hy, 12, 2, SKIN_L)
        rect(d, hx + 6, hy + 12, 12, 2, SKIN_D)
        for k in range(4):
            fy = hy + 1 + k * 3
            rect(d, hx, fy, 9, 3, SKIN)
            rect(d, hx, fy, 9, 1, SKIN_L)
            rect(d, hx, fy + 2, 9, 1, SKIN_D)
        rect(d, hx + 12, hy - 4, 6, 6, SKIN)
        rect(d, hx + 12, hy - 4, 6, 1, SKIN_L)

    # 左手：从肩下伸出，扣住石碑右缘中部
    rect(d, 100, 96, 28, 15, SHIRT)
    rect(d, 118, 96, 10, 3, SHIRT_L)      # 高光只留靠肩一小段
    rect(d, 100, 108, 28, 3, SHIRT_D)
    for k in range(100, 128, 3):          # 袖口毛边
        rect(d, k, 110, 2, 2, SHIRT_D)
    rect(d, 94, 100, 12, 12, SKIN)
    hand(84, 102)

    # 右手：绕到下方托住碑底
    rect(d, 104, 152, 30, 15, SHIRT)
    rect(d, 122, 152, 12, 3, SHIRT_L)
    for k in range(104, 134, 3):
        rect(d, k, 166, 2, 2, SHIRT_D)
    rect(d, 98, 156, 12, 12, SKIN)
    hand(74, 158)
    rect(d, 74, 172, 30, 4, SKIN_D)

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'title_zombie.png'))
    print('  title_zombie.png   ', out.size)
    print('     -> 石碑刻字区(占图百分比): left {:.2f}%  top {:.2f}%  width {:.2f}%  height {:.2f}%'
          .format(IX / W * 100, IY / H * 100, IW / W * 100, IH / H * 100))


# ======================================================================
# ④ 左侧记事本
# ======================================================================
def make_notepad():
    """点一下开启「游戏心得」输入界面，所以要画得像一本可以写字的本子。"""
    W, H, SCALE = 96, 124, 4
    img, d = canvas(W, H)

    COVER = (176, 58, 52)
    COVER_D = (128, 38, 34)
    PAPER = (244, 238, 214)
    PAPER_D = (214, 206, 178)
    LINE = (150, 170, 200)

    # 封面（露在纸张下方一圈，像装订好的本子）
    rect(d, 6, 8, 84, 112, COVER_D)
    rect(d, 6, 8, 84, 3, (206, 84, 76))
    # 纸张
    rect(d, 10, 4, 78, 110, PAPER)
    rect(d, 10, 4, 78, 2, (255, 252, 236))
    rect(d, 10, 110, 78, 4, PAPER_D)
    rect(d, 84, 4, 4, 110, PAPER_D)
    # 螺旋线圈（左侧装订）
    for k in range(6, 112, 10):
        rect(d, 4, k, 12, 3, (198, 198, 206))
        rect(d, 4, k, 12, 1, (238, 238, 246))
        rect(d, 9, k - 3, 3, 4, (150, 150, 160))
    # 横线
    for k in range(30, 106, 9):
        rect(d, 16, k, 64, 1, LINE)
    # 红色页边线
    rect(d, 22, 6, 1, 106, (214, 132, 132))

    # 标题「游戏心得」：黑体缩到 11px 再随整图放大 → 自带点阵感
    ttl = pixel_text('游戏心得', 11, (60, 52, 48, 255), spacing=1)
    paste(img, ttl, (W - ttl.width) // 2 + 3, 12)
    d = ImageDraw.Draw(img)
    rect(d, 16, 26, 64, 1, (120, 110, 104))

    # 几行手写涂鸦（示意"已经写过东西"）
    rnd = random.Random(3)
    for k, ly in enumerate(range(30, 100, 9)):
        if k > 4:
            break
        ln = rnd.randrange(26, 60)
        for xx in range(16, 16 + ln, 2):
            rect(d, xx, ly - 3 + (xx % 3 == 0), 2, 1, (92, 84, 110))

    # 铅笔斜搭在本子上
    for k in range(30):
        rect(d, 60 + k // 2, 96 - k, 4, 2, (232, 178, 58))
        rect(d, 60 + k // 2, 96 - k, 1, 2, (250, 210, 110))
    rect(d, 58, 96, 6, 5, (226, 176, 150))     # 笔尖木头
    rect(d, 59, 100, 3, 3, (40, 40, 44))       # 笔芯
    rect(d, 74, 66, 5, 5, (200, 60, 60))       # 橡皮

    # 右上角折角
    for k in range(10):
        rect(d, 88 - k, 4 + k, k, 1, PAPER_D)

    out = upscale(img, SCALE)
    # 轻微倾斜，让它有"随手插在屏幕边"的感觉
    out = out.rotate(-7, resample=NEAREST, expand=True)
    out.save(os.path.join(OUT, 'title_notepad.png'))
    print('  title_notepad.png  ', out.size)


# ======================================================================
# ⑤ 彩蛋：倒挂的蜘蛛侠
# ======================================================================
def make_spider():
    """
    彩蛋：倒挂的蜘蛛侠（Q 版圆头造型）。

    直接按最终朝向（倒挂）作画，不再画完再翻转 —— 翻转法看着省事，
    实际上每根手臂、每条腿的朝向都要在脑子里先倒过来一遍，极易画反。

    Q 版比例：头占整体高度的 40% 左右，四肢短而圆。
    经典姿势：一条腿绷直勾住蛛丝、另一条曲膝外展；一只手在头侧握拳，
    另一只手朝外伸直、比出发射蛛丝的手势。倒挂时头在下方、双臂垂向画面下方。

    画斜向肢体有个坑：如果沿途每一小段都各自描边，段与段的边会叠在肢体
    内部，看着像一截梯子。所以斜向部件一律「先整条描边、再整条填充」两遍走。
    """
    W, H, SCALE = 84, 116, 4
    img, d = canvas(W, H)

    RED = (226, 58, 62)
    RED_D = (176, 34, 42)
    RED_L = (250, 112, 112)
    BLUE = (52, 82, 180)
    BLUE_D = (32, 52, 128)
    BLUE_L = (96, 128, 226)
    OL = (26, 18, 34)
    WEB = (240, 244, 252)

    CX = 40

    def blob(x, y, w, h, fill):
        """带描边的圆角块 —— Q 版造型的基本单元。"""
        rect(d, x - 1, y - 1, w + 2, h + 2, OL)
        rect(d, x, y, w, h, fill)
        for cx0, cy0 in [(x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)]:
            px(d, cx0, cy0, OL)

    def limb(segs, fill, light=None):
        """
        斜向肢体：segs 是一串 (x, y, w, h)。
        先把每一段向外扩 1px 描边画一遍，再整条填充 —— 两遍走才不会出现
        段与段之间的内部描边（那就是「梯子」的由来）。
        """
        for (x, y, w, h) in segs:
            rect(d, x - 1, y - 1, w + 2, h + 2, OL)
        for (x, y, w, h) in segs:
            rect(d, x, y, w, h, fill)
        if light:
            for (x, y, w, h) in segs:
                rect(d, x, y, 2, h, light)

    def ocircle(cx, cy, r, fill):
        circle(d, cx, cy, r + 1, OL)
        circle(d, cx, cy, r, fill)

    # ==================================================================
    # 蛛丝：从画面顶端垂下，勾在绷直那条腿的脚上
    # ==================================================================
    WEB_X = 34
    rect(d, WEB_X - 2, 0, 4, 16, OL)
    rect(d, WEB_X - 1, 0, 2, 16, WEB)
    for k in range(2, 16, 5):
        rect(d, WEB_X - 3, k, 6, 2, WEB)

    # ==================================================================
    # 双腿（倒挂 → 腿在上方）：左腿绷直勾丝，右腿曲膝外展，一静一动
    # ==================================================================
    blob(WEB_X - 4, 16, 9, 30, BLUE)                       # 左腿
    rect(d, WEB_X - 4, 17, 3, 28, BLUE_L)
    blob(WEB_X - 7, 10, 15, 9, RED)                        # 左靴
    rect(d, WEB_X - 6, 11, 13, 2, RED_L)

    limb([(50, 32, 9, 14)] +                               # 右腿：大腿 + 斜小腿
         [(51 + k, 30 - k * 2, 9, 4) for k in range(8)],
         BLUE, BLUE_L)
    blob(56, 10, 15, 9, RED)                               # 右靴
    rect(d, 57, 11, 13, 2, RED_L)

    # ==================================================================
    # 躯干
    # ==================================================================
    blob(29, 42, 22, 22, RED)
    rect(d, 30, 43, 20, 2, RED_L)
    rect(d, 46, 44, 4, 19, RED_D)
    blob(30, 39, 20, 8, BLUE)                              # 蓝色腰胯
    rect(d, 31, 40, 18, 2, BLUE_L)
    for k in range(49, 63, 4):                             # 胸口蛛网
        rect(d, 31, k, 18, 1, RED_D)
    for k in (34, 40, 46):
        rect(d, k, 48, 1, 15, RED_D)
    rect(d, 38, 52, 4, 7, OL)                              # 蜘蛛标志
    for k, ln in [(34, 5), (35, 4), (43, 4), (44, 5)]:
        rect(d, k, 53, 1, ln, OL)
    rect(d, 35, 52, 3, 1, OL)
    rect(d, 42, 52, 3, 1, OL)

    # ==================================================================
    # 上臂：先画，肩关节随后被大头压住 —— Q 版没脖子，全靠头挡
    # ==================================================================
    blob(20, 52, 10, 20, RED)
    rect(d, 21, 53, 3, 18, RED_L)
    limb([(50 + k, 52 + k, 10, 6) for k in range(0, 10, 2)], RED, RED_L)

    # ==================================================================
    # 大脑袋（Q 版的灵魂）
    # ==================================================================
    HX, HY, HR = 40, 84, 21
    ocircle(HX, HY, HR, RED)
    # 高光/背光都收敛一点，避免在小图上糊成两块色斑
    for yy in range(HY - HR, HY + HR + 1):
        for xx in range(HX - HR, HX + HR + 1):
            dd = (xx - HX) ** 2 + (yy - HY) ** 2
            if dd > HR * HR:
                continue
            if (xx - (HX - 7)) ** 2 + (yy - (HY - 9)) ** 2 < 56:
                px(d, xx, yy, RED_L)
            elif dd > (HR - 4) ** 2 and xx > HX + 4 and yy > HY - 6:
                px(d, xx, yy, RED_D)

    # 面罩蛛网：经线只留 3 条、纬线 2 条，密了在小尺寸上会糊成一团
    for k in (-11, 0, 11):
        for yy in range(HY - HR, HY + HR + 1):
            if (yy - HY) ** 2 + k * k <= (HR - 2) ** 2:
                px(d, HX + k, yy, RED_D)
    for ry in (HY - 11, HY + 9):
        for xx in range(HX - HR, HX + HR + 1):
            if (xx - HX) ** 2 + (ry - HY) ** 2 <= (HR - 2) ** 2:
                px(d, xx, ry, RED_D)

    # ---- 标志性的大白眼 ----
    # 前两版分别画成了向下的尖三角（像獠牙）和两坨圆白饼，都不对。
    # 蜘蛛侠面罩的招牌是「尖角杏眼」：外侧圆钝、内侧收成一个尖角。
    # 这个形状用数学曲线拟合总是差口气，索性手写点阵掩膜逐像素定死。
    #
    # 下面这张是**右眼**、且已经按倒挂的朝向画好 —— 尖角在左上（内上方），
    # 正着看时就是经典的向内下方收尖。左眼直接水平镜像。
    EYE_MASK = [
        "........111.....",
        "......1111111...",
        ".....111111111..",
        "....11111111111.",
        "...111111111111.",
        "..1111111111111.",
        ".11111111111111.",
        "111111111111111.",
        "1111111111111111",
        "1111111111111111",
        ".111111111111111",
        "..11111111111111",
        "...11111111111..",
        ".....111111111..",
        ".......11111....",
    ]
    EW, EH = len(EYE_MASK[0]), len(EYE_MASK)

    for sgn in (-1, 1):
        ex0 = HX + sgn * 9 - EW // 2
        ey0 = HY - EH // 2
        # 左眼是右眼的水平镜像
        mask = EYE_MASK if sgn > 0 else [row[::-1] for row in EYE_MASK]
        cells = {(c, r) for r in range(EH) for c in range(EW) if mask[r][c] == '1'}

        # 先描边：凡是空格但四邻有实心的位置，全部填成描边色。
        # 整体膨胀一圈再填内部，边才会严丝合缝地贴着这个不规则轮廓。
        for r in range(-1, EH + 1):
            for c in range(-1, EW + 1):
                if (c, r) in cells:
                    continue
                if any((c + dc, r + dr) in cells for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px(d, ex0 + c, ey0 + r, OL)
        # 再填白
        for (c, r) in cells:
            px(d, ex0 + c, ey0 + r, (255, 255, 255))
        # 反光：靠外侧下缘压一层冷灰，眼睛才有厚度而不是一块死白
        for (c, r) in cells:
            if r >= EH - 5 and (c > EW * 0.45 if sgn > 0 else c < EW * 0.55):
                px(d, ex0 + c, ey0 + r, (198, 208, 230))

    # ==================================================================
    # 前臂 + 双手：画在头之后 → 手垂在脸的两侧
    # ==================================================================
    # 左手：握拳收在头侧
    blob(14, 70, 10, 18, RED)
    rect(d, 15, 71, 3, 16, RED_L)
    ocircle(18, 93, 7, BLUE)
    circle(d, 15, 90, 3, BLUE_L)
    for k in range(3):
        rect(d, 14 + k * 3, 96, 2, 2, BLUE_D)

    # 右手：伸直外展，比出发射蛛丝的手势
    limb([(60 + k, 62 + k * 2, 9, 5) for k in range(9)], RED, RED_L)
    blob(68, 82, 12, 12, BLUE)                       # 手掌
    rect(d, 69, 83, 3, 10, BLUE_L)
    # 食指与小指伸出、中间两指收拢 —— 就是那个发射手势
    for fx in (69, 76):
        blob(fx, 93, 4, 8, BLUE)
        rect(d, fx, 94, 1, 6, BLUE_L)
    rect(d, 73, 93, 3, 4, BLUE_D)                    # 收拢的中指 / 无名指
    blob(65, 85, 4, 6, BLUE)                         # 拇指
    # 手心射出的一小簇蛛丝，点明这是「发射」而不是随便张开手
    for k in range(4):
        rect(d, 73 - k, 104 + k * 3, 2, 2, WEB)

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'title_spider.png'))
    print('  title_spider.png   ', out.size)


# ======================================================================
# ⑥ 坠落中的陨石（游戏内天灾用）
# ======================================================================
def make_meteor():
    """
    坠落中的陨石：一块烧红的岩石 + 拖在身后的火尾。

    做成横向 3 帧的循环，帧间只改火焰的形状和亮度 —— 岩石本体保持不动。
    火焰是这个东西唯一在动的部分，岩石跟着抖只会显得廉价。

    贴图整体朝**右下**（火尾在左上），因为游戏里陨石是从左上方斜着砸下来的；
    render 那边只要按这个朝向画，不用再做旋转。
    """
    FW, FH, FRAMES, SCALE = 30, 30, 3, 4
    img, d = canvas(FW * FRAMES, FH)

    ROCK = (86, 74, 70)
    ROCK_D = (54, 46, 44)
    ROCK_L = (122, 106, 100)
    HOT = (208, 96, 40)          # 迎风面被烧红
    HOT_L = (255, 168, 72)
    FLAME1 = (255, 96, 32)
    FLAME2 = (255, 176, 56)
    FLAME3 = (255, 232, 150)
    OL = (26, 18, 20)

    for f in range(FRAMES):
        ox = f * FW

        # ---------- 火尾：从岩石左上方甩出去 ----------
        # 逐帧改变舌头的长度与摆动，让火看起来在燃烧而不是贴了张纸
        for i in range(14):
            t = i / 13.0
            wob = math.sin(t * 3.0 + f * 2.1) * 2.2
            fx = ox + 17 - int(t * 17) + int(wob)
            fy = 17 - int(t * 16) + int(wob * 0.6)
            w = max(1, int(7 - t * 5))
            # 外焰 → 中焰 → 焰心，三层依次收窄
            rect(d, fx - w // 2, fy - w // 2, w, w, FLAME1)
            if t < 0.72:
                w2 = max(1, w - 2)
                rect(d, fx - w2 // 2, fy - w2 // 2, w2, w2, FLAME2)
            if t < 0.4:
                rect(d, fx - 1, fy - 1, 2, 2, FLAME3)
        # 甩出去的火星
        for k in range(4):
            sx = ox + 6 - k * 2 + ((f + k) % 3)
            sy = 6 - k * 2 + ((f * 2 + k) % 3)
            rect(d, sx, sy, 2, 2, FLAME2 if k % 2 else FLAME3)

        # ---------- 岩石本体：不规则多边形，别画成圆球 ----------
        body = [
            (14, 10, 10, 4), (12, 13, 14, 4), (11, 16, 16, 4),
            (12, 19, 14, 4), (14, 22, 10, 3),
        ]
        for (bx, by, bw, bh) in body:
            rect(d, ox + bx - 1, by - 1, bw + 2, bh + 2, OL)
        for (bx, by, bw, bh) in body:
            rect(d, ox + bx, by, bw, bh, ROCK)

        # 迎风面（左上）被烧红，背风面留暗 —— 一眼看出运动方向
        rect(d, ox + 12, 13, 5, 3, HOT)
        rect(d, ox + 11, 16, 5, 3, HOT)
        rect(d, ox + 12, 12, 4, 2, HOT_L)
        rect(d, ox + 22, 17, 4, 6, ROCK_D)
        rect(d, ox + 20, 21, 5, 3, ROCK_D)

        # 陨石坑纹理（岩石上的凹坑），固定不动
        for (cx0, cy0, cr) in [(17, 15, 2), (20, 19, 2), (15, 20, 1)]:
            circle(d, ox + cx0, cy0, cr, ROCK_D)
            px(d, ox + cx0 - 1, cy0 - 1, ROCK_L)

        # 底部高光棱线
        rect(d, ox + 15, 22, 6, 1, ROCK_L)

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'meteor.png'))
    print('  meteor.png         ', out.size, ' 单帧 {}x{} ×{} 帧'.format(FW, FH, FRAMES))


# ======================================================================
# ⑦ 整张世界背景图（游戏内）
# ======================================================================
def make_world_bg():
    """
    整张世界背景图（960×720，正好铺满画布）。

    原先天空和坑腔各自拉伸同一张 hills_bg：天空按 6.67:1、坑腔按 1.33:1，
    同一张图两种形变，从坑里看出去和地面上的景完全接不上。
    现在改成一张按画布尺寸设计的整图，两处用同一个铺法，缝就自然消失了。

    上下两段各有各的用途：
      y 0~144    地表以上：天空 + 远山，玩家一直看得见
      y 144~720  地表以下：地层剖面，只有天灾砸出坑洞时才会露出来
    所以下半段不能画成「地下的天空」，得是越深越暗的土石层，
    透过坑看进去才像是在看地底，而不是看穿了一个洞。
    """
    W_, H_, SCALE = 240, 180, 4
    SKY_H = 36                        # 144 / 4，与游戏里的 GROUND_Y 对齐
    img, d = canvas(W_, H_)
    rnd = random.Random(20260905)

    # ================= 天空 =================
    vgrad(d, 0, 0, W_, SKY_H, (108, 178, 222), (196, 232, 246), bands=10)

    # 远山：三层，越远越淡越高，制造纵深
    def ridge(base_y, amp, col, seed, step):
        rr = random.Random(seed)
        pts, x, yv = [], -4, base_y
        while x < W_ + 8:
            pts.append((x, yv))
            yv = base_y - rr.randrange(0, amp)
            x += step
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            for xx in range(x0, x1):
                if not (0 <= xx < W_):
                    continue
                t = (xx - x0) / max(1, x1 - x0)
                yy = int(y0 + (y1 - y0) * t)
                rect(d, xx, yy, 1, base_y - yy + 20, col)

    ridge(SKY_H - 10, 9, (150, 196, 190), 3, 11)      # 最远，偏灰绿
    ridge(SKY_H - 6, 7, (108, 172, 132), 7, 8)
    ridge(SKY_H - 2, 5, (74, 140, 92), 11, 6)         # 最近，偏实

    # 山坡上的小树点缀
    for _ in range(26):
        tx = rnd.randrange(W_)
        ty = SKY_H - 4 - rnd.randrange(0, 5)
        rect(d, tx, ty, 1, 3, (44, 96, 62))
        rect(d, tx - 1, ty - 2, 3, 2, (56, 116, 74))

    # ================= 地层剖面 =================
    # 一层层不同色调的土石，越深越暗；这是透过坑洞看进去时的景
    strata = [
        (SKY_H, 14, (122, 82, 44)),        # 表层壤土
        (SKY_H + 14, 18, (104, 68, 36)),
        (SKY_H + 32, 22, (88, 58, 32)),
        (SKY_H + 54, 26, (72, 48, 28)),
        (SKY_H + 80, 30, (58, 40, 24)),
        (SKY_H + 110, 34, (44, 30, 20)),   # 深处
    ]
    for (y0, h, c) in strata:
        rect(d, 0, y0, W_, h, c)
        # 层与层之间压一条稍暗的界线，剖面才有「分层」的读感
        rect(d, 0, y0, W_, 1, tuple(max(0, v - 14) for v in c))
    # 补到底
    rect(d, 0, SKY_H + 144, W_, H_ - SKY_H - 144, (34, 24, 16))

    # 颗粒噪点：每层都撒一点，避免大色块显得像塑料
    for _ in range(2600):
        gx = rnd.randrange(W_)
        gy = rnd.randrange(SKY_H, H_)
        base = 1 - (gy - SKY_H) / (H_ - SKY_H)
        v = int(18 * base) + 6
        px(d, gx, gy, (v + 30, v + 18, v + 8) if rnd.random() < 0.6 else (v + 8, v + 5, v + 2))

    # 嵌在土里的石块，越深越多越大
    for _ in range(120):
        sx = rnd.randrange(2, W_ - 6)
        sy = rnd.randrange(SKY_H + 4, H_ - 4)
        deep = (sy - SKY_H) / (H_ - SKY_H)
        sw = 2 + int(rnd.random() * (2 + deep * 4))
        sh = max(1, sw - 1)
        base = (96, 92, 88) if rnd.random() < 0.55 else (76, 66, 60)
        shade = tuple(int(v * (1 - deep * 0.45)) for v in base)
        rect(d, sx, sy, sw, sh, shade)
        rect(d, sx, sy, sw, 1, tuple(min(255, v + 22) for v in shade))

    # 表层往下扎的根须 —— 只在最上面两层，交代「这是地表底下」
    for _ in range(40):
        rx = rnd.randrange(W_)
        ln = 4 + rnd.randrange(10)
        for k in range(ln):
            px(d, rx + (0 if k % 3 else (1 if rnd.random() < 0.5 else -1)),
               SKY_H + k, (62, 46, 24))

    # 深处的矿脉：几条斜向的浅色条带，给深层一点看头
    for _ in range(7):
        vx = rnd.randrange(W_)
        vy = rnd.randrange(SKY_H + 60, H_ - 20)
        for k in range(rnd.randrange(8, 22)):
            rect(d, vx + k, vy + k // 2, 2, 2, (120, 104, 72))
            px(d, vx + k, vy + k // 2, (156, 138, 96))

    out = upscale(img, SCALE)
    out.save(os.path.join(OUT, 'world_bg.png'))
    print('  world_bg.png       ', out.size, '（天空 0~{}px，地层 {}~{}px）'
          .format(SKY_H * SCALE, SKY_H * SCALE, H_ * SCALE))


# ======================================================================
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('生成标题界面美术资源 ...')
    make_background()
    make_logo()
    make_zombie_tablet()
    make_notepad()
    make_spider()
    make_meteor()
    make_world_bg()
    print('完成。')
