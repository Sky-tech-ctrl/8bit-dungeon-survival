"""
经典 NES 8-bit 风格角色精灵图生成器（3 张角色，各 3 帧）
特征：严格有限调色板 / 1px 深色描边 / 每色最多 2-3 种深浅 / 无渐变 / 透明背景
三张图尺寸都通过 spriteValid 校验（单帧宽高 ∈ [10, 200]）
"""
from PIL import Image, ImageDraw
TRANSP = (0, 0, 0, 0)

# ============================================================
# 8-BIT NES PALETTE (精心挑选的 NES 式 16 色通用盘)
# ============================================================
# 黑色描边（所有角色共用，所有形状 1px 纯黑边 → 经典 8-bit 质感）
OUTLINE = (18, 10, 10)

# ---- 丧尸盘（NES 僵尸绿，三色阶）----
Z_SKIN = (140, 170, 88);  Z_SKIN_M = (98, 126, 52);  Z_SKIN_D = (64, 88, 32)
Z_ROT  = (138, 68, 48);   Z_ROT_D = (88, 36, 22)
Z_BLD  = (196, 28, 28);   Z_BLD_D = (120, 0, 0)
Z_JACK = (80, 96, 48);    Z_JACK_D = (54, 66, 30)
Z_PANT = (56, 64, 84);    Z_PANT_D = (36, 42, 58)
Z_EYE  = (252, 36, 36)
Z_TOOTH= (228, 220, 176); Z_CLAW = (200, 192, 156); Z_CLAW_D = (140, 132, 100)
Z_HAIR = (28, 22, 18)
Z_BONE = (208, 200, 164)

# ---- 玩家（NES 勇者/林克绿，3 色阶）----
P_SKIN  = (248, 208, 168); P_SKIN_M = (220, 176, 132); P_SKIN_D = (184, 136, 92)
P_HAIR  = (116, 72, 28);   P_HAIR_D = (80, 48, 16)
P_TUNIC = (60, 146, 64);   P_TUNIC_M = (40, 112, 44);  P_TUNIC_D = (26, 82, 30)   # 勇者林克绿
P_BELT  = (118, 72, 24)
P_PANT  = (88, 56, 20);    P_PANT_D = (62, 36, 10)
P_BOOT  = (52, 30, 12)
P_SWORD = (224, 228, 240); P_SWORD_M = (168, 172, 192); P_SWORD_D = (108, 112, 136)
P_SHLD  = (180, 44, 44);   P_SHLD_D = (128, 24, 24);   P_SHLD_Y = (240, 204, 44)
P_EYE   = (20, 20, 40)
P_CROWN = (252, 216, 0);   P_CROWN_D = (172, 132, 0)   # 高等级皇冠金

# ---- 士兵（NES 蓝军装，2 色阶）----
S_SKIN  = (240, 200, 160); S_SKIN_D = (192, 144, 96)
S_HELM  = (112, 116, 128); S_HELM_D = (76, 80, 92)
S_UNI   = (72, 104, 152);  S_UNI_D = (48, 72, 112)
S_BOOT  = (56, 32, 12)
S_GUN   = (96, 96, 104);   S_GUN_D = (56, 56, 64)
S_EYE   = (16, 16, 20)
S_BULLET= (252, 220, 84)

def px(d, x, y, w, h, c):
    if c == TRANSP: return
    d.rectangle([x, y, x+w-1, y+h-1], fill=c)

# 8-bit 专用：xywh → PIL (x0,y0,x1,y1) 矩形封装（避免反复写 +-1）
def rect(d, x, y, w, h, col):
    if col == TRANSP or w < 1 or h < 1:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col)



def outline(d, points, col=OUTLINE):
    """画描边：points 为 [(x,y,w,h), ...]"""
    for (x, y, w, h) in points:
        px(d, x, y, w, h, col)


# ============================================================
#  ZOMBIE —— 64×128 帧，3 帧走路 A/B + 冲刺攻击 L
# ============================================================
def draw_zombie_head(d, cx, top, variant):
    hw, hh = 22, 24
    tilt_x, tilt_y = 0, 0
    if variant == 'A': tilt_x = -1
    elif variant == 'B': tilt_x = 1
    else: tilt_x, tilt_y = 2, 2
    hx = cx - hw//2 + tilt_x; hy = top + tilt_y

    # 1) 先画完整黑色描边（向外扩一圈）
    # 头发外轮廓
    for i, h in [(2,4),(3,4),(4,7),(5,7),(6,9),(7,9),(8,9),(13,9),(14,9),(15,7),(16,7),(17,7),(18,5),(19,5)]:
        px(d, hx+i, hy-h-1, 1, 1, OUTLINE)
        px(d, hx+i, hy-h, 1, h, Z_HAIR)
    px(d, hx-1, hy-1, 1, 13, OUTLINE)         # 左鬓角+边
    px(d, hx-2, hy+4, 1, 8, OUTLINE); px(d, hx-1, hy+4, 1, 8, Z_HAIR)
    px(d, hx+hw, hy-1, 1, 13, OUTLINE)         # 右鬓角+边
    px(d, hx+hw+1, hy+4, 1, 8, OUTLINE); px(d, hx+hw, hy+4, 1, 8, Z_HAIR)
    # 头外框
    px(d, hx, hy-1, hw, 1, OUTLINE)
    px(d, hx-1, hy, 1, hh-4, OUTLINE)
    px(d, hx+hw, hy, 1, hh-4, OUTLINE)
    # 填充头肉
    px(d, hx+1, hy, hw-2, hh-4, Z_SKIN)
    px(d, hx, hy+4, 1, hh-10, Z_SKIN)
    px(d, hx+hw-1, hy+4, 1, hh-10, Z_SKIN)
    # 下巴弧
    px(d, hx+1, hy+hh-4, hw-2, 2, Z_SKIN_M)
    px(d, hx+2, hy+hh-2, hw-4, 1, Z_SKIN_D)
    px(d, hx, hy+hh-3, hw, 1, OUTLINE)         # 下巴描边

    # 太阳穴白骨
    px(d, hx, hy+7, 2, 2, Z_BONE); px(d, hx-1, hy+7, 1, 2, OUTLINE)
    px(d, hx+2, hy+8, 1, 1, Z_ROT_D)

    # 腐烂斑（带描边感深色）
    px(d, hx+3, hy+6, 3, 2, Z_ROT)
    px(d, hx+15, hy+10, 2, 3, Z_ROT)
    # 血迹
    px(d, hx+hw-5, hy+10, 1, 5, Z_BLD)
    px(d, hx+hw-4, hy+12, 1, 3, Z_BLD_D)

    # 眼窝（深边）
    px(d, hx+2, hy+10, hw-4, 4, OUTLINE)
    px(d, hx+3, hy+11, hw-6, 2, Z_SKIN_M)

    # 眼睛
    if variant == 'L':
        # 冲刺眼发光
        px(d, hx+3, hy+9, 6, 6, Z_BLD); px(d, hx+4, hy+10, 4, 4, Z_EYE)
        px(d, hx+5, hy+11, 2, 2, (255,255,255))
        px(d, hx+13, hy+9, 6, 6, Z_BLD); px(d, hx+14, hy+10, 4, 4, Z_EYE)
        px(d, hx+15, hy+11, 2, 2, (255,255,255))
    else:
        px(d, hx+4, hy+11, 3, 3, Z_EYE); px(d, hx+14, hy+11, 3, 3, Z_EYE)
        px(d, hx+5, hy+11, 1, 1, (255,255,255)); px(d, hx+15, hy+11, 1, 1, (255,255,255))

    # 鼻孔
    px(d, hx+10, hy+15, 1, 2, Z_ROT_D); px(d, hx+12, hy+15, 1, 2, Z_ROT_D)

    # 嘴巴描边 + 填充
    mouth_y = hy + 18
    if variant == 'L':
        px(d, hx+4, mouth_y-2, hw-8, 8, OUTLINE)
        px(d, hx+5, mouth_y-1, hw-10, 6, Z_ROT_D)
        # 獠牙
        px(d, hx+7, mouth_y-1, 2, 4, Z_TOOTH)
        px(d, hx+hw-9, mouth_y-1, 2, 4, Z_TOOTH)
        for off,col in [(8,Z_TOOTH),(10,Z_CLAW),(12,Z_CLAW),(13,Z_TOOTH)]:
            px(d, hx+off, mouth_y+3, 1, 2, col)
        # 嘴角血
        px(d, hx+3, mouth_y+1, 1, 4, Z_BLD); px(d, hx+hw-4, mouth_y+1, 1, 5, Z_BLD)
        px(d, hx+hw-5, mouth_y+3, 1, 3, Z_BLD_D)
    else:
        # 咬紧露尖牙
        px(d, hx+5, mouth_y, hw-10, 3, OUTLINE)
        px(d, hx+6, mouth_y+1, hw-12, 1, Z_ROT_D)
        px(d, hx+8, mouth_y+1, 1, 2, Z_TOOTH); px(d, hx+13, mouth_y+1, 1, 2, Z_TOOTH)
    return hy + hh + 2  # head_bottom


def draw_zombie_body(d, cx, hb, v):
    bw = 32; bx = cx - bw//2
    shift = {'A':-1, 'B':1, 'L':2}[v]
    bbx = bx + shift
    jt, jh = hb + 4, 32

    # 颈
    px(d, cx-4+shift, hb-1, 1, 1, OUTLINE)
    px(d, cx-5+shift, hb, 10, 6, OUTLINE)
    px(d, cx-4+shift, hb, 8, 5, Z_SKIN)
    px(d, cx-4+shift, hb+3, 8, 1, Z_SKIN_M)
    px(d, cx-3, hb+1, 2, 1, Z_BLD); px(d, cx+1, hb, 1, 2, Z_BLD_D)

    # 夹克外框
    px(d, bbx-3, jt-1, bw+6, 1, OUTLINE)
    px(d, bbx-3, jt, 1, jh+3, OUTLINE)
    px(d, bbx+bw+2, jt, 1, jh+3, OUTLINE)
    px(d, bbx-1, jt+jh+3, bw+2, 1, OUTLINE)
    # 夹克填充
    px(d, bbx-2, jt, bw+4, jh+3, Z_JACK)
    # 下摆
    px(d, bbx+1, jt+jh, bw-2, 3, Z_JACK_D)
    # 翻领
    px(d, cx-7, jt, 4, 8, Z_JACK_D); px(d, cx+3, jt, 4, 8, Z_JACK_D)
    px(d, cx-8, jt+1, 1, 7, OUTLINE); px(d, cx+7, jt+1, 1, 7, OUTLINE)
    # 中央缝线
    px(d, cx-1, jt+4, 2, jh-6, Z_JACK_D)
    # 扣子（金属色小方块）
    for i in range(4):
        cy = jt + 10 + i*7
        px(d, cx-2, cy-1, 4, 3, OUTLINE)
        px(d, cx-1, cy, 2, 1, (180, 180, 180))
    # 破洞
    px(d, bbx+4, jt+9, 5, 4, OUTLINE)
    px(d, bbx+5, jt+10, 3, 2, Z_SKIN_M)
    # 下摆撕裂
    px(d, bbx+bw-8, jt+jh, 6, 3, TRANSP)
    px(d, bbx+bw-9, jt+jh, 1, 3, OUTLINE)
    # 血迹
    for xi, c in [(16,Z_BLD),(19,Z_BLD),(17+3,Z_BLD_D)]:
        px(d, bbx+xi, jt+18, 1, 1, c)

    # 手臂
    ay = jt + 3
    if v == 'A':   # Step A: 右臂前 / 左臂后
        # 右臂（前伸）
        d.rectangle([bbx+bw-3,ay, bbx+bw+2,ay+8], fill=OUTLINE)
        d.rectangle([bbx+bw-2,ay+1, bbx+bw+1,ay+7], fill=Z_JACK)
        d.rectangle([bbx+bw,ay+7, bbx+bw+5,ay+17], fill=OUTLINE)
        d.rectangle([bbx+bw+1,ay+8, bbx+bw+4,ay+16], fill=Z_SKIN)
        # 爪
        rx,ry = bbx+bw-1, ay+16
        rect(d, rx-1, ry, rx+6, ry+5, OUTLINE)
        px(d, rx, ry+1, 6, 4, Z_SKIN)
        for ci in range(3):
            px(d, rx+6, ry+ci*2, 3, 1, Z_CLAW); px(d, rx+9, ry+ci*2+1, 1, 1, Z_CLAW_D)
        # 左臂（后）
        rect(d, bbx-2, ay+1, bbx+2, ay+9, OUTLINE)
        rect(d, bbx-1, ay+2, bbx+1, ay+8, Z_JACK_D)
        rect(d, bbx-4, ay+8, bbx, ay+17, OUTLINE)
        rect(d, bbx-3, ay+9, bbx-1, ay+16, Z_SKIN_D)
    elif v == 'B':  # Step B: 左臂前 / 右臂后（镜像 A）
        rect(d, bbx-3, ay, bbx+2, ay+8, OUTLINE)
        rect(d, bbx-2, ay+1, bbx+1, ay+7, Z_JACK)
        rect(d, bbx-5, ay+7, bbx, ay+17, OUTLINE)
        rect(d, bbx-4, ay+8, bbx-1, ay+16, Z_SKIN)
        lx,ly = bbx-6, ay+16
        rect(d, lx-1, ly, lx+6, ly+5, OUTLINE)
        px(d, lx, ly+1, 6, 4, Z_SKIN)
        for ci in range(3):
            px(d, lx-3, ly+ci*2, 3, 1, Z_CLAW); px(d, lx-4, ly+ci*2+1, 1, 1, Z_CLAW_D)
        # 右臂后
        d.rectangle([bbx+bw-2,ay+1, bbx+bw+2,ay+9], fill=OUTLINE)
        d.rectangle([bbx+bw-1,ay+2, bbx+bw+1,ay+8], fill=Z_JACK_D)
        d.rectangle([bbx+bw,ay+8, bbx+bw+4,ay+17], fill=OUTLINE)
        d.rectangle([bbx+bw+1,ay+9, bbx+bw+3,ay+16], fill=Z_SKIN_D)
    else:  # L: 冲刺双臂前抓
        # 左臂前下抓
        rect(d, bbx-4, ay-1, bbx+2, ay+7, OUTLINE)
        rect(d, bbx-3, ay, bbx+1, ay+6, Z_JACK)
        rect(d, bbx-10, ay+3, bbx-3, ay+12, OUTLINE)
        rect(d, bbx-9, ay+4, bbx-4, ay+11, Z_SKIN)
        lx,ly = bbx-14, ay+9
        rect(d, lx-1, ly, lx+7, ly+6, OUTLINE)
        px(d, lx, ly+1, 7, 5, Z_SKIN)
        for ci in range(3):
            px(d, lx-4, ly+ci*2+1, 4, 1, Z_CLAW); px(d, lx-5, ly+ci*2+2, 1, 1, Z_CLAW_D)
        px(d, lx+2, ly+2, 1, 1, Z_ROT); px(d, lx+4, ly+4, 1, 1, Z_ROT)
        # 右臂前下抓（略高）
        d.rectangle([bbx+bw-2,ay-1, bbx+bw+4,ay+7], fill=OUTLINE)
        d.rectangle([bbx+bw-1,ay, bbx+bw+3,ay+6], fill=Z_JACK)
        d.rectangle([bbx+bw+2,ay+2, bbx+bw+9,ay+11], fill=OUTLINE)
        d.rectangle([bbx+bw+3,ay+3, bbx+bw+8,ay+10], fill=Z_SKIN)
        rx,ry = bbx+bw+7, ay+8
        rect(d, rx-1, ly, rx+7, ry+6, OUTLINE)
        px(d, rx, ry+1, 7, 5, Z_SKIN)
        for ci in range(3):
            px(d, rx+7, ry+ci*2+1, 4, 1, Z_CLAW); px(d, rx+11, ry+ci*2+2, 1, 1, Z_CLAW_D)

    # 皮带
    by = jt + jh + 1
    d.rectangle([bbx-2,by-1, bbx+bw+1,by+4], fill=OUTLINE)
    px(d, bbx-1, by, bw+2, 3, (58, 34, 16))
    # 扣
    rect(d, cx-4, by-1, cx+3, by+4, OUTLINE)
    px(d, cx-3, by, 6, 3, (180,180,180)); px(d, cx-2, by+1, 4, 1, (220,220,220))

    # 裤子 + 腿
    pt = by + 4; ph = 30; lw = bw//2 - 1
    if v == 'A':
        # 左腿前，右腿后
        lx, rx2 = bx-2, bx + bw - lw + 1
        # 左
        rect(d, lx+1, pt-1, lw, ph-10, OUTLINE)
        px(d, lx+2, pt, lw-2, ph-12, Z_PANT)
        px(d, lx+2, pt+3, 1, ph-14, Z_PANT_D)
        rect(d, lx+4, pt+11, 5, 4, OUTLINE); px(d, lx+5, pt+12, 3, 2, Z_SKIN_M)
        # 小腿
        rect(d, lx, pt+ph-17, lw, 10, OUTLINE)
        px(d, lx+1, pt+ph-16, lw-2, 8, Z_PANT_D)
        # 靴
        fx,fy = lx-4, pt+ph-8
        rect(d, fx-1, fy-1, lw+7, 8, OUTLINE)
        px(d, fx, fy, lw+6, 6, (44,28,10)); px(d, fx, fy+6, lw+6, 1, (20,10,4))
        px(d, lx+5, pt+14, 1, 6, Z_BLD)
        # 右腿后
        rect(d, rx2+1, pt+1, lw-2, ph-10, OUTLINE)
        px(d, rx2+2, pt+2, lw-3, ph-12, Z_PANT_D)
        rect(d, rx2+lw-3, pt+5, 3, 12, TRANSP)
        rect(d, rx2+lw-3, pt+8, 2, 11, OUTLINE); px(d, rx2+lw-2, pt+9, 1, 10, Z_SKIN_D)
        fx2,fy2 = rx2+3, pt+ph-6
        rect(d, fx2-1, fy2-1, lw-2, 6, OUTLINE)
        px(d, fx2, fy2, lw-3, 4, (20,12,4))
    elif v == 'B':   # 右腿前，左腿后（镜像 A）
        rx2, lx = bx + bw - lw + 1, bx - 2
        rect(d, rx2, pt-1, lw, ph-10, OUTLINE)
        px(d, rx2+1, pt, lw-2, ph-12, Z_PANT)
        px(d, rx2+lw-2, pt+3, 1, ph-14, Z_PANT_D)
        rect(d, rx2+2, pt+13, 5, 4, OUTLINE); px(d, rx2+3, pt+14, 3, 2, Z_SKIN_M)
        rect(d, rx2-1, pt+ph-17, lw, 10, OUTLINE)
        px(d, rx2, pt+ph-16, lw-2, 8, Z_PANT_D)
        fx2,fy2 = rx2-4, pt+ph-8
        rect(d, fx2-1, fy2-1, lw+7, 8, OUTLINE)
        px(d, fx2, fy2, lw+6, 6, (44,28,10)); px(d, fx2, fy2+6, lw+6, 1, (20,10,4))
        px(d, rx2+3, pt+17, 1, 6, Z_BLD)
        # 左腿后
        rect(d, lx+1, pt+1, lw-2, ph-10, OUTLINE)
        px(d, lx+2, pt+2, lw-3, ph-12, Z_PANT_D)
        rect(d, lx+1, pt+6, 3, 12, TRANSP)
        rect(d, lx+1, pt+8, 2, 11, OUTLINE); px(d, lx+2, pt+9, 1, 10, Z_SKIN_D)
        fx1,fy1 = lx+2, pt+ph-6
        rect(d, fx1-1, fy1-1, lw-2, 6, OUTLINE)
        px(d, fx1, fy1, lw-3, 4, (20,12,4))
    else:  # L: 冲刺大步
        # 左：膝极度弯曲前踏大靴
        lx = bx-2
        rect(d, lx+1, pt-1, lw, 14, OUTLINE)
        px(d, lx+2, pt, lw-2, 12, Z_PANT)
        px(d, lx+2, pt+2, 1, 10, Z_PANT_D)
        rect(d, lx+3, pt+3, 4, 4, OUTLINE); px(d, lx+4, pt+4, 2, 2, Z_SKIN_M)
        rect(d, lx-1, pt+12, lw+2, 16, OUTLINE)
        px(d, lx, pt+13, lw, 14, Z_PANT_D)
        fx1,fy1 = lx-8, pt+ph-6
        rect(d, fx1-1, fy1-1, lw+12, 9, OUTLINE)
        px(d, fx1, fy1, lw+11, 7, (44,28,10)); px(d, fx1, fy1+7, lw+11, 1, (20,10,4))
        px(d, fx1+5, fy1+2, 1, 1, (50,30,15)); px(d, fx1+9, fy1+2, 1, 1, (50,30,15))
        px(d, lx+4, pt+6, 1, 10, Z_BLD)
        # 右：后蹬腿
        rx2 = bx + bw - lw + 2
        rect(d, rx2-1, pt-1, lw-1, 10, OUTLINE)
        px(d, rx2, pt, lw-2, 8, Z_PANT_D)
        rect(d, rx2+2, pt+8, lw-3, 16, OUTLINE)
        px(d, rx2+3, pt+9, lw-4, 14, Z_PANT_D)
        rect(d, rx2+1, pt+4, 2, 8, OUTLINE); px(d, rx2+2, pt+5, 1, 7, Z_SKIN_D)
        fx2,fy2 = rx2+4, pt+ph-2
        rect(d, fx2-1, fy2-1, lw, 6, OUTLINE)
        px(d, fx2, fy2, lw-1, 4, (20,12,4))


def render_zombie_sheet(path):
    FW,FH = 64,128
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['A','B','L']):
        cx = fi*FW + FW//2
        hb = draw_zombie_head(d, cx, 6, v)
        draw_zombie_body(d, cx, hb, v)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    print(f"🧟 zombie: {img.size}  frame {fw:.0f}x{img.size[1]}  valid={10<=fw<=200 and 10<=img.size[1]<=200}")


# ============================================================
#  PLAYER —— 54×108 帧，3 帧 idle/walk/attack（NES 勇者绿）
# ============================================================
def player_head(d, cx, top, level=1):
    """level 决定头饰: 1=普通发, 2=短发, 3=头盔, 4+=皇冠"""
    hw, hh = 20, 20
    hx, hy = cx - hw//2, top

    # 轮廓（头发轮廓）
    hair_h_px = [(2,3),(3,5),(4,6),(5,7),(6,7),(13,7),(14,7),(15,6),(16,5),(17,3)]
    for i, h in hair_h_px:
        px(d, hx+i, hy-h, 1, 1, OUTLINE)
        px(d, hx+i, hy-h+1, 1, h-1, P_HAIR if level<3 else (P_SWORD_M if level==3 else P_CROWN))
    # 侧面鬓角轮廓
    px(d, hx-1, hy-1, 1, 9, OUTLINE); px(d, hx, hy, 1, 8, P_HAIR)
    px(d, hx+hw, hy-1, 1, 9, OUTLINE); px(d, hx+hw-1, hy, 1, 8, P_HAIR)

    # 头部外框
    px(d, hx, hy-1, hw, 1, OUTLINE)
    px(d, hx-1, hy, 1, hh-4, OUTLINE)
    px(d, hx+hw, hy, 1, hh-4, OUTLINE)
    # 填充肤色
    px(d, hx+1, hy, hw-2, hh-4, P_SKIN)
    px(d, hx+1, hy, hw-2, 1, P_SKIN_M)  # 顶部阴影（头发挡）
    px(d, hx, hy+4, 1, hh-10, P_SKIN)    # 鬓角露肤
    px(d, hx+hw-1, hy+4, 1, hh-10, P_SKIN)
    # 下巴
    px(d, hx+1, hy+hh-4, hw-2, 2, P_SKIN_M)
    px(d, hx+2, hy+hh-2, hw-4, 1, P_SKIN_D)
    px(d, hx-1, hy+hh-3, hw+2, 1, OUTLINE)   # 下巴描边

    # 头饰（按 level）
    if level >= 4:   # 皇冠金
        for i, (xh, yh, wh, hh, col) in enumerate([
            (2, -10, 16, 3, OUTLINE), (3, -9, 14, 2, P_CROWN),
            (3, -12, 2, 3, OUTLINE), (4, -12, 1, 2, P_CROWN),
            (9, -13, 2, 4, OUTLINE), (10, -13, 1, 3, P_CROWN),
            (15, -12, 2, 3, OUTLINE), (16, -12, 1, 2, P_CROWN),
        ]):
            px(d, hx+xh, hy+yh, wh, hh, col)
        px(d, hx+4, hy-9, 1, 1, P_CROWN_D); px(d, hx+13, hy-9, 1, 1, P_CROWN_D)
    elif level == 3:   # 头盔
        px(d, hx, hy-5, hw, 5, OUTLINE)
        px(d, hx+1, hy-4, hw-2, 4, S_HELM)
        px(d, hx+1, hy-4, hw-2, 1, S_HELM_D)
        px(d, hx+hw//2-1, hy-8, 2, 4, OUTLINE)
        px(d, hx+hw//2-1, hy-8, 2, 3, P_SHLD)  # 红顶羽
    elif level == 2:   # 短发
        pass  # 已经用棕色
    else:   # Lv1 新手发（刘海）
        px(d, hx+3, hy, 14, 2, OUTLINE)
        px(d, hx+4, hy+1, 12, 1, P_HAIR_D)

    # 眼窝阴影
    px(d, hx+2, hy+9, hw-4, 2, P_SKIN_M)
    # 眼睛（朝右：x+6 和 x+11，根据朝向微调——默认中性）
    px(d, hx+5, hy+10, 2, 2, P_EYE); px(d, hx+5, hy+10, 1, 1, (255,255,255))
    px(d, hx+12, hy+10, 2, 2, P_EYE); px(d, hx+12, hy+10, 1, 1, (255,255,255))
    # 嘴
    px(d, hx+8, hy+14, 4, 1, OUTLINE)
    px(d, hx+9, hy+15, 2, 1, P_SKIN_D)
    return hy + hh + 1


def player_body(d, cx, hb, variant, level=1):
    """variant: 'idle' 'walk' 'attack'"""
    bw = 28; bx = cx - bw//2
    tunic_top = hb + 3; tunic_h = 24
    # 颈
    px(d, cx-4, hb-1, 1, 1, OUTLINE)
    px(d, cx-5, hb, 10, 5, OUTLINE); px(d, cx-4, hb, 8, 4, P_SKIN); px(d, cx-4, hb+3, 8, 1, P_SKIN_D)

    # 束腰外衣 + 描边
    px(d, bx-2, tunic_top-1, bw+4, 1, OUTLINE)
    px(d, bx-2, tunic_top, 1, tunic_h+3, OUTLINE)
    px(d, bx+bw+1, tunic_top, 1, tunic_h+3, OUTLINE)
    px(d, bx, tunic_top+tunic_h+2, bw, 1, OUTLINE)
    # 衣摆下斜边
    px(d, bx-1, tunic_top+tunic_h, 1, 3, OUTLINE); px(d, bx+bw+1, tunic_top+tunic_h, 1, 3, OUTLINE)
    # 填充
    px(d, bx-1, tunic_top, bw+2, tunic_h+2, P_TUNIC)
    px(d, bx, tunic_top+tunic_h, bw, 2, P_TUNIC_M)
    # 衣领
    px(d, cx-5, tunic_top, 10, 6, P_TUNIC_M)
    px(d, cx-4, tunic_top, 8, 1, OUTLINE)
    # 肩膀阴影
    px(d, bx-1, tunic_top, 1, 6, P_TUNIC_D); px(d, bx+bw, tunic_top, 1, 6, P_TUNIC_D)
    # 中央缝
    px(d, cx-1, tunic_top+6, 2, tunic_h-8, P_TUNIC_D)

    # 腰带
    belt_y = tunic_top + tunic_h - 5
    d.rectangle([bx-2,belt_y-1, bx+bw+1,belt_y+3], fill=OUTLINE)
    px(d, bx-1, belt_y, bw+2, 3, P_BELT)
    px(d, cx-2, belt_y, 4, 3, P_CROWN); px(d, cx-2, belt_y, 4, 1, P_CROWN_D)  # 金扣

    # 盾牌（左手，idle/walk 挂左腰）
    if variant != 'attack':
        sh_x, sh_y = bx - 6, tunic_top + 8
        for args in [
            (sh_x-1, sh_y-1, 10, 12, OUTLINE),
            (sh_x, sh_y, 8, 10, P_SHLD),
            (sh_x, sh_y, 8, 1, P_SHLD_D),
            (sh_x+1, sh_y+9, 6, 1, P_SHLD_D),
        ]:
            d.rectangle([args[0],args[1], args[0]+args[2]-1,args[1]+args[3]-1], fill=args[4])
        # 盾徽黄色十字
        px(d, sh_x+3, sh_y+2, 2, 6, P_SHLD_Y); px(d, sh_x+1, sh_y+4, 6, 2, P_SHLD_Y)

    # 手臂 + 武器
    ay = tunic_top + 2
    if variant == 'idle':
        # 左臂（垂，带盾已经画了）
        rect(d, bx-3, ay, bx+1, ay+9, OUTLINE)
        rect(d, bx-2, ay+1, bx, ay+8, P_TUNIC_M)
        rect(d, bx-4, ay+8, bx+1, ay+14, OUTLINE)
        rect(d, bx-3, ay+9, bx, ay+13, P_SKIN)
        # 右臂（垂，空手）
        d.rectangle([bx+bw-1,ay, bx+bw+3,ay+9], fill=OUTLINE)
        d.rectangle([bx+bw,ay+1, bx+bw+2,ay+8], fill=P_TUNIC_M)
        d.rectangle([bx+bw-2,ay+8, bx+bw+3,ay+14], fill=OUTLINE)
        d.rectangle([bx+bw-1,ay+9, bx+bw+2,ay+13], fill=P_SKIN)
    elif variant == 'walk':
        # 左臂前摆
        rect(d, bx-4, ay+1, bx, ay+8, OUTLINE)
        rect(d, bx-3, ay+2, bx-1, ay+7, P_TUNIC_M)
        rect(d, bx-6, ay+7, bx-1, ay+15, OUTLINE)
        rect(d, bx-5, ay+8, bx-2, ay+14, P_SKIN)
        # 右臂后摆
        d.rectangle([bx+bw,ay+1, bx+bw+4, ay+8], fill=OUTLINE)
        d.rectangle([bx+bw+1,ay+2, bx+bw+3, ay+7], fill=P_TUNIC_M)
        d.rectangle([bx+bw,ay+8, bx+bw+5, ay+15], fill=OUTLINE)
        d.rectangle([bx+bw+1,ay+9, bx+bw+4, ay+14], fill=P_SKIN)
    else:   # attack: 右手剑挥出
        # 左臂：盾在前
        rect(d, bx-5, ay-2, bx, ay+6, OUTLINE)
        rect(d, bx-4, ay-1, bx-1, ay+5, P_TUNIC_M)
        sh_x, sh_y = bx - 11, ay - 3
        rect(d, sh_x-1, sh_y-1, 10, 12, OUTLINE)
        rect(d, sh_x, sh_y, 8, 10, P_SHLD)
        rect(d, sh_x, sh_y, 8, 1, P_SHLD_D)
        px(d, sh_x+3, sh_y+2, 2, 6, P_SHLD_Y); px(d, sh_x+1, sh_y+4, 6, 2, P_SHLD_Y)
        # 右臂：剑水平前伸（长）
        d.rectangle([bx+bw-1,ay-2, bx+bw+4, ay+6], fill=OUTLINE)
        d.rectangle([bx+bw,ay-1, bx+bw+3, ay+5], fill=P_TUNIC_M)
        # 剑柄
        hilt_x, hilt_y = bx + bw + 2, ay + 5
        rect(d, hilt_x-1, hilt_y-1, 8, 5, OUTLINE)
        rect(d, hilt_x, hilt_y, 7, 4, P_BELT)
        px(d, hilt_x-1, hilt_y-3, 9, 3, OUTLINE)      # 护手横
        px(d, hilt_x, hilt_y-3, 8, 2, P_CROWN)
        # 剑身（长，向右）
        blade_x = hilt_x + 7
        rect(d, blade_x-1, hilt_y-2, 24, 5, OUTLINE)
        rect(d, blade_x, hilt_y-1, 22, 3, P_SWORD)
        rect(d, blade_x, hilt_y-1, 22, 1, (255,255,255))
        rect(d, blade_x, hilt_y+1, 22, 1, P_SWORD_M)
        rect(d, blade_x+22, hilt_y-3, 3, 7, OUTLINE)  # 剑尖
        px(d, blade_x+22, hilt_y-2, 2, 5, P_SWORD)
        px(d, blade_x+24, hilt_y-1, 1, 3, P_SWORD_D)

    # 裤 + 腿
    pt = tunic_top + tunic_h - 2; ph = 22; lw = bw//2
    if variant == 'walk':
        # 左腿前，右腿后
        lx, rx2 = bx, bx + bw - lw
        rect(d, lx, pt-1, lw, 10, OUTLINE); px(d, lx+1, pt, lw-2, 9, P_PANT)
        rect(d, lx-2, pt+8, lw, 10, OUTLINE); px(d, lx-1, pt+9, lw-2, 9, P_PANT_D)
        fx,fy = lx-3, pt + ph - 4
        rect(d, fx-1, fy-1, lw+4, 6, OUTLINE); px(d, fx, fy, lw+3, 4, P_BOOT); px(d, fx, fy+4, lw+3, 1, (20,10,0))
        # 右腿后
        rect(d, rx2, pt+1, lw-1, 8, OUTLINE); px(d, rx2+1, pt+2, lw-2, 7, P_PANT_D)
        fx2,fy2 = rx2+1, pt+ph-3
        rect(d, fx2-1, fy2-1, lw-1, 5, OUTLINE); px(d, fx2, fy2, lw-2, 3, P_BOOT)
    elif variant == 'attack':
        # 站稳：双脚分开略蹲
        stance = 2
        lx, rx2 = bx-stance, bx+bw-lw+stance
        for LX, LEG_C in [(lx, P_PANT), (rx2, P_PANT_D)]:
            rect(d, LX, pt-1, lw, 12, OUTLINE); px(d, LX+1, pt, lw-2, 11, LEG_C)
            rect(d, LX+1, pt+10, lw-2, 9, OUTLINE); px(d, LX+2, pt+11, lw-4, 8, LEG_C)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2,3, P_BOOT)
    else:  # idle: 直立
        lx, rx2 = bx, bx + bw - lw
        for LX, LEG_C in [(lx, P_PANT), (rx2, P_PANT_D)]:
            rect(d, LX, pt-1, lw, 10, OUTLINE); px(d, LX+1, pt, lw-2, 9, LEG_C)
            rect(d, LX+1, pt+8, lw-2, 10, OUTLINE); px(d, LX+2, pt+9, lw-4, 9, LEG_C)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2, 3, P_BOOT); px(d, FX, FY+3, lw+2, 1, (20,10,0))


def render_player_sheet(path):
    FW,FH = 54,108
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['idle','walk','attack']):
        cx = fi*FW + FW//2
        hb = player_head(d, cx, 6, level=3)   # 默认带头盔 Lv3 帅一点
        player_body(d, cx, hb, v, level=3)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    print(f"🧝 player: {img.size}  frame {fw:.0f}x{img.size[1]}  valid={10<=fw<=200 and 10<=img.size[1]<=200}")


# ============================================================
#  SOLDIER —— 54×96 帧，3 帧 idle/walk/shoot（NES 蓝军装钢盔）
# ============================================================
def soldier_head(d, cx, top, variant):
    hw, hh = 18, 18
    hx, hy = cx - hw//2, top
    tilt_x = {'idle':0,'walk':-1,'shoot':1}[variant]
    hx += tilt_x

    # 头盔（先画，钢盔包住大头）
    # 轮廓顶
    top_h = [(2,3),(3,5),(4,6),(5,7),(6,8),(11,8),(12,7),(13,6),(14,5),(15,3)]
    for i, h in top_h:
        px(d, hx+i, hy-h-1, 1, 1, OUTLINE)
        px(d, hx+i, hy-h, 1, h, S_HELM)
    # 头盔主体顶帽边
    px(d, hx, hy-1, hw, 1, OUTLINE)
    px(d, hx-1, hy, hw+2, 8, OUTLINE)
    px(d, hx, hy+1, hw, 6, S_HELM)
    px(d, hx, hy+1, hw, 1, S_HELM_D)
    # 头盔前檐
    px(d, hx-2, hy+5, hw+4, 2, OUTLINE)
    px(d, hx-1, hy+6, hw+2, 1, S_HELM_D)

    # 脸（头盔下）
    fy = hy + 7
    px(d, hx-1, fy-1, hw+2, 1, OUTLINE)
    px(d, hx-1, fy, 1, hh-9, OUTLINE)
    px(d, hx+hw, fy, 1, hh-9, OUTLINE)
    px(d, hx, fy, hw, hh-10, S_SKIN)
    px(d, hx, fy, hw, 1, S_SKIN_D)  # 头盔阴影
    px(d, hx, fy+hh-10, hw, 2, S_SKIN_D)
    px(d, hx-1, fy+hh-9, hw+2, 1, OUTLINE)  # 下巴

    # 眼睛
    px(d, hx+4, fy+4, 2, 2, S_EYE); px(d, hx+4, fy+4, 1, 1, (255,255,255))
    px(d, hx+11, fy+4, 2, 2, S_EYE); px(d, hx+11, fy+4, 1, 1, (255,255,255))
    return fy + hh - 8  # head_bottom


def soldier_body(d, cx, hb, variant):
    bw = 26; bx = cx - bw//2
    jt = hb + 3; jh = 22
    # 颈
    px(d, cx-3, hb-1, 7, 5, OUTLINE); px(d, cx-2, hb, 5, 4, S_SKIN)

    # 军装
    px(d, bx-2, jt-1, bw+4, 1, OUTLINE)
    px(d, bx-2, jt, 1, jh+3, OUTLINE); px(d, bx+bw+1, jt, 1, jh+3, OUTLINE)
    px(d, bx, jt+jh+2, bw, 1, OUTLINE)
    px(d, bx-1, jt+jh, 1, 3, OUTLINE); px(d, bx+bw+1, jt+jh, 1, 3, OUTLINE)
    px(d, bx-1, jt, bw+2, jh+2, S_UNI)
    px(d, bx, jt+jh, bw, 2, S_UNI_D)
    # 领章
    px(d, cx-5, jt, 10, 4, S_UNI_D)
    # 胸前口袋
    px(d, bx+3, jt+8, 6, 5, OUTLINE); px(d, bx+4, jt+9, 4, 4, S_UNI_D)
    px(d, bx+bw-9, jt+8, 6, 5, OUTLINE); px(d, bx+bw-8, jt+9, 4, 4, S_UNI_D)
    # 肩章
    px(d, bx-1, jt+1, 3, 3, OUTLINE); px(d, bx, jt+2, 2, 2, S_HELM)
    px(d, bx+bw-2, jt+1, 3, 3, OUTLINE); px(d, bx+bw-2, jt+2, 2, 2, S_HELM)
    # 腰带
    belt_y = jt + jh - 3
    d.rectangle([bx-2,belt_y-1, bx+bw+1,belt_y+3], fill=OUTLINE)
    px(d, bx-1, belt_y, bw+2, 3, P_BELT)
    px(d, cx-3, belt_y, 6, 3, P_CROWN); px(d, cx-3, belt_y, 6, 1, P_CROWN_D)  # 带扣

    # 手臂 + 枪（面朝右，默认朝 DOOR_X，与士兵渲染逻辑一致：sprite 朝右）
    ay = jt + 2
    gun_ext = 0
    if variant == 'idle':
        # 左臂垂
        rect(d, bx-3, ay, bx+1, ay+7, OUTLINE); rect(d, bx-2, ay+1, bx, ay+6, S_UNI_D)
        rect(d, bx-4, ay+7, bx, ay+12, OUTLINE); rect(d, bx-3, ay+8, bx-1, ay+11, S_SKIN)
        # 右臂持枪（枪前指）
        d.rectangle([bx+bw-1,ay, bx+bw+3,ay+7], fill=OUTLINE); d.rectangle([bx+bw,ay+1, bx+bw+2,ay+6], fill=S_UNI_D)
        d.rectangle([bx+bw-2,ay+7, bx+bw+3,ay+12], fill=OUTLINE); d.rectangle([bx+bw-1,ay+8, bx+bw+2,ay+11], fill=S_SKIN)
        gun_ext = 18  # 长枪
        # 枪身（水平前伸）
        gx, gy = bx + bw + 2, ay + 9
        rect(d, gx-1, gy-1, gun_ext, 5, OUTLINE)
        rect(d, gx, gy, gun_ext-2, 3, S_GUN); rect(d, gx, gy, gun_ext-2, 1, S_GUN_D)
        rect(d, gx+gun_ext-2, gy-2, 3, 7, OUTLINE); px(d, gx+gun_ext-2, gy-1, 2, 5, S_GUN_D)
    elif variant == 'walk':
        # 左臂前摆，右臂（持枪）后
        rect(d, bx-4, ay+1, bx, ay+6, OUTLINE); rect(d, bx-3, ay+2, bx-1, ay+5, S_UNI_D)
        rect(d, bx-6, ay+5, bx-1, ay+13, OUTLINE); rect(d, bx-5, ay+6, bx-2, ay+12, S_SKIN)
        d.rectangle([bx+bw,ay+1, bx+bw+4, ay+6], fill=OUTLINE); d.rectangle([bx+bw+1,ay+2, bx+bw+3, ay+5], fill=S_UNI_D)
        d.rectangle([bx+bw,ay+6, bx+bw+5, ay+13], fill=OUTLINE); d.rectangle([bx+bw+1,ay+7, bx+bw+4, ay+12], fill=S_SKIN)
        # 枪垂在手里，后下方
        gx, gy = bx + bw + 1, ay + 11
        rect(d, gx-1, gy-1, 5, 20, OUTLINE)
        rect(d, gx, gy, 3, 18, S_GUN); rect(d, gx, gy, 3, 1, S_GUN_D)
    else:   # shoot: 双手持枪水平瞄准！枪口闪光另外由代码叠加
        # 左手托枪
        rect(d, bx-2, ay-1, bx+3, ay+5, OUTLINE); rect(d, bx-1, ay, bx+2, ay+4, S_UNI_D)
        # 右手握柄
        d.rectangle([bx+bw-1,ay-1, bx+bw+4, ay+5], fill=OUTLINE); d.rectangle([bx+bw,ay, bx+bw+3, ay+4], fill=S_UNI_D)
        # 双手前握枪（更向前）
        rect(d, bx+2, ay+4, bx+8, ay+10, OUTLINE); rect(d, bx+3, ay+5, bx+7, ay+9, S_SKIN)
        d.rectangle([bx+bw-7,ay+4, bx+bw-1, ay+10], fill=OUTLINE); d.rectangle([bx+bw-6,ay+5, bx+bw-2, ay+9], fill=S_SKIN)
        gun_ext = 26
        gx, gy = bx + bw, ay + 6
        rect(d, gx-1, gy-2, gun_ext, 6, OUTLINE)
        rect(d, gx, gy-1, gun_ext-2, 4, S_GUN); rect(d, gx, gy-1, gun_ext-2, 1, (200,200,210))
        rect(d, gx, gy+2, gun_ext-2, 1, S_GUN_D)
        # 瞄准镜
        rect(d, gx+6, gy-4, 5, 3, OUTLINE); px(d, gx+7, gy-3, 3, 1, S_GUN_D)
        # 枪口（放大）
        rect(d, gx+gun_ext-2, gy-3, 4, 8, OUTLINE)
        px(d, gx+gun_ext-2, gy-2, 3, 6, S_GUN_D); px(d, gx+gun_ext-1, gy-1, 2, 4, S_GUN)

    # 裤腿
    pt = belt_y + 3; ph = 22; lw = bw//2
    if variant == 'walk':
        # 左腿前，右腿后
        lx, rx2 = bx, bx + bw - lw
        rect(d, lx, pt-1, lw, 8, OUTLINE); px(d, lx+1, pt, lw-2, 7, P_PANT)
        rect(d, lx-2, pt+7, lw, 9, OUTLINE); px(d, lx-1, pt+8, lw-2, 8, P_PANT_D)
        fx,fy = lx-3, pt + ph - 4
        rect(d, fx-1, fy-1, lw+5, 6, OUTLINE); px(d, fx, fy, lw+4, 4, S_BOOT)
        # 右腿后
        rect(d, rx2, pt, lw-1, 7, OUTLINE); px(d, rx2+1, pt+1, lw-2, 6, P_PANT_D)
        fx2,fy2 = rx2+1, pt+ph-4
        rect(d, fx2-1, fy2-1, lw-1, 5, OUTLINE); px(d, fx2, fy2, lw-2, 3, S_BOOT)
    else:  # idle / shoot: 直立站稳
        lx, rx2 = bx, bx + bw - lw
        for LX, CC in [(lx, P_PANT), (rx2, P_PANT_D)]:
            rect(d, LX, pt-1, lw, 8, OUTLINE); px(d, LX+1, pt, lw-2, 7, CC)
            rect(d, LX+1, pt+7, lw-2, 9, OUTLINE); px(d, LX+2, pt+8, lw-4, 8, CC)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2, 3, S_BOOT); px(d, FX, FY+3, lw+2, 1, (20,10,0))


def render_soldier_sheet(path):
    FW,FH = 54,96
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['idle','walk','shoot']):
        cx = fi*FW + FW//2
        hb = soldier_head(d, cx, 5, v)
        soldier_body(d, cx, hb, v)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    print(f"🪖 soldier: {img.size}  frame {fw:.0f}x{img.size[1]}  valid={10<=fw<=200 and 10<=img.size[1]<=200}")


# ============================================================
#  RUN
# ============================================================
BASE = '/workspace/8bit-dungeon-survival/assets'
render_zombie_sheet(f'{BASE}/zombie_sprite.png')
render_player_sheet(f'{BASE}/player_sprite.png')
render_soldier_sheet(f'{BASE}/soldier_sprite.png')
print('🎉 3 张 NES 8-bit 风格精灵图生成完成')
