"""
3 张角色精灵图生成器 v2（解决武器丢失 + PVZ 丧尸 + 合规尺寸）
=====================================================
 1) 玩家 PLAYER  3 帧 idle/walk/attack ：帧 80×108（比原 54 扩 26px，容纳挥出的长剑）
 2) 士兵 SOLDIER 3 帧 idle/walk/shoot  ：帧 80×96 （扩 26px，容纳瞄准步枪 + 瞄准镜 + 枪口）
 3) 丧尸 ZOMBIE  3 帧 walkA/walkB/attack(L)：帧 72×128（PVZ 风格：大头/歪头/红眼/黄腐/黑破西装/前扑手）
所有单帧 ≤ 200×200 → spriteValid=True
"""
from PIL import Image, ImageDraw
TRANSP = (0, 0, 0, 0)
OUTLINE = (12, 8, 8)

# ===== 调色板 =====
# -- PVZ 丧尸 -- （PVZ 经典：死绿皮 + 芥末黄腐 + 黑西装 + 血红眼 + 黄牙）
PVZ_SKIN   = (136, 176, 96);  PVZ_SKIN_M = (92, 130, 54);   PVZ_SKIN_D = (58, 88, 30)
PVZ_ROT    = (216, 188, 48);  PVZ_ROT_D  = (152, 126, 20)
PVZ_SUIT   = (38, 38, 56);    PVZ_SUIT_D = (22, 22, 34);    PVZ_TIE  = (140, 28, 36)
PVZ_SHIRT  = (232, 224, 196); PVZ_SHIRT_D= (186, 176, 140)
PVZ_EYE    = (232, 48, 48);   PVZ_EYE_W  = (255, 255, 255)
PVZ_BLD  = (208, 28, 28);    PVZ_BLD_D = (144, 8, 8)
PVZ_TOOTH  = (236, 228, 120); PVZ_TOOTH_D= (176, 164, 60)
PVZ_NAIL   = (220, 208, 136); PVZ_NAIL_D = (164, 150, 80)
PVZ_PANT   = (30, 28, 40);    PVZ_PANT_D = (18, 16, 26)
PVZ_HAIR   = (32, 26, 24)

# -- 玩家（NES 勇者绿，3 色阶）--
P_SKIN  = (248, 208, 168); P_SKIN_M = (220, 176, 132); P_SKIN_D = (184, 136, 92)
P_HAIR  = (116, 72, 28);   P_HAIR_D = (80, 48, 16)
P_TUNIC = (60, 146, 64);   P_TUNIC_M = (40, 112, 44);  P_TUNIC_D = (26, 82, 30)
P_BELT  = (118, 72, 24)
P_PANT  = (88, 56, 20);    P_PANT_D = (62, 36, 10)
P_BOOT  = (52, 30, 12)
P_SWORD = (224, 228, 240); P_SWORD_M = (168, 172, 192); P_SWORD_D = (108, 112, 136)
P_SHLD  = (180, 44, 44);   P_SHLD_D = (128, 24, 24);   P_SHLD_Y = (240, 204, 44)
P_EYE   = (20, 20, 40)
P_CROWN = (252, 216, 0);   P_CROWN_D = (172, 132, 0)
S_HELM  = (112, 116, 128); S_HELM_D = (76, 80, 92)

# -- 士兵（蓝军装）--
S_SKIN  = (240, 200, 160); S_SKIN_D = (192, 144, 96)
S_UNI   = (72, 104, 152);  S_UNI_D = (48, 72, 112)
S_BOOT  = (56, 32, 12)
S_GUN   = (96, 96, 104);   S_GUN_D = (56, 56, 64)
S_EYE   = (16, 16, 20)


def px(d, x, y, w, h, c):
    if c == TRANSP or w < 1 or h < 1: return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

def rect(d, x, y, w, h, col):
    px(d, x, y, w, h, col)


# ============================================================
#  ZOMBIE PVZ 风格（侧脸行走！） 72×128 帧 × 3
# ============================================================
def profile_head(d, cx, top, variant):
    """侧脸（面朝右）PVZ 丧尸：鼻尖凸→嘴前凸→下巴收→后脑勺圆
       一眼、额顶乱发、颧骨黄腐斑+嘴角流血、牙齿参差外露"""
    hw, hh = 34, 36
    # 鼻尖在前边（画面右侧），头稍向画面右侧偏移 —— 鼻尖在 cx+16，后脑在 cx-18
    # 头整体左右边界 cx-18 ~ cx+16 共 34 宽
    hx_left  = cx - 18
    hx_right = cx + 16   # 鼻尖在这条线右边突出
    hy = top
    tilt = {'A': -1, 'B': 1, 'L': -3}[variant]  # 走歪头，attack 大歪
    hy_tilt = hy + tilt

    # ------------ 头部轮廓侧面（从上到下描一圈，填充绿皮）-----------
    # 后脑侧轮廓（左侧，从额头 top 往下顺耳后→颚）
    skull_profile = [
        # (offset_x_from_cx,  length,  top_offset)  => 画 vertical 段
        (-18, 10, 0),   # 后脑最凹后：额头到耳上
        (-19, 6,  10),  # 枕骨突出
        (-18, 8,  16),  # 耳后回收
        (-17, 8,  24),  # 颚
        (-16, 4,  32),  # 下巴左侧收
    ]
    for ox, ln, topy in skull_profile:
        px(d, cx+ox, hy_tilt + topy, 1, ln, OUTLINE)
        px(d, cx+ox + 1, hy_tilt + topy, 1, ln, PVZ_SKIN)
    # 头顶（一条弧形，画短垂直段模拟头顶半圆）
    top_arc = [
        (-15, 4), (-12, 6), (-9, 8), (-6, 9), (-3, 10),
        (0, 10),   (3, 10),  (6, 9),  (9, 8),  (12, 7),
    ]
    for ox, h in top_arc:
        px(d, cx + ox, hy_tilt - h - 1, 1, 1, OUTLINE)
        for yy in range(h):
            px(d, cx + ox, hy_tilt - h + yy, 1, 1, PVZ_HAIR)
    # 额到眉（顶部向下填充为皮肤，发梢在前额）
    for x in range(-16, 14):
        for y in range(0, 8):
            if x < -6 and y < 3:
                continue
            if (x, y) == (-10, 2):
                continue
            px(d, cx + x, hy_tilt + y, 1, 1, PVZ_SKIN)
    # 面部前侧（右侧）轮廓：从眉骨→鼻→鼻尖→鼻翼→上唇→下唇→下巴
    face_profile = [
        # 列，高度(从上到下数), 起始 y
        (12, 4,  5),   # 额/眉骨向前伸
        (13, 3,  9),   # 鼻梁起
        (15, 2,  12),  # 鼻尖高点
        (16, 2,  14),  # 鼻尖最高点（凸）
        (15, 2,  16),  # 鼻翼下收
        (13, 3,  18),  # 人中 - 上唇后收
        (14, 6,  21),  # 嘴唇/嘴前凸（PVZ 龇牙咧嘴）
        (12, 3,  27),  # 下唇收
        (10, 4,  30),  # 下巴（短）
        (7,  2,  34),  # 下巴尖收
    ]
    for ox, ln, topy in face_profile:
        px(d, cx+ox, hy_tilt + topy, 1, ln, OUTLINE)
        # 在该列的左侧（直到后脑列）都填绿皮。偷懒做法：直接填从左脑边界到此列
        x_start = cx - 17 if topy < 10 else cx - 16
        for xx in range(x_start, cx+ox):
            if xx == cx - 17 and topy < 10: continue
            if d and 0: pass  # noop
            px(d, xx, hy_tilt + topy, 1, ln, PVZ_SKIN)
    # 脖子后方（头部与西装之间）
    for dy in range(4):
        px(d, cx - 17, hy_tilt + hh - 4 + dy, 1, 1, OUTLINE)
        px(d, cx - 16, hy_tilt + hh - 4 + dy, 1, 1, PVZ_SKIN)
        px(d, cx - 15, hy_tilt + hh - 4 + dy, 1, 1, PVZ_SKIN_M)

    # ------------ 细节：一眼（侧面椭圆） + 鼻 + 牙齿 + 腐斑 ----------
    # 耳（后上方）
    ear_x, ear_y = cx - 12, hy_tilt + 14
    px(d, ear_x-1, ear_y-1, 6, 8, OUTLINE)
    px(d, ear_x,   ear_y,   4, 6, PVZ_SKIN)
    px(d, ear_x,   ear_y,   4, 1, PVZ_SKIN_M)
    px(d, ear_x+1, ear_y+2, 2, 3, OUTLINE)
    # 头发乱缕（后脑稀疏秃发 + 额前一撮）
    for (ox,h) in [(-16,2),(-13,3),(-9,2),(-6,4),(-3,3),(3,2),(6,2),(9,1),(11,1)]:
        px(d, cx+ox, hy_tilt - h - 2, 1, h+2, PVZ_HAIR)
        px(d, cx+ox, hy_tilt - h - 3, 1, 1, OUTLINE)

    # 眼（只有一只，侧面，稍扁）
    eye_x, eye_y = cx + 2, hy_tilt + 11
    if variant == 'L':  # 攻击：更大 + 血丝
        px(d, eye_x-1, eye_y-1, 8, 7, OUTLINE)
        px(d, eye_x,   eye_y,   6, 5, PVZ_EYE)
        px(d, eye_x+3, eye_y+2, 2, 2, PVZ_EYE_W)
        # 血丝
        for dy in range(4):
            px(d, eye_x-2+dy, eye_y+dy, 1, 1, PVZ_BLD)
    else:
        px(d, eye_x,   eye_y,   6, 5, OUTLINE)
        px(d, eye_x+1, eye_y+1, 4, 3, PVZ_EYE)
        px(d, eye_x+3, eye_y+1, 2, 2, PVZ_EYE_W)
        px(d, eye_x+3, eye_y+2, 1, 1, (0,0,0))  # 小瞳孔点

    # 鼻（侧面：鼻梁+鼻尖+鼻孔）
    px(d, cx+10, hy_tilt+14, 1, 4, PVZ_SKIN_M)  # 鼻梁阴影
    px(d, cx+11, hy_tilt+15, 1, 3, PVZ_SKIN_M)
    px(d, cx+13, hy_tilt+17, 2, 1, PVZ_SKIN_D)  # 鼻尖下
    px(d, cx+14, hy_tilt+18, 2, 2, OUTLINE)     # 鼻孔黑
    px(d, cx+14, hy_tilt+19, 1, 1, (0,0,0))

    # 颧骨大腐斑（芥末黄）+ 嘴角血滴
    rot_x, rot_y = cx + 4, hy_tilt + 20
    px(d, rot_x-1, rot_y-1, 10, 1, OUTLINE)
    px(d, rot_x-1, rot_y,   1,  7, OUTLINE)
    px(d, rot_x+9, rot_y,   1,  7, OUTLINE)
    px(d, rot_x-1, rot_y+7, 10, 1, OUTLINE)
    px(d, rot_x,   rot_y,   8,  7, PVZ_ROT)
    px(d, rot_x,   rot_y,   8,  2, PVZ_ROT_D)
    # 血滴（从嘴下滴到下巴）
    for dy,col in [(0,PVZ_BLD),(1,PVZ_BLD),(2,PVZ_BLD),(3,PVZ_BLD),(4,PVZ_BLD_D)]:
        px(d, cx+11, hy_tilt+28+dy, 1, 1, col)
    for dy,col in [(1,PVZ_BLD),(2,PVZ_BLD),(3,PVZ_BLD_D)]:
        px(d, cx+12, hy_tilt+28+dy, 1, 1, col)

    # 嘴 & 牙齿（侧面大龇牙，参差黄牙）
    mouth_y = hy_tilt + 23
    # 嘴唇外框
    px(d, cx+10, mouth_y-1,   7, 1, OUTLINE)
    px(d, cx+9,  mouth_y,     1, 6, OUTLINE)
    px(d, cx+16, mouth_y,     1, 6, OUTLINE)
    px(d, cx+10, mouth_y+6,   7, 1, OUTLINE)
    px(d, cx+10, mouth_y,     6, 6, (40,20,20))  # 口腔暗
    if variant == 'L':  # attack：露大牙 + 咬
        for (ox,w,h,col) in [
            (10,1,3,PVZ_TOOTH),(11,2,4,PVZ_TOOTH),(13,1,2,PVZ_TOOTH_D),
            (14,2,5,PVZ_TOOTH),
        ]:
            px(d, cx+ox, mouth_y-1, w, h, col); px(d, cx+ox, mouth_y-1, w, 1, PVZ_TOOTH_D)
        for (ox,w,h,col) in [
            (10,2,2,PVZ_TOOTH),(12,1,3,PVZ_TOOTH_D),(13,2,3,PVZ_TOOTH),(15,1,2,PVZ_TOOTH),
        ]:
            px(d, cx+ox, mouth_y+4, w, h, col); px(d, cx+ox, mouth_y+4, w, 1, PVZ_TOOTH_D)
    else:
        # walk：上下交错尖牙（像 PVZ 走路时牙齿一张一合）
        if variant == 'A':
            for (ox,w,h,col) in [(10,1,3,PVZ_TOOTH),(12,2,3,PVZ_TOOTH),(15,1,2,PVZ_TOOTH_D)]:
                px(d, cx+ox, mouth_y, w, h, col); px(d, cx+ox, mouth_y, w, 1, PVZ_TOOTH_D)
        else:  # B 帧：牙齿在下部
            for (ox,w,h,col) in [(11,2,3,PVZ_TOOTH),(14,1,2,PVZ_TOOTH_D),(15,1,2,PVZ_TOOTH)]:
                px(d, cx+ox, mouth_y+3, w, h, col); px(d, cx+ox, mouth_y+3, w, 1, PVZ_TOOTH_D)

    return hy_tilt + hh  # head_bottom（下巴底）


def profile_body(d, cx, hb, variant):
    """侧脸身体（面朝右）：
       - 近肩（右）比远肩（左）靠前且稍大
       - 西装翻领在右侧近景可见
       - 手臂：近（右）手在前摆动 / 远（左）手在后被身体遮挡
       - 两腿交替前后（侧面步姿有交错差）
       - attack：前弓步 + 前手抓扑，指甲向前伸"""
    bw = 26; bx = cx - bw//2 - 2     # 身体整体略向画面左（后脑方向）偏，让右肩（近侧）有空间向前
    body_shift = {'A':-1,'B':1,'L':2}[variant]
    bx_b = bx + body_shift          # 身体 X 基准
    jt = hb + 2; jh = 28            # 衣身起 y / 高

    # 脖子（侧面可见一条从后脑到西装领）
    neck_x = cx - 15
    px(d, neck_x-1, hb-1, 8, 1, OUTLINE)
    px(d, neck_x,   hb,   7, 4, PVZ_SKIN)
    px(d, neck_x,   hb+1, 7, 1, PVZ_SKIN_M)
    # 领带（侧，只显示一小段）
    tie_x = cx + 1
    px(d, tie_x-1, hb+4, 4, 3, OUTLINE)
    px(d, tie_x,   hb+4, 3, 2, PVZ_TIE)
    px(d, tie_x-1, hb+7, 6, 1, OUTLINE)
    px(d, tie_x,   hb+7, 4, 16, PVZ_TIE)
    px(d, tie_x+2, hb+7, 2, 16, PVZ_SUIT_D)

    # 西装（侧面：背平直、前面略凸，单扣）
    # 后背线
    for y in range(jh+6):
        px(d, bx_b-1, jt+y, 1, 1, OUTLINE)
        px(d, bx_b,   jt+y, 1, 1, PVZ_SUIT_D if y < jh else PVZ_PANT_D)
    # 前襟线（近侧）
    front_x = bx_b + bw + 2
    for y in range(jh+4):
        # 前襟有 2 段凸：胸 + 腹
        bulge = 0
        if 6 < y < 16: bulge = 1
        if y > 22:   bulge = -1
        px(d, front_x + bulge, jt+y, 1, 1, OUTLINE)
        px(d, front_x + bulge - 1, jt+y, 1, 1, PVZ_SUIT)
    # 顶部线（肩）+ 底部线（下摆）
    for x in range(bx_b - 1, front_x + 3):
        px(d, x, jt - 1, 1, 1, OUTLINE)
        px(d, x, jt,      1, 1, PVZ_SUIT_D if x < cx else PVZ_SUIT)
        px(d, x, jt + jh + 3, 1, 1, OUTLINE)
        if x > bx_b and x < front_x + 2:
            px(d, x, jt + jh, 1, 1, PVZ_SUIT_D)
    # 翻领（近侧一条斜线，三角形）
    for i in range(8):
        px(d, cx + i, jt + 2 + i, 1, 1, PVZ_SUIT_D)
        px(d, cx + 1 + i, jt + 2 + i, 1, 1, PVZ_SHIRT)
    # 衬衫（领口下白色小三角，侧面缩窄）
    for i in range(10):
        px(d, cx + 2, jt + 4 + i, 6 - i//3, 1, PVZ_SHIRT)
    # 西装大扣（侧面 1 个）
    px(d, cx - 5, jt + 18, 4, 3, OUTLINE)
    px(d, cx - 4, jt + 19, 2, 1, (200,180,120))

    # 破洞 & 血迹
    # 肩破（近肩）
    px(d, front_x - 5, jt + 2, 7, 5, OUTLINE)
    px(d, front_x - 4, jt + 3, 5, 3, PVZ_SKIN_D)
    for (ox, oy, c) in [(front_x - 4, jt + 3, PVZ_BLD), (front_x - 2, jt + 5, PVZ_BLD)]:
        px(d, ox, oy, 1, 1, c)
    # 下摆锯齿撕裂
    for i in range(3):
        px(d, bx_b + 4 + i*9, jt + jh + 1, 3, 5, TRANSP)
        px(d, bx_b + 4 + i*9, jt + jh + 1, 1, 5, OUTLINE)
        px(d, bx_b + 6 + i*9, jt + jh + 1, 1, 5, OUTLINE)
    # 西装正面血滴飞溅
    for (ox_rel, oy_rel, c) in [(4,6,PVZ_BLD),(5,8,PVZ_BLD),(9,14,PVZ_BLD_D),(13,10,PVZ_BLD),(14,12,PVZ_BLD)]:
        px(d, bx_b + bw - 2 + ox_rel//2, jt + oy_rel, 1, 1, c)

    # ---- 手臂（侧脸：近手在右前方，远手在左后方被遮小一部分） ----
    ay = jt + 4
    if variant == 'A':
        near_arm = ((front_x + 1, ay - 1, 5, 8),  (front_x + 5, ay + 3,  6, 18))
        far_arm  = ((bx_b - 4,   ay + 2, 5, 7),  (bx_b - 9,   ay + 7,  6, 14))
    elif variant == 'B':
        near_arm = ((front_x + 0, ay + 1, 5, 7),  (front_x + 3, ay + 5,  6, 17))
        far_arm  = ((bx_b - 4,   ay - 1, 5, 8),  (bx_b - 10,  ay + 4,  6, 17))
    else:  # L 攻击：近手大力前扑（指甲突出）
        near_arm = ((front_x + 2, ay - 3, 6, 9),  (front_x + 11, ay + 2,  9, 24))
        far_arm  = ((bx_b - 6,   ay - 2, 5, 8),  (bx_b - 14,  ay + 2,  7, 18))
    for (sx, sy, sw, sh), (ux, uy, uw, uh) in [near_arm, far_arm]:
        rect(d, sx-1, sy-1, sw+2, sh+2, OUTLINE)
        rect(d, sx, sy, sw, sh, PVZ_SUIT_D if (variant == 'B' and sx < cx) else PVZ_SUIT)
        rect(d, ux-1, uy-1, uw+2, uh+2, OUTLINE)
        rect(d, ux, uy, uw, uh, PVZ_SKIN)
        rect(d, ux, uy, uw, 1, PVZ_SKIN_M)
        rect(d, ux, uy+uh-3, uw, 3, PVZ_SKIN_M)
        # 手 + 指甲
        hx_, hy_ = ux, uy + uh
        if variant == 'L':
            rect(d, hx_-2, hy_-1, uw+4, 9, OUTLINE)
            rect(d, hx_-1, hy_, uw+2, 7, PVZ_SKIN)
            # 指甲向前（右）突出 —— 侧面攻击爪
            for (ox, ow, oh, col) in [(uw,2,5,PVZ_NAIL),(uw+1,1,4,PVZ_NAIL_D)]:
                px(d, hx_+ox, hy_+3, ow, oh, col); px(d, hx_+ox, hy_+3, ow, 1, PVZ_NAIL_D)
            for (ox, ow, oh, col) in [(2,2,4,PVZ_NAIL_D),(5,2,3,PVZ_NAIL)]:
                px(d, hx_+ox, hy_+6, ow, oh, col)
        else:
            rect(d, hx_-1, hy_-1, uw+2, 7, OUTLINE)
            rect(d, hx_, hy_, uw, 5, PVZ_SKIN)
            # 2~3 根指甲向前（右）
            for (ox, ow, oh) in [(uw,1,3),(uw-2,1,2)]:
                px(d, hx_+ox, hy_+3, ow, oh, PVZ_NAIL); px(d, hx_+ox, hy_+3, ow, 1, PVZ_NAIL_D)
            if variant == 'A':
                px(d, hx_+1, hy_+4, 1, 2, PVZ_NAIL_D)

    # ---- 裤腿（侧面步姿：两脚在 X 方向前后错开 + 纵向高低差） ----
    pt = jt + jh + 1; ph = 32; lw = bw//2
    if variant == 'A':    # 前右脚（近前），后左脚（远后）
        # 前腿（近）: x 靠近 front_x ，稍长
        leg_fx, leg_fy = front_x - 8, pt
        rect(d, leg_fx-1, leg_fy-1, lw+1, 12, OUTLINE); px(d, leg_fx, leg_fy, lw-1, 11, PVZ_PANT)
        rect(d, leg_fx-2, leg_fy+10, lw+2, 15, OUTLINE); px(d, leg_fx-1, leg_fy+11, lw+1, 14, PVZ_PANT_D)
        fx_f, fy_f = leg_fx - 3, pt + ph - 5
        rect(d, fx_f-1, fy_f-1, lw+6, 7, OUTLINE); px(d, fx_f, fy_f, lw+5, 5, PVZ_SUIT); px(d, fx_f, fy_f+5, lw+5, 1, OUTLINE)
        # 后腿（远）: x 靠近 bx_b，略短略高（离地假象）
        leg_rx, leg_ry = bx_b + 2, pt + 2
        rect(d, leg_rx-1, leg_ry-1, lw, 10, OUTLINE); px(d, leg_rx, leg_ry, lw-1, 9, PVZ_PANT_D)
        fx_r, fy_r = leg_rx - 1, pt + ph - 2
        rect(d, fx_r-1, fy_r-1, lw+1, 5, OUTLINE); px(d, fx_r, fy_r, lw, 3, PVZ_SUIT_D)
    elif variant == 'B':  # 前左脚（远前），后右脚（近后）—— 侧身换脚
        leg_fx, leg_fy = bx_b + 3, pt
        rect(d, leg_fx-1, leg_fy-1, lw, 12, OUTLINE); px(d, leg_fx, leg_fy, lw-1, 11, PVZ_PANT)
        rect(d, leg_fx-2, leg_fy+10, lw+1, 15, OUTLINE); px(d, leg_fx-1, leg_fy+11, lw, 14, PVZ_PANT_D)
        fx_f, fy_f = leg_fx - 3, pt + ph - 5
        rect(d, fx_f-1, fy_f-1, lw+5, 7, OUTLINE); px(d, fx_f, fy_f, lw+4, 5, PVZ_SUIT)
        # 后腿（近后，右脚）
        leg_rx, leg_ry = front_x - 7, pt + 2
        rect(d, leg_rx-1, leg_ry-1, lw+1, 10, OUTLINE); px(d, leg_rx, leg_ry, lw, 9, PVZ_PANT_D)
        fx_r, fy_r = leg_rx - 2, pt + ph - 2
        rect(d, fx_r-1, fy_r-1, lw+3, 5, OUTLINE); px(d, fx_r, fy_r, lw+2, 3, PVZ_SUIT_D)
    else:  # L 攻击弓步：前腿（近）屈膝弓步 90°，后腿蹬地
        leg_fx, leg_fy = front_x - 9, pt
        rect(d, leg_fx-2, leg_fy-2, lw+3, 14, OUTLINE); px(d, leg_fx-1, leg_fy-1, lw+2, 13, PVZ_PANT)
        # 小腿向前折 90°（水平伸出）
        shin_x, shin_y = leg_fx + 2, pt + 14
        rect(d, shin_x-1, shin_y-1, lw+8, 6, OUTLINE); px(d, shin_x, shin_y, lw+7, 4, PVZ_PANT_D)
        fx_f, fy_f = shin_x + lw + 5, pt + ph - 6
        rect(d, fx_f-1, fy_f-1, lw+6, 8, OUTLINE); px(d, fx_f, fy_f, lw+5, 6, PVZ_SUIT)
        px(d, fx_f, fy_f+6, lw+5, 1, OUTLINE)
        # 后腿（远）斜直蹬
        leg_rx, leg_ry = bx_b + 3, pt + 3
        rect(d, leg_rx-1, leg_ry-1, lw, 14, OUTLINE); px(d, leg_rx, leg_ry, lw-1, 13, PVZ_PANT_D)
        fx_r, fy_r = leg_rx - 4, pt + ph - 1
        rect(d, fx_r-1, fy_r-1, lw+3, 5, OUTLINE); px(d, fx_r, fy_r, lw+2, 3, PVZ_SUIT_D)

    # 裤子破洞 + 露骨（小腿各一个）
    for (lx_, ly_, lw_, lh_) in [(front_x - 7, pt+16, 4, 3), (bx_b + 4, pt+20, 4, 3)]:
        px(d, lx_-1, ly_-1, lw_+2, 1, OUTLINE)
        px(d, lx_-1, ly_,   1,    lh_, OUTLINE)
        px(d, lx_+lw_, ly_,  1,   lh_, OUTLINE)
        px(d, lx_-1, ly_+lh_, lw_+2, 1, OUTLINE)
        px(d, lx_,   ly_,   lw_,   lh_, PVZ_SKIN_D)
        px(d, lx_+1, ly_+1, lw_-2, 1,   (230, 224, 180))


def render_zombie_sheet(path):
    FW, FH = 72, 128
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['A', 'B', 'L']):
        cx = fi*FW + FW//2
        hb = profile_head(d, cx, 6, v)
        profile_body(d, cx, hb, v)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    valid = 10 <= fw <= 200 and 10 <= img.size[1] <= 200
    print(f"🧟 zombie(PVZ-profile): {img.size}  frame {fw:.0f}x{img.size[1]}  valid={valid}")


# ============================================================
#  PLAYER  80×108 × 3（idle/walk/attack，剑完整入帧）
# ============================================================
def player_head(d, cx, top, level=1):
    hw, hh = 18, 18
    hx, hy = cx - hw//2, top
    # 头顶轮廓
    px(d, hx, hy-1, hw, 1, OUTLINE)
    for i, h in [(2,2),(3,3),(4,4),(5,5),(6,5),(11,5),(12,5),(13,4),(14,3),(15,2)]:
        px(d, hx+i, hy-h-1, 1, 1, OUTLINE)
        px(d, hx+i, hy-h, 1, h, P_HAIR_D)
    px(d, hx-1, hy, 1, hh, OUTLINE)
    px(d, hx+hw, hy, 1, hh, OUTLINE)
    px(d, hx+1, hy, hw-2, hh-1, P_SKIN)
    px(d, hx+1, hy, hw-2, 1, P_HAIR)
    px(d, hx, hy+hh-2, hw, 1, OUTLINE)
    px(d, hx+1, hy+hh-2, hw-2, 1, P_SKIN_D)
    # 皇冠 / 头盔
    if level >= 4:
        for (ox,w,h,col,edge) in [(2,2,4,P_CROWN,P_CROWN_D),(6,2,5,P_CROWN,P_CROWN_D),(10,2,4,P_CROWN,P_CROWN_D),(14,2,3,P_CROWN,P_CROWN_D)]:
            px(d, hx+ox, hy-h-1, w, h, col)
            px(d, hx+ox, hy-h-1, w, 1, edge)
    elif level == 3:
        # 红羽头盔
        px(d, hx, hy-5, hw, 5, OUTLINE)
        px(d, hx+1, hy-4, hw-2, 4, S_HELM)
        px(d, hx+1, hy-4, hw-2, 1, S_HELM_D)
        px(d, hx+hw//2-1, hy-9, 2, 5, OUTLINE)
        px(d, hx+hw//2-1, hy-9, 2, 4, P_SHLD)
    elif level == 2:
        pass
    else:
        px(d, hx+3, hy, 14, 2, OUTLINE)
        px(d, hx+4, hy+1, 12, 1, P_HAIR_D)
    # 脸
    px(d, hx+2, hy+9, hw-4, 2, P_SKIN_M)
    px(d, hx+5, hy+10, 2, 2, P_EYE); px(d, hx+5, hy+10, 1, 1, (255,255,255))
    px(d, hx+12, hy+10, 2, 2, P_EYE); px(d, hx+12, hy+10, 1, 1, (255,255,255))
    px(d, hx+8, hy+14, 4, 1, OUTLINE)
    px(d, hx+9, hy+15, 2, 1, P_SKIN_D)
    return hy + hh + 1

def player_body(d, cx, hb, variant, level=1):
    """variant: idle / walk / attack；攻击帧武器完全在 80 宽帧内（帧中央 cx，武器向右最多延伸到 cx+36，帧右 cx+40）"""
    bw = 28; bx = cx - bw//2
    tunic_top = hb + 3; tunic_h = 24
    # 颈
    px(d, cx-4, hb-1, 10, 5, OUTLINE); px(d, cx-3, hb, 8, 4, P_SKIN)
    # 外衣
    px(d, bx-2, tunic_top-1, bw+4, 1, OUTLINE)
    px(d, bx-2, tunic_top,   1, tunic_h+3, OUTLINE)
    px(d, bx+bw+1, tunic_top, 1, tunic_h+3, OUTLINE)
    px(d, bx, tunic_top+tunic_h+2, bw, 1, OUTLINE)
    px(d, bx-1, tunic_top, bw+2, tunic_h+2, P_TUNIC)
    px(d, bx,   tunic_top+tunic_h, bw, 2, P_TUNIC_M)
    px(d, cx-5, tunic_top, 10, 6, P_TUNIC_M)
    px(d, cx-4, tunic_top, 8, 1, OUTLINE)
    # 肩阴影
    px(d, bx-1, tunic_top, 1, 6, P_TUNIC_D); px(d, bx+bw, tunic_top, 1, 6, P_TUNIC_D)
    px(d, cx-1, tunic_top+6, 2, tunic_h-8, P_TUNIC_D)
    # 腰带
    belt_y = tunic_top + tunic_h - 5
    px(d, bx-2, belt_y-1, bw+4, 5, OUTLINE)
    px(d, bx-1, belt_y, bw+2, 3, P_BELT)
    px(d, cx-2, belt_y, 4, 3, P_CROWN); px(d, cx-2, belt_y, 4, 1, P_CROWN_D)

    # 盾牌（idle/walk 挂左侧，attack 抬前）
    def draw_shield(x, y):
        px(d, x-1, y-1, 10, 12, OUTLINE); px(d, x, y, 8, 10, P_SHLD)
        px(d, x, y, 8, 1, P_SHLD_D); px(d, x+1, y+9, 6, 1, P_SHLD_D)
        px(d, x+3, y+2, 2, 6, P_SHLD_Y); px(d, x+1, y+4, 6, 2, P_SHLD_Y)

    ay = tunic_top + 2
    if variant == 'idle':
        # 左臂（带盾）
        rect(d, bx-3, ay, 5, 10, OUTLINE); rect(d, bx-2, ay+1, 3, 8, P_TUNIC_M)
        rect(d, bx-4, ay+8, 6, 7, OUTLINE); rect(d, bx-3, ay+9, 4, 5, P_SKIN)
        draw_shield(bx - 6, tunic_top + 8)
        # 右臂
        rect(d, bx+bw-1, ay, 5, 10, OUTLINE); rect(d, bx+bw, ay+1, 3, 8, P_TUNIC_M)
        rect(d, bx+bw-2, ay+8, 6, 7, OUTLINE); rect(d, bx+bw-1, ay+9, 4, 5, P_SKIN)
    elif variant == 'walk':
        # 左前右后
        rect(d, bx-4, ay+1, 5, 8, OUTLINE); rect(d, bx-3, ay+2, 3, 6, P_TUNIC_M)
        rect(d, bx-6, ay+7, 6, 9, OUTLINE); rect(d, bx-5, ay+8, 4, 7, P_SKIN)
        rect(d, bx+bw, ay+1, 5, 8, OUTLINE); rect(d, bx+bw+1, ay+2, 3, 6, P_TUNIC_M)
        rect(d, bx+bw, ay+8, 6, 9, OUTLINE); rect(d, bx+bw+1, ay+9, 4, 7, P_SKIN)
    else:  # attack: 左手盾在前，右手剑向前伸（全长 ≤ 76，帧右 cx+40 还有 4px 余量）
        # 左（盾前）
        rect(d, bx-5, ay-2, 6, 9, OUTLINE); rect(d, bx-4, ay-1, 4, 7, P_TUNIC_M)
        draw_shield(bx - 11, ay - 3)
        # 右（挥剑：胳膊水平前伸）
        rect(d, bx+bw-1, ay-2, 6, 9, OUTLINE); rect(d, bx+bw, ay-1, 4, 7, P_TUNIC_M)
        rect(d, bx+bw+3, ay+2, 6, 8, OUTLINE); rect(d, bx+bw+4, ay+3, 4, 6, P_SKIN)
        # 剑柄（向右继续）
        hilt_x = bx + bw + 8;  hilt_y = ay + 6
        rect(d, hilt_x-1, hilt_y-2, 9, 6, OUTLINE)
        rect(d, hilt_x,   hilt_y-1, 8, 4, P_BELT)
        px(d,   hilt_x-2, hilt_y-4, 12, 3, OUTLINE)
        px(d,   hilt_x-1, hilt_y-4, 10, 2, P_CROWN)
        # 剑身（向右，22 像素长）—— 帧边界：cx+40，剑身末端 hilt_x+8+22 = hilt_x+30 = cx + 4 + 30 = cx + 34 ≤ cx+40 ✅
        blade_x = hilt_x + 8
        rect(d, blade_x-1, hilt_y-3, 26, 7, OUTLINE)
        rect(d, blade_x,   hilt_y-2, 24, 5, P_SWORD)
        rect(d, blade_x,   hilt_y-2, 24, 1, (255,255,255))
        rect(d, blade_x,   hilt_y+1, 24, 1, P_SWORD_M)
        rect(d, blade_x,   hilt_y+2, 24, 1, P_SWORD_D)
        # 剑尖（尖）
        px(d, blade_x+24, hilt_y-4, 3, 9, OUTLINE)
        px(d, blade_x+24, hilt_y-3, 2, 7, P_SWORD)
        px(d, blade_x+26, hilt_y-2, 1, 5, P_SWORD_M)
        px(d, blade_x+26, hilt_y-1, 1, 3, P_SWORD_D)

    # 裤腿
    pt = tunic_top + tunic_h - 2; ph = 22; lw = bw//2
    if variant == 'walk':
        lx, rx2 = bx, bx + bw - lw
        rect(d, lx, pt-1, lw, 10, OUTLINE); px(d, lx+1, pt, lw-2, 9, P_PANT)
        rect(d, lx-2, pt+8, lw, 10, OUTLINE); px(d, lx-1, pt+9, lw-2, 9, P_PANT_D)
        fx,fy = lx-3, pt+ph-4
        rect(d, fx-1, fy-1, lw+4, 6, OUTLINE); px(d, fx, fy, lw+3, 4, P_BOOT)
        rect(d, rx2, pt+1, lw-1, 8, OUTLINE); px(d, rx2+1, pt+2, lw-2, 7, P_PANT_D)
        fx2,fy2 = rx2+1, pt+ph-3
        rect(d, fx2-1, fy2-1, lw-1, 5, OUTLINE); px(d, fx2, fy2, lw-2, 3, P_BOOT)
    elif variant == 'attack':
        st = 2
        lx, rx2 = bx-st, bx+bw-lw+st
        for LX, CC in [(lx,P_PANT),(rx2,P_PANT_D)]:
            rect(d, LX, pt-1, lw, 12, OUTLINE); px(d, LX+1, pt, lw-2, 11, CC)
            rect(d, LX+1, pt+10, lw-2, 9, OUTLINE); px(d, LX+2, pt+11, lw-4, 8, CC)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2, 3, P_BOOT)
    else:  # idle
        lx, rx2 = bx, bx + bw - lw
        for LX, CC in [(lx,P_PANT),(rx2,P_PANT_D)]:
            rect(d, LX, pt-1, lw, 10, OUTLINE); px(d, LX+1, pt, lw-2, 9, CC)
            rect(d, LX+1, pt+8, lw-2, 10, OUTLINE); px(d, LX+2, pt+9, lw-4, 9, CC)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2, 3, P_BOOT); px(d, FX, FY+3, lw+2, 1, (20,10,0))

def render_player_sheet(path):
    FW, FH = 80, 108
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['idle','walk','attack']):
        cx = fi*FW + FW//2
        hb = player_head(d, cx, 6, level=3)
        player_body(d, cx, hb, v, level=3)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    print(f"🧝 player(80×108, 剑入帧): {img.size}  frame {fw:.0f}x{img.size[1]}  valid={10<=fw<=200 and 10<=img.size[1]<=200}")


# ============================================================
#  SOLDIER 80×96 × 3（idle/walk/shoot，步枪完整入帧）
# ============================================================
def soldier_head(d, cx, top, variant):
    hw, hh = 18, 18
    hx, hy = cx - hw//2, top
    tilt = {'idle':0,'walk':-1,'shoot':1}[variant]
    hx += tilt
    # 钢盔顶
    top_h = [(2,3),(3,5),(4,6),(5,7),(6,8),(11,8),(12,7),(13,6),(14,5),(15,3)]
    for i, h in top_h:
        px(d, hx+i, hy-h-1, 1, 1, OUTLINE)
        px(d, hx+i, hy-h, 1, h, S_HELM)
    px(d, hx, hy-1, hw, 1, OUTLINE)
    px(d, hx-1, hy, hw+2, 8, OUTLINE)
    px(d, hx, hy+1, hw, 6, S_HELM)
    px(d, hx, hy+1, hw, 1, S_HELM_D)
    px(d, hx-2, hy+5, hw+4, 2, OUTLINE)
    px(d, hx-1, hy+6, hw+2, 1, S_HELM_D)
    # 脸
    fy = hy + 7
    px(d, hx-1, fy-1, hw+2, 1, OUTLINE)
    px(d, hx-1, fy, 1, hh-9, OUTLINE)
    px(d, hx+hw, fy, 1, hh-9, OUTLINE)
    px(d, hx, fy, hw, hh-10, S_SKIN)
    px(d, hx, fy, hw, 1, S_SKIN_D)
    px(d, hx, fy+hh-10, hw, 2, S_SKIN_D)
    px(d, hx-1, fy+hh-9, hw+2, 1, OUTLINE)
    # 眼
    px(d, hx+4, fy+4, 2, 2, S_EYE); px(d, hx+4, fy+4, 1, 1, (255,255,255))
    px(d, hx+11, fy+4, 2, 2, S_EYE); px(d, hx+11, fy+4, 1, 1, (255,255,255))
    return fy + hh - 8

def soldier_body(d, cx, hb, variant):
    bw = 26; bx = cx - bw//2
    jt = hb + 3; jh = 22
    px(d, cx-3, hb-1, 7, 5, OUTLINE); px(d, cx-2, hb, 5, 4, S_SKIN)
    # 军装
    px(d, bx-2, jt-1, bw+4, 1, OUTLINE)
    px(d, bx-2, jt, 1, jh+3, OUTLINE); px(d, bx+bw+1, jt, 1, jh+3, OUTLINE)
    px(d, bx, jt+jh+2, bw, 1, OUTLINE)
    px(d, bx-1, jt, bw+2, jh+2, S_UNI)
    px(d, bx, jt+jh, bw, 2, S_UNI_D)
    px(d, cx-5, jt, 10, 4, S_UNI_D)
    px(d, bx+3, jt+8, 6, 5, OUTLINE); px(d, bx+4, jt+9, 4, 4, S_UNI_D)
    px(d, bx+bw-9, jt+8, 6, 5, OUTLINE); px(d, bx+bw-8, jt+9, 4, 4, S_UNI_D)
    px(d, bx-1, jt+1, 3, 3, OUTLINE); px(d, bx, jt+2, 2, 2, S_HELM)
    px(d, bx+bw-2, jt+1, 3, 3, OUTLINE); px(d, bx+bw-2, jt+2, 2, 2, S_HELM)
    belt_y = jt + jh - 3
    px(d, bx-2, belt_y-1, bw+4, 5, OUTLINE)
    px(d, bx-1, belt_y, bw+2, 3, P_BELT)
    px(d, cx-3, belt_y, 6, 3, P_CROWN); px(d, cx-3, belt_y, 6, 1, P_CROWN_D)

    # 手臂 + 枪（步枪长度 ≤ 36，帧右 cx+40）
    ay = jt + 2
    if variant == 'idle':
        # 左臂
        rect(d, bx-3, ay, 5, 8, OUTLINE); rect(d, bx-2, ay+1, 3, 6, S_UNI_D)
        rect(d, bx-4, ay+7, 5, 6, OUTLINE); rect(d, bx-3, ay+8, 3, 4, S_SKIN)
        # 右臂持枪（枪指向前，枪身 20px 长）
        rect(d, bx+bw-1, ay, 5, 8, OUTLINE); rect(d, bx+bw, ay+1, 3, 6, S_UNI_D)
        rect(d, bx+bw-2, ay+7, 5, 6, OUTLINE); rect(d, bx+bw-1, ay+8, 3, 4, S_SKIN)
        gx, gy = bx + bw + 3, ay + 10
        rect(d, gx-1, gy-1, 20, 5, OUTLINE)
        rect(d, gx, gy, 18, 3, S_GUN); rect(d, gx, gy, 18, 1, S_GUN_D)
        rect(d, gx+18, gy-2, 3, 7, OUTLINE); px(d, gx+18, gy-1, 2, 5, S_GUN_D)
    elif variant == 'walk':
        rect(d, bx-4, ay+1, 5, 6, OUTLINE); rect(d, bx-3, ay+2, 3, 5, S_UNI_D)
        rect(d, bx-6, ay+5, 6, 9, OUTLINE); rect(d, bx-5, ay+6, 4, 7, S_SKIN)
        rect(d, bx+bw, ay+1, 5, 6, OUTLINE); rect(d, bx+bw+1, ay+2, 3, 5, S_UNI_D)
        rect(d, bx+bw, ay+6, 6, 9, OUTLINE); rect(d, bx+bw+1, ay+7, 4, 7, S_SKIN)
        # 枪垂在手下
        gx, gy = bx + bw + 1, ay + 11
        rect(d, gx-1, gy-1, 5, 20, OUTLINE)
        rect(d, gx, gy, 3, 18, S_GUN); rect(d, gx, gy, 3, 1, S_GUN_D)
    else:  # shoot：双手持枪水平瞄准，枪 + 瞄准镜 ≤ 38
        # 左手前托
        rect(d, bx-2, ay-1, 6, 7, OUTLINE); rect(d, bx-1, ay, 4, 5, S_UNI_D)
        # 右手握柄
        rect(d, bx+bw-1, ay-1, 6, 7, OUTLINE); rect(d, bx+bw, ay, 4, 5, S_UNI_D)
        # 前握把（双手位置）
        rect(d, bx+1,   ay+4, 7, 7, OUTLINE); rect(d, bx+2,   ay+5, 5, 5, S_SKIN)
        rect(d, bx+bw-7, ay+4, 7, 7, OUTLINE); rect(d, bx+bw-6, ay+5, 5, 5, S_SKIN)
        # 枪身（从右手再前伸 36px → gx = bx+bw → 末端 = bx+bw+36）
        # cx+40 是帧右，bx = cx-13，bx+bw = cx+13 → 末端 cx+49 ❌ 超出
        # 改成从 bx+8 处开始（双手之间向前）且总长 30：末端 bx+8+30 = cx+25 ✅
        gun_ext = 30
        gx, gy = bx + bw, ay + 6
        # 但 bx+bw+30 = cx-13+26+30 = cx+43，帧右 cx+40，超出 3。改 26：末端 cx+39 ✅
        gun_ext = 26
        rect(d, gx-1, gy-2, gun_ext, 6, OUTLINE)
        rect(d, gx, gy-1, gun_ext-2, 4, S_GUN); rect(d, gx, gy-1, gun_ext-2, 1, (200,200,210))
        rect(d, gx, gy+2, gun_ext-2, 1, S_GUN_D)
        # 瞄准镜
        rect(d, gx+6, gy-5, 5, 4, OUTLINE); px(d, gx+7, gy-4, 3, 2, S_GUN_D)
        # 枪口
        rect(d, gx+gun_ext-2, gy-3, 4, 8, OUTLINE)
        px(d, gx+gun_ext-2, gy-2, 3, 6, S_GUN_D); px(d, gx+gun_ext-1, gy-1, 2, 4, S_GUN)

    # 裤腿
    pt = belt_y + 3; ph = 22; lw = bw//2
    if variant == 'walk':
        lx, rx2 = bx, bx + bw - lw
        rect(d, lx, pt-1, lw, 8, OUTLINE); px(d, lx+1, pt, lw-2, 7, P_PANT)
        rect(d, lx-2, pt+7, lw, 9, OUTLINE); px(d, lx-1, pt+8, lw-2, 8, P_PANT_D)
        fx,fy = lx-3, pt+ph-4
        rect(d, fx-1, fy-1, lw+5, 6, OUTLINE); px(d, fx, fy, lw+4, 4, S_BOOT)
        rect(d, rx2, pt, lw-1, 7, OUTLINE); px(d, rx2+1, pt+1, lw-2, 6, P_PANT_D)
        fx2,fy2 = rx2+1, pt+ph-4
        rect(d, fx2-1, fy2-1, lw-1, 5, OUTLINE); px(d, fx2, fy2, lw-2, 3, S_BOOT)
    else:
        lx, rx2 = bx, bx + bw - lw
        for LX, CC in [(lx,P_PANT),(rx2,P_PANT_D)]:
            rect(d, LX, pt-1, lw, 8, OUTLINE); px(d, LX+1, pt, lw-2, 7, CC)
            rect(d, LX+1, pt+7, lw-2, 9, OUTLINE); px(d, LX+2, pt+8, lw-4, 8, CC)
            FX,FY = LX-1, pt+ph-3
            rect(d, FX-1, FY-1, lw+3, 5, OUTLINE); px(d, FX, FY, lw+2, 3, S_BOOT); px(d, FX, FY+3, lw+2, 1, (20,10,0))

def render_soldier_sheet(path):
    FW, FH = 80, 96
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['idle','walk','shoot']):
        cx = fi*FW + FW//2
        hb = soldier_head(d, cx, 5, v)
        soldier_body(d, cx, hb, v)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    print(f"🪖 soldier(80×96, 枪入帧): {img.size}  frame {fw:.0f}x{img.size[1]}  valid={10<=fw<=200 and 10<=img.size[1]<=200}")


if __name__ == '__main__':
    import os
    BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
    os.makedirs(BASE, exist_ok=True)
    render_zombie_sheet(f'{BASE}/zombie_sprite.png')
    render_player_sheet(f'{BASE}/player_sprite.png')
    render_soldier_sheet(f'{BASE}/soldier_sprite.png')
    print('🎉 3 张精灵图（PVZ 丧尸 + 武器完整入帧玩家/士兵）生成完成')
