# -*- coding: utf-8 -*-
"""
========================================================================
 8-BIT 地牢求生 —— 角色精灵图生成器（玩家 / 丧尸）
========================================================================
 与标题美术不同，角色贴图**按 1:1 原尺寸生成，绝不放大**：
 游戏里 drawImage 就是按这个尺寸绘制的，先放大再缩回去必然糊边。

 每张图是横向排开的 4 帧，顺序固定：
     0 = idle      待机
     1 = walk A    迈左腿
     2 = walk B    迈右腿
     3 = attack    攻击

 走路用 A → idle → B → idle 的四拍循环（见 render.js），
 比 A→B 两拍多一个「双脚并拢」的过渡，动起来不会像螃蟹横move。

 两条几何红线（上一版就是栽在这上面）：
   · 攻击帧必须完整落在帧宽内 —— 剑/手臂伸出去多远，帧就得留多宽
   · 角色主体必须落在帧的水平中心 —— render 是按中心对齐画的，
     主体偏了，角色的脚就会离开它该站的位置

 产出：
   assets/player_sprite.png   40×37 ×4 帧
   assets/zombie_sprite.png   44×43 ×4 帧
   assets/soldier_sprite.png  50×37 ×4 帧

 运行：python make_char_sprites.py
========================================================================
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets')

OUTLINE = (24, 18, 28, 255)


# ======================================================================
# 工具
# ======================================================================
def rect(d, x, y, w, h, col):
    if w <= 0 or h <= 0:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col)


def bordered(d, x, y, w, h, fill, ol=(30, 24, 34)):
    """
    带自绘边框的块。auto_outline 只描外轮廓，
    两条同色手臂叠在一起时内部会糊成一片 —— 那种地方必须手动画边。
    """
    rect(d, x, y, w, h, ol)
    rect(d, x + 1, y + 1, w - 2, h - 2, fill)


def auto_outline(img, col=OUTLINE):
    """
    自动描边：凡「自身透明、四邻有实体像素」的点一律填成描边色。
    像素画里角色能不能从背景中跳出来，全靠这一圈边。
    """
    w, h = img.size
    px = img.load()
    edges = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 0:
                    edges.append((x, y))
                    break
    for x, y in edges:
        px[x, y] = col
    return img


def assert_inside(img, name, kind):
    """守住那条红线：任何一帧都不许把内容画出帧外（画出去就是被裁）。"""
    bbox = img.getbbox()
    if bbox is None:
        return
    if bbox[0] < 0 or bbox[1] < 0 or bbox[2] > img.width or bbox[3] > img.height:
        raise SystemExit('[{}/{}] 内容超出帧边界: {}'.format(name, kind, bbox))
    # 贴到左右边即视为被裁（auto_outline 还要再向外扩 1px）。
    # 底边不算——脚底本来就该压在帧底，那里不需要描边。
    if bbox[2] >= img.width:
        print('  ! 警告 [{}/{}] 右侧贴边 {}，描边会被切掉'.format(name, kind, bbox))
    if bbox[3] > img.height - 1:
        print('  ! 警告 [{}/{}] 底部溢出 {}'.format(name, kind, bbox))


# ======================================================================
# 玩家：36×36 ×4 帧
# ======================================================================
FW_P, FH_P = 40, 37
CX_P = 15                     # 锚点：主体中心在帧内的 x（render 按它对齐，不是按帧中心）

SKIN = (245, 203, 167)
SKIN_D = (206, 158, 122)
HAIR = (96, 66, 34)
HAIR_L = (132, 94, 50)
TUNIC = (46, 204, 113)
TUNIC_D = (30, 132, 73)
TUNIC_L = (94, 226, 148)
PANTS = (58, 68, 92)
PANTS_D = (38, 46, 66)
BOOT = (112, 72, 38)
BOOT_D = (78, 50, 26)
BELT = (120, 80, 40)
GOLD = (255, 208, 64)
BLADE = (214, 220, 232)
BLADE_D = (148, 156, 176)
HILT = (150, 110, 40)


def player_frame(kind):
    """kind: 'idle' | 'walkA' | 'walkB' | 'attack'"""
    img = Image.new('RGBA', (FW_P, FH_P), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    CX = CX_P

    # 走路帧整体压低 1px，待机/攻击不压 —— 四帧连起来就有了起伏
    bob = 1 if kind in ('walkA', 'walkB') else 0
    y0 = bob

    # ---------- 腿（步幅拉大，走起来才看得出在迈腿）----------
    if kind == 'walkA':                       # 左腿前迈、右腿后蹬
        rect(d, CX - 8, 27, 5, 7, PANTS)
        rect(d, CX + 2, 27, 5, 6, PANTS_D)
        rect(d, CX - 10, 33, 8, 3, BOOT)
        rect(d, CX + 3, 32, 7, 3, BOOT_D)
    elif kind == 'walkB':                     # 反相
        rect(d, CX - 7, 27, 5, 6, PANTS_D)
        rect(d, CX + 3, 27, 5, 7, PANTS)
        rect(d, CX - 9, 32, 7, 3, BOOT_D)
        rect(d, CX + 2, 33, 8, 3, BOOT)
    else:                                     # 双脚并拢
        rect(d, CX - 5, 27, 4, 7, PANTS)
        rect(d, CX + 1, 27, 4, 7, PANTS)
        rect(d, CX - 6, 33, 6, 3, BOOT)
        rect(d, CX + 1, 33, 6, 3, BOOT)
        rect(d, CX - 6, 35, 6, 1, BOOT_D)
        rect(d, CX + 1, 35, 6, 1, BOOT_D)

    # ---------- 后手（先画，被躯干压住 = 在身后）----------
    swing = {'idle': 0, 'walkA': -2, 'walkB': 2, 'attack': 3}[kind]
    rect(d, CX - 9, 18 + y0 - swing, 4, 8, TUNIC_D)
    rect(d, CX - 9, 25 + y0 - swing, 4, 3, SKIN)

    # ---------- 躯干（绿色束腰外衣）----------
    rect(d, CX - 6, 15 + y0, 13, 12, TUNIC)
    rect(d, CX - 6, 15 + y0, 13, 2, TUNIC_L)        # 肩部受光
    rect(d, CX + 4, 16 + y0, 3, 11, TUNIC_D)        # 背光侧
    rect(d, CX - 6, 24 + y0, 13, 2, BELT)           # 腰带
    rect(d, CX - 1, 24 + y0, 3, 2, GOLD)            # 带扣
    rect(d, CX - 6, 26 + y0, 13, 1, TUNIC_D)        # 下摆阴影

    # ---------- 头 ----------
    rect(d, CX - 5, 5 + y0, 11, 10, SKIN)
    rect(d, CX + 3, 6 + y0, 3, 9, SKIN_D)           # 侧脸阴影
    rect(d, CX - 5, 14 + y0, 11, 1, SKIN_D)         # 下巴
    rect(d, CX - 6, 2 + y0, 13, 4, HAIR)            # 头发
    rect(d, CX - 6, 2 + y0, 13, 1, HAIR_L)
    rect(d, CX - 6, 5 + y0, 2, 4, HAIR)             # 鬓角
    rect(d, CX + 5, 5 + y0, 2, 3, HAIR)
    for ex in (CX - 3, CX + 2):                     # 眼睛
        rect(d, ex, 9 + y0, 2, 3, (32, 40, 56))
        rect(d, ex, 9 + y0, 1, 1, (255, 255, 255))

    # ---------- 前手 + 剑 ----------
    if kind == 'attack':
        # 向右下方的斜劈：剑必须明显比走路帧伸得远，打击感才够
        rect(d, CX + 6, 17 + y0, 6, 4, SKIN)                 # 伸出的手臂
        rect(d, CX + 6, 17 + y0, 6, 1, (255, 232, 210))
        rect(d, CX + 11, 16 + y0, 3, 6, HILT)                # 护手
        rect(d, CX + 12, 18 + y0, 2, 2, GOLD)
        for k in range(8):                                   # 斜向剑身
            rect(d, CX + 13 + k, 18 + y0 + k // 2, 2, 3, BLADE)
            rect(d, CX + 13 + k, 20 + y0 + k // 2, 2, 1, BLADE_D)
        rect(d, CX + 16, 15 + y0, 2, 2, (255, 255, 255))     # 挥砍残影
        rect(d, CX + 14, 13 + y0, 2, 2, (255, 255, 255, 160))
    else:
        sw = {'idle': 0, 'walkA': -1, 'walkB': 1}[kind]
        rect(d, CX + 6, 17 + y0 + sw, 3, 8, TUNIC_D)         # 前臂
        rect(d, CX + 6, 24 + y0 + sw, 3, 3, SKIN)
        rect(d, CX + 6, 21 + y0 + sw, 4, 2, HILT)            # 护手
        rect(d, CX + 7, 12 + y0 + sw, 2, 10, BLADE)          # 竖在身侧的剑
        rect(d, CX + 7, 12 + y0 + sw, 1, 10, BLADE_D)
        rect(d, CX + 7, 11 + y0 + sw, 2, 1, (255, 255, 255))

    return img


# ======================================================================
# 丧尸：40×42 ×4 帧
# ======================================================================
FW_Z, FH_Z = 44, 43
CX_Z = 15                     # 锚点：主体中心在帧内的 x。丧尸双臂前伸，帧必然右宽左窄，
                              # 所以绝不能按帧中心对齐 —— 那样丧尸会整体左飘

ZSKIN = (122, 168, 92)
ZSKIN_D = (86, 124, 62)
ZSKIN_L = (152, 196, 118)
ZSKIN_XD = (60, 90, 44)
ZSHIRT = (92, 100, 122)
ZSHIRT_D = (58, 64, 82)
ZSHIRT_L = (120, 128, 150)
ZPANTS = (78, 62, 54)
ZPANTS_D = (54, 42, 36)
ZHAIR = (46, 40, 52)
BLOOD = (150, 40, 40)
TOOTH = (238, 236, 214)


def zombie_frame(kind):
    """kind: 'idle' | 'walkA' | 'walkB' | 'attack'"""
    img = Image.new('RGBA', (FW_Z, FH_Z), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    CX = CX_Z
    lean = 1 if kind == 'attack' else 0       # 攻击时上半身前倾

    # ---------- 远侧手臂：先画、位置更低更暗，形成前后关系 ----------
    if kind == 'attack':
        far_reach, far_y = 8, 26
    elif kind == 'idle':
        far_reach, far_y = 5, 27
    else:
        far_reach, far_y = 6, 27
    fax = CX + 6 + lean
    bordered(d, fax, far_y, far_reach + 2, 5, ZSHIRT_D)          # 袖
    bordered(d, fax + far_reach + 1, far_y, 6, 5, ZSKIN_D)       # 小臂
    bordered(d, fax + far_reach + 6, far_y - 1, 4, 6, ZSKIN_D)   # 手

    # ---------- 腿（拖着走，步幅比玩家小）----------
    if kind == 'walkA':
        rect(d, CX - 6, 31, 5, 8, ZPANTS)
        rect(d, CX + 1, 31, 5, 7, ZPANTS_D)
        rect(d, CX - 8, 38, 7, 3, (40, 34, 30))
        rect(d, CX + 1, 37, 6, 3, (30, 26, 24))
    elif kind == 'walkB':
        rect(d, CX - 5, 31, 5, 7, ZPANTS_D)
        rect(d, CX + 2, 31, 5, 8, ZPANTS)
        rect(d, CX - 6, 37, 6, 3, (30, 26, 24))
        rect(d, CX + 1, 38, 7, 3, (40, 34, 30))
    else:
        rect(d, CX - 5, 31, 5, 8, ZPANTS)
        rect(d, CX + 1, 31, 5, 8, ZPANTS)
        rect(d, CX - 6, 39, 6, 3, (40, 34, 30))
        rect(d, CX + 1, 39, 6, 3, (40, 34, 30))
    rect(d, CX - 4, 36, 3, 2, ZSKIN_XD)                          # 裤腿破口

    # ---------- 躯干（破烂衬衫）----------
    tx = CX - 6 + lean
    rect(d, tx, 18, 13, 14, ZSHIRT)
    rect(d, tx, 18, 13, 2, ZSHIRT_L)
    rect(d, tx + 10, 19, 3, 13, ZSHIRT_D)
    for hx, hy, hw, hh in [(tx + 2, 23, 4, 3), (tx + 7, 28, 3, 3)]:
        rect(d, hx - 1, hy - 1, hw + 2, hh + 2, (40, 44, 58))    # 破洞暗边
        rect(d, hx, hy, hw, hh, ZSKIN_XD)                        # 透出的皮肤
    rect(d, tx, 31, 13, 1, ZSHIRT_D)
    for k in range(0, 13, 3):                                    # 撕烂的下摆
        rect(d, tx + k, 32, 2, 1, ZSHIRT_D)

    # ---------- 头 ----------
    hx0 = CX - 6 + lean
    rect(d, hx0, 6, 13, 12, ZSKIN)
    rect(d, hx0, 6, 13, 2, ZSKIN_L)
    rect(d, hx0 + 10, 7, 3, 11, ZSKIN_D)
    rect(d, hx0 - 1, 11, 2, 4, ZSKIN_D)                          # 耳
    rect(d, hx0 - 1, 3, 15, 4, ZHAIR)                            # 乱发
    for k in range(-1, 14, 3):
        rect(d, hx0 + k, 2, 2, 2, ZHAIR)
    for ex in (hx0 + 2, hx0 + 8):                                # 凹陷的眼窝
        rect(d, ex, 9, 4, 4, (52, 68, 40))
        rect(d, ex + 1, 10, 3, 3, (240, 248, 220))
        rect(d, ex + 2, 11, 2, 2, (216, 56, 44))
    if kind == 'attack':                                         # 张到最大的嘴
        rect(d, hx0 + 2, 14, 9, 4, (40, 20, 24))
        for k in range(0, 9, 2):
            rect(d, hx0 + 2 + k, 14, 1, 2, TOOTH)
            rect(d, hx0 + 3 + k, 16, 1, 2, TOOTH)
        rect(d, hx0 + 4, 18, 3, 2, BLOOD)                        # 淌下的血
    else:
        rect(d, hx0 + 3, 15, 7, 2, (40, 20, 24))
        rect(d, hx0 + 4, 15, 1, 1, TOOTH)
        rect(d, hx0 + 7, 15, 1, 1, TOOTH)
    rect(d, hx0 + 9, 6, 1, 4, ZSKIN_D)                           # 缝合线

    # ---------- 近侧手臂：经典的向前平举 ----------
    if kind == 'attack':
        reach, ay = 9, 19                # 扑击时探得最长、抬得最高
    elif kind == 'walkA':
        reach, ay = 6, 20
    elif kind == 'walkB':
        reach, ay = 6, 22
    else:
        reach, ay = 5, 21
    ax = CX + 6 + lean
    bordered(d, ax, ay, reach + 2, 6, ZSHIRT)                    # 袖
    rect(d, ax + 1, ay + 1, reach, 1, ZSHIRT_L)
    bordered(d, ax + reach + 1, ay, 6, 6, ZSKIN)                 # 小臂
    rect(d, ax + reach + 2, ay + 1, 4, 1, ZSKIN_L)
    bordered(d, ax + reach + 6, ay - 1, 5, 8, ZSKIN)             # 手掌
    for k in range(3):                                           # 抓挠的手指
        rect(d, ax + reach + 9, ay + k * 2, 1, 1, ZSKIN_XD)

    return img


# ======================================================================
# 士兵：44×37 ×4 帧
# ======================================================================
# 原来的 soldier_sprite.png 是一张 1680×2240 的大图（不是精灵图），
# 被硬压进 34×60 来画 —— 既糊，又比玩家高出一大截，三个角色完全不成比例。
# 这里按和玩家、丧尸同一套标准重画：同样的 1:1 尺寸、同样的四帧、同样的锚点。
FW_S, FH_S = 50, 37   # 帧宽要容得下开火帧的枪口焰，不然描边会被切掉
CX_S = 15                     # 锚点：主体中心。步枪朝右伸出，帧同样是右宽左窄

UNI = (58, 122, 180)          # 军服
UNI_D = (36, 82, 130)
UNI_L = (98, 164, 216)
HELM = (74, 92, 74)           # 钢盔
HELM_D = (50, 66, 50)
HELM_L = (104, 126, 100)
GUN = (72, 68, 76)
GUN_D = (44, 42, 50)
GUN_L = (110, 106, 116)
STOCK = (112, 74, 40)         # 枪托木质
FLASH = (255, 224, 120)


def soldier_frame(kind):
    """kind: 'idle' | 'walkA' | 'walkB' | 'attack'（attack = 开火）"""
    img = Image.new('RGBA', (FW_S, FH_S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    CX = CX_S
    bob = 1 if kind in ('walkA', 'walkB') else 0
    y0 = bob

    # ---------- 腿 ----------
    if kind == 'walkA':
        rect(d, CX - 8, 27, 5, 7, UNI_D)
        rect(d, CX + 2, 27, 5, 6, UNI_D)
        rect(d, CX - 10, 33, 8, 3, (52, 44, 40))
        rect(d, CX + 3, 32, 7, 3, (38, 32, 30))
    elif kind == 'walkB':
        rect(d, CX - 7, 27, 5, 6, UNI_D)
        rect(d, CX + 3, 27, 5, 7, UNI_D)
        rect(d, CX - 9, 32, 7, 3, (38, 32, 30))
        rect(d, CX + 2, 33, 8, 3, (52, 44, 40))
    else:
        rect(d, CX - 5, 27, 4, 7, UNI_D)
        rect(d, CX + 1, 27, 4, 7, UNI_D)
        rect(d, CX - 6, 33, 6, 3, (52, 44, 40))
        rect(d, CX + 1, 33, 6, 3, (52, 44, 40))

    # ---------- 躯干 ----------
    rect(d, CX - 6, 15 + y0, 13, 12, UNI)
    rect(d, CX - 6, 15 + y0, 13, 2, UNI_L)
    rect(d, CX + 4, 16 + y0, 3, 11, UNI_D)
    rect(d, CX - 6, 23 + y0, 13, 2, (66, 54, 40))          # 武装带
    rect(d, CX - 1, 23 + y0, 3, 2, (198, 168, 90))         # 带扣
    rect(d, CX - 7, 16 + y0, 2, 8, UNI_D)                  # 肩带
    rect(d, CX + 1, 17 + y0, 2, 6, (66, 54, 40))

    # ---------- 头 + 钢盔 ----------
    rect(d, CX - 4, 7 + y0, 9, 8, (245, 203, 167))         # 脸
    rect(d, CX + 2, 8 + y0, 3, 7, (206, 158, 122))
    rect(d, CX - 4, 14 + y0, 9, 1, (206, 158, 122))
    rect(d, CX - 2, 10 + y0, 2, 2, (32, 40, 56))           # 眼
    rect(d, CX + 2, 10 + y0, 2, 2, (32, 40, 56))
    # 钢盔：一顶带帽檐的圆顶盔，是士兵最好认的剪影特征
    rect(d, CX - 6, 3 + y0, 13, 5, HELM)
    rect(d, CX - 5, 1 + y0, 11, 3, HELM)
    rect(d, CX - 5, 1 + y0, 11, 1, HELM_L)
    rect(d, CX - 7, 7 + y0, 15, 2, HELM_D)                 # 帽檐
    rect(d, CX + 4, 3 + y0, 3, 5, HELM_D)

    # ---------- 步枪 + 双手 ----------
    gy = 18 + y0 + (0 if kind == 'attack' else 1)          # 开火时端平
    rect(d, CX - 8, 18 + y0, 4, 7, UNI)                    # 后手（托枪托）
    rect(d, CX - 8, 24 + y0, 4, 3, (245, 203, 167))
    rect(d, CX + 5, gy - 1, 6, 5, UNI)                     # 前手
    rect(d, CX + 9, gy, 4, 4, (245, 203, 167))

    rect(d, CX + 2, gy + 1, 7, 4, STOCK)                   # 枪托
    rect(d, CX + 2, gy + 1, 7, 1, (146, 100, 56))
    rect(d, CX + 9, gy, 16, 4, GUN)                        # 机匣 + 枪管
    rect(d, CX + 9, gy, 16, 1, GUN_L)
    rect(d, CX + 9, gy + 3, 16, 1, GUN_D)
    rect(d, CX + 22, gy + 1, 5, 2, GUN_D)                  # 枪口
    rect(d, CX + 11, gy + 4, 3, 3, GUN_D)                  # 弹匣
    rect(d, CX + 14, gy - 2, 2, 2, GUN_L)                  # 准星

    if kind == 'attack':
        # 枪口焰：开火帧必须一眼看出在开火
        rect(d, CX + 27, gy, 4, 4, FLASH)
        rect(d, CX + 27, gy + 1, 6, 2, FLASH)
        rect(d, CX + 31, gy + 1, 2, 2, (255, 255, 255))
        rect(d, CX + 26, gy - 2, 2, 2, (255, 176, 72))
        rect(d, CX + 26, gy + 4, 2, 2, (255, 176, 72))

    return img


# ======================================================================
def build_sheet(fn, frames, fw, fh, path, name):
    sheet = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, kind in enumerate(frames):
        f = fn(kind)
        assert_inside(f, name, kind)
        sheet.alpha_composite(auto_outline(f), (i * fw, 0))
    sheet.save(path)
    return sheet


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    order = ['idle', 'walkA', 'walkB', 'attack']
    print('生成角色精灵图 ...')

    p = build_sheet(player_frame, order, FW_P, FH_P,
                    os.path.join(OUT, 'player_sprite.png'), 'player')
    print('  player_sprite.png  ', p.size, ' 单帧 {}x{} ×{} 帧'.format(FW_P, FH_P, len(order)))

    z = build_sheet(zombie_frame, order, FW_Z, FH_Z,
                    os.path.join(OUT, 'zombie_sprite.png'), 'zombie')
    print('  zombie_sprite.png  ', z.size, ' 单帧 {}x{} ×{} 帧'.format(FW_Z, FH_Z, len(order)))

    sd = build_sheet(soldier_frame, order, FW_S, FH_S,
                     os.path.join(OUT, 'soldier_sprite.png'), 'soldier')
    print('  soldier_sprite.png ', sd.size, ' 单帧 {}x{} ×{} 帧'.format(FW_S, FH_S, len(order)))

    # 放大 6 倍另存一份，纯粹方便肉眼检查像素有没有画错。
    # 放在 preview/ 而不是 assets/：它们不是游戏资源，也不该被部署出去。
    prev = os.path.join(HERE, 'preview')
    os.makedirs(prev, exist_ok=True)
    for name, im in (('player', p), ('zombie', z), ('soldier', sd)):
        im.resize((im.width * 6, im.height * 6), Image.NEAREST).save(
            os.path.join(prev, '{}.png'.format(name)))
    print('')
    print('  render.js 需要的锚点常量：')
    print('    PLAYER_SPRITE = {{ frames: 4, fw: {}, fh: {}, anchorX: {} }}'.format(FW_P, FH_P, CX_P))
    print('    ZOMBIE_SPRITE = {{ frames: 4, fw: {}, fh: {}, anchorX: {} }}'.format(FW_Z, FH_Z, CX_Z))
    print('    SOLDIER_SPRITE = {{ frames: 4, fw: {}, fh: {}, anchorX: {} }}'.format(FW_S, FH_S, CX_S))
    print('')
    print('  （放大预览已输出到 preview/，不参与游戏加载、不进版本库）')
    print('完成。')
