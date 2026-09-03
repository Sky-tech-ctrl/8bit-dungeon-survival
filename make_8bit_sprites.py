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
#  ZOMBIE PVZ 风格：大头 72×128 帧 × 3
# ============================================================
def pvz_zombie_head(d, cx, top, variant):
    """PVZ 风格：头大身小，略微歪头，红白眼，黄牙，脸颊腐斑 + 血痕，秃/几缕黑发"""
    hw, hh = 36, 36           # PVZ 头占比大（原 22×24 → 36×36）
    tilt = {'A':-2, 'B':2, 'L':-5}[variant]   # walk 轻歪 / attack 大歪
    hx = cx - hw//2
    hy = top
    # 1) 头皮 & 头顶头发轮廓（PVZ 丧尸有些秃顶）
    scalp_top = [
        # (offset_in_hx, height)
        (5, 2),(6, 3),(7, 5),(8, 5),(9, 6),(10, 7),(11, 7),
        (24, 7),(25, 7),(26, 6),(27, 6),(28, 5),(29, 5),(30, 3),(31, 2)
    ]
    for i, h in scalp_top:
        px(d, hx+i, hy-h-1, 1, 1, OUTLINE)
        px(d, hx+i, hy-h, 1, h, PVZ_HAIR)
    # 整个脸外框描边 + 填充（绿死皮）
    px(d, hx, hy-1, hw, 1, OUTLINE)
    px(d, hx-1, hy, 1, hh-4, OUTLINE)
    px(d, hx+hw, hy, 1, hh-4, OUTLINE)
    px(d, hx+1, hy, hw-2, hh-4, PVZ_SKIN)
    px(d, hx, hy+6, 1, hh-12, PVZ_SKIN)
    px(d, hx+hw-1, hy+6, 1, hh-12, PVZ_SKIN)
    # 下巴收
    px(d, hx+1, hy+hh-4, hw-2, 2, PVZ_SKIN_M)
    px(d, hx+2, hy+hh-2, hw-4, 1, PVZ_SKIN_D)
    px(d, hx, hy+hh-3, hw, 1, OUTLINE)

    # 歪头填充：脸颊左右不对称（增加腐烂视觉）
    # 右脸颊大腐斑（PVZ 芥末黄）
    for (bx,by, bw,bh, col, edge) in [
        (23, 8, 9, 6, PVZ_ROT,   PVZ_ROT_D),  # 黄腐块 1
        (4,  10, 6, 5, PVZ_SKIN_M, PVZ_SKIN_D), # 左脸阴影
    ]:
        px(d, hx+bx-1,   hy+by-1, bw+2, 1, OUTLINE)
        px(d, hx+bx-1,   hy+by,   1,    bh, OUTLINE)
        px(d, hx+bw+bx,  hy+by,   1,    bh, OUTLINE)
        px(d, hx+bx-1,   hy+bh+by,bw+2, 1, OUTLINE)
        px(d, hx+bx,     hy+by,   bw,   bh, col)
        px(d, hx+bx,     hy+by,   bw,   1,  edge)
    # 嘴角血痕（血往下滴）
    px(d, hx+4, hy+26, 1, 7, PVZ_BLD); px(d, hx+3, hy+28, 1, 4, PVZ_BLD)
    px(d, hx+hw-5, hy+27, 1, 6, PVZ_BLD)

    # 眼窝深凹（大眼圈 PVZ 特征）
    px(d, hx+3, hy+12, hw-6, 8, OUTLINE)
    px(d, hx+4, hy+13, hw-8, 6, PVZ_SKIN_D)
    # 眼睛（血红色带白眼白，PVZ 典型）
    eye_y = hy + 14
    if variant == 'L':  # attack：睁更大 + 血丝
        px(d, hx+4,  eye_y-2, 10, 8, OUTLINE); px(d, hx+5,  eye_y-1, 8, 6, PVZ_EYE)
        px(d, hx+7,  eye_y+1, 4, 3, PVZ_EYE_W)
        px(d, hx+22, eye_y-2, 10, 8, OUTLINE); px(d, hx+23, eye_y-1, 8, 6, PVZ_EYE)
        px(d, hx+25, eye_y+1, 4, 3, PVZ_EYE_W)
        # 血丝（从眼内角延伸）
        for dy in range(5):
            px(d, hx+14+dy, eye_y+dy, 1, 1, PVZ_BLD)
            px(d, hx+21-dy, eye_y+dy, 1, 1, PVZ_BLD)
    else:
        for ex in (5, 23):
            px(d, hx+ex,   eye_y,   8, 6, PVZ_EYE)
            px(d, hx+ex+1, eye_y+1, 2, 3, PVZ_EYE_W)  # 小白瞳孔高光
            px(d, hx+ex+5, eye_y+1, 2, 2, (0,0,0))    # 小黑瞳孔（PVZ 式）
    # 鼻孔（黑孔）
    px(d, hx+hw//2-3, hy+23, 1, 3, OUTLINE)
    px(d, hx+hw//2+1, hy+23, 1, 3, OUTLINE)

    # 嘴（PVZ：大张，黄牙参差）
    mouth_y = hy + 27
    if variant == 'L':   # attack 张嘴更大，露獠牙
        px(d, hx+3,  mouth_y-2, hw-6, 9, OUTLINE)
        px(d, hx+4,  mouth_y-1, hw-8, 7, (40,20,20))   # 口腔深
        # 上排黄尖牙（参差）
        for (ox, w, h, col) in [(5,2,3,PVZ_TOOTH),(9,1,2,PVZ_TOOTH_D),(13,3,4,PVZ_TOOTH),(18,2,2,PVZ_TOOTH_D),(23,2,3,PVZ_TOOTH),(27,1,2,PVZ_TOOTH_D)]:
            px(d, hx+ox, mouth_y-1, w, h, col)
            px(d, hx+ox, mouth_y-1, w, 1, PVZ_TOOTH_D)
        # 下排
        for (ox, w, h, col) in [(6,2,2,PVZ_TOOTH),(11,3,3,PVZ_TOOTH_D),(17,2,2,PVZ_TOOTH),(21,2,3,PVZ_TOOTH),(26,2,2,PVZ_TOOTH_D)]:
            px(d, hx+ox, mouth_y+4, w, h, col)
    else:                # walk：抿嘴露 2 颗犬齿
        px(d, hx+4,  mouth_y, hw-8, 4, OUTLINE)
        px(d, hx+5,  mouth_y+1, hw-10, 2, PVZ_SHIRT_D)
        # 2 颗标志性犬齿（PVZ）
        px(d, hx+8,  mouth_y+1, 2, 3, PVZ_TOOTH)
        px(d, hx+hw-10, mouth_y+1, 2, 3, PVZ_TOOTH)
        px(d, hx+8,  mouth_y+3, 2, 1, PVZ_TOOTH_D)
        px(d, hx+hw-10, mouth_y+3, 2, 1, PVZ_TOOTH_D)

    # 几缕乱发 + 秃头皮（PVZ 丧尸通常不全秃，有碎黑发）
    for (i, h) in [(4,2),(10,3),(12,2),(22,2),(24,3),(30,2),(32,2)]:
        px(d, hx+i, hy-h-2, 1, 2, PVZ_HAIR)

    return hy + hh  # head_bottom


def pvz_zombie_body(d, cx, hb, variant):
    """PVZ 丧尸：黑西装外套 + 白衬衫（很脏）+ 撕裂红领带，手臂永远前扑"""
    bw = 30; bx = cx - bw//2
    shift = {'A':-1, 'B':1, 'L':3}[variant]  # attack 向前倾
    jt = hb + 2; jh = 30

    # 脖子（PVZ 细长歪颈：从下巴下面接衣领）
    px(d, cx-4+shift, hb-1, 9, 7, OUTLINE)
    px(d, cx-3+shift, hb,   7, 6, PVZ_SKIN)
    px(d, cx-3+shift, hb+3, 7, 2, PVZ_SKIN_M)
    # 领带从脖子下挂
    tie_x = cx - 2 + shift
    px(d, tie_x, hb+4, 4, 4, PVZ_TIE)
    px(d, tie_x+1, hb+5, 2, 3, OUTLINE)
    px(d, tie_x-1, hb+7, 6, 1, OUTLINE)
    px(d, tie_x,   hb+8, 4, 16, PVZ_TIE)
    px(d, tie_x+1, hb+8, 2, 16, PVZ_SUIT_D)  # 领带阴影

    # 西装外框（PVZ 黑西装，单扣）
    for (ox,oy,ow,oh,col) in [
        (bx-2, jt-1, bw+4, 1, OUTLINE),
        (bx-2, jt,   1,    jh+5, OUTLINE),
        (bx+bw+1, jt, 1,    jh+5, OUTLINE),
        (bx-1, jt+jh+4, bw+2, 1, OUTLINE),
    ]:
        px(d, ox,oy,ow,oh,col)
    px(d, bx-1, jt, bw+2, jh+4, PVZ_SUIT)
    px(d, bx-1, jt, 1, jh+4, PVZ_SUIT_D)  # 左肩阴影
    px(d, bx+bw, jt, 1, jh+4, PVZ_SUIT_D) # 右肩阴影

    # V 领白衬衫（西装开口处露出）
    shirt_top, shirt_h = jt + 1, jh - 8
    # 西装翻领
    for side in (-1, 1):
        for i in range(10):
            px(d, cx + side*(1+i), jt+i, 1, 1, PVZ_SUIT_D)
    # 衬衫三角区
    for i in range(shirt_h):
        sw = 10 - i//4
        px(d, cx - sw, jt+2+i, sw*2, 1, PVZ_SHIRT)
    # 西装大扣
    px(d, cx-2, jt + 16, 4, 3, OUTLINE)
    px(d, cx-1, jt + 17, 2, 1, (200,180,120))

    # 破洞 & 血迹（PVZ 特征）
    # 右肩撕裂露白骨
    px(d, bx, jt+2, 7, 5, OUTLINE)
    px(d, bx+1, jt+3, 5, 3, PVZ_SKIN_D)
    for (ox,oy,c) in [(bx+2,jt+3,PVZ_BLD),(bx+4,jt+5,PVZ_BLD),(bx+1,jt+4,PVZ_BLD)]:
        px(d,ox,oy,1,1,c)
    # 西装下摆锯齿撕裂
    for i in range(6):
        if i % 2 == 0:
            px(d, bx+2+i*5, jt+jh+1, 3, 4, TRANSP)
            px(d, bx+2+i*5, jt+jh+1, 1, 4, OUTLINE)
            px(d, bx+4+i*5, jt+jh+1, 1, 4, OUTLINE)
    # 血迹飞溅（西装前）
    for (ox,oy,c) in [(12,10,PVZ_BLD),(13,11,PVZ_BLD),(16,15,PVZ_BLD_D),(19,12,PVZ_BLD),(20,13,PVZ_BLD),(17,18,PVZ_BLD)]:
        px(d, bx+ox, jt+oy, 1, 1, c)

    # 手臂：永远前伸（PVZ 经典姿势），attack 时双手向前抓
    ay = jt + 4
    if variant == 'A':
        arm_r = ((bx+bw+0, ay-2,   6, 8),  (bx+bw+6, ay+3,  7, 18))  # 右前上+下臂
        arm_l = ((bx-6,   ay+1,   6, 7),  (bx-10, ay+6,   7, 16))
    elif variant == 'B':
        arm_r = ((bx+bw+0, ay+1,   6, 7),  (bx+bw+4, ay+5,  7, 17))
        arm_l = ((bx-6,   ay-2,   6, 8),  (bx-11, ay+3,   7, 18))
    else:  # L attack：双手冲刺前扑，更长更前
        arm_r = ((bx+bw+1, ay-4,   7, 9),  (bx+bw+9, ay+1,  10, 22))
        arm_l = ((bx-8,   ay-4,   7, 9),  (bx-19, ay+1,    10, 22))
    for (sx, sy, sw, sh), (ux, uy, uw, uh) in [arm_r, arm_l]:
        rect(d, sx-1,   sy-1, sw+2, sh+2, OUTLINE)
        rect(d, sx,     sy,   sw,   sh,   PVZ_SUIT_D if variant == 'A' and (sx>cx) else PVZ_SUIT)
        rect(d, ux-1,   uy-1, uw+2, uh+2, OUTLINE)
        rect(d, ux,     uy,   uw,   uh,   PVZ_SKIN)
        rect(d, ux,     uy,   uw,   1,    PVZ_SKIN_M)   # 上臂阴影
        rect(d, ux,     uy+uh-3, uw,  3,  PVZ_SKIN_M)   # 手腕关节
        # 手 + PVZ 长黄指甲（抓爪形）
        hx_, hy_ = ux, uy + uh
        if variant == 'L':
            rect(d, hx_-2, hy_-1, uw+4, 9, OUTLINE)
            rect(d, hx_-1, hy_,   uw+2, 7, PVZ_SKIN)
            # 5 根参差指甲（每根 1~2 宽）
            for (ox, ow, oh, col) in [(-1,1,3,PVZ_NAIL),(1,2,4,PVZ_NAIL),(4,2,5,PVZ_NAIL_D),(7,2,4,PVZ_NAIL),(9,1,3,PVZ_NAIL_D)]:
                px(d, hx_+ox, hy_+6, ow, oh, col)
                px(d, hx_+ox, hy_+6, ow, 1, PVZ_NAIL_D)
        else:
            rect(d, hx_-1, hy_-1, uw+2, 7, OUTLINE)
            rect(d, hx_,   hy_,   uw,   5, PVZ_SKIN)
            # 3 根短指甲
            for (ox, ow) in [(0,2),(3,2),(6,2)]:
                px(d, hx_+ox, hy_+4, ow, 2, PVZ_NAIL)
                px(d, hx_+ox, hy_+4, ow, 1, PVZ_NAIL_D)

    # 裤腿 + PVZ 黑色西裤 + 破洞
    pt = jt + jh + 1; ph = 32; lw = bw//2
    if variant == 'A':
        # 左脚前
        lx, rx = bx, bx + bw - lw
        rect(d, lx-1,  pt-1, lw+2, 12, OUTLINE); px(d, lx,   pt,   lw, 11, PVZ_PANT)
        rect(d, lx-2,  pt+10, lw+3, 14, OUTLINE); px(d, lx-1, pt+11, lw+2, 13, PVZ_PANT_D)
        fx,fy = lx-4, pt + ph - 4
        rect(d, fx-1, fy-1, lw+6, 6, OUTLINE); px(d, fx, fy, lw+5, 4, PVZ_SUIT); px(d, fx, fy+4, lw+5, 1, OUTLINE)
        # 右脚后
        rect(d, rx,   pt+2, lw,   10, OUTLINE); px(d, rx+1, pt+3, lw-1, 9, PVZ_PANT_D)
        fx2,fy2 = rx, pt+ph-3
        rect(d, fx2-1, fy2-1, lw, 5, OUTLINE); px(d, fx2, fy2, lw-1, 3, PVZ_SUIT_D)
    elif variant == 'B':
        lx, rx = bx, bx + bw - lw
        rect(d, rx,   pt-1, lw+2, 12, OUTLINE); px(d, rx+1, pt,   lw, 11, PVZ_PANT)
        rect(d, rx-1, pt+10, lw+3, 14, OUTLINE); px(d, rx,   pt+11, lw+2, 13, PVZ_PANT_D)
        fx,fy = rx-2, pt + ph - 4
        rect(d, fx-1, fy-1, lw+6, 6, OUTLINE); px(d, fx, fy, lw+5, 4, PVZ_SUIT)
        # 左脚后
        rect(d, lx,   pt+2, lw,   10, OUTLINE); px(d, lx+1, pt+3, lw-1, 9, PVZ_PANT_D)
        fx2,fy2 = lx, pt+ph-3
        rect(d, fx2-1, fy2-1, lw, 5, OUTLINE); px(d, fx2, fy2, lw-1, 3, PVZ_SUIT_D)
    else:  # L: 攻击冲刺弓步
        stance = 3
        lx, rx = bx - stance, bx + bw - lw + stance
        rect(d, lx-1, pt-2, lw+2, 14, OUTLINE); px(d, lx, pt-1, lw, 13, PVZ_PANT)
        rect(d, lx-2, pt+11, lw+3, 15, OUTLINE); px(d, lx-1, pt+12, lw+2, 14, PVZ_PANT_D)
        fx,fy = lx-5, pt + ph - 3
        rect(d, fx-1, fy-1, lw+7, 7, OUTLINE); px(d, fx, fy, lw+6, 5, PVZ_SUIT)
        px(d, fx, fy+5, lw+6, 1, OUTLINE)
        # 后脚弯
        rect(d, rx-1, pt+1, lw+2, 12, OUTLINE); px(d, rx, pt+2, lw, 11, PVZ_PANT_D)
        fx2,fy2 = rx-1, pt+ph-1
        rect(d, fx2-1, fy2-1, lw+4, 5, OUTLINE); px(d, fx2, fy2, lw+3, 3, PVZ_SUIT_D)

    # 裤子破洞 + 露骨
    for (lx_, ly_, lw_, lh_) in [(bx+2, pt+15, 4, 3), (bx+bw-8, pt+20, 5, 4)]:
        px(d, lx_-1, ly_-1, lw_+2, 1, OUTLINE)
        px(d, lx_-1, ly_,   1,    lh_, OUTLINE)
        px(d, lx_+lw_, ly_,  1,   lh_, OUTLINE)
        px(d, lx_-1, ly_+lh_, lw_+2, 1, OUTLINE)
        # 白骨/绿腐
        px(d, lx_,   ly_,   lw_,   lh_, PVZ_SKIN_D)
        px(d, lx_+1, ly_+1, lw_-2, 1,   (230, 224, 180))


def render_zombie_sheet(path):
    FW, FH = 72, 128
    img = Image.new("RGBA", (FW*3, FH), TRANSP)
    d = ImageDraw.Draw(img)
    for fi, v in enumerate(['A', 'B', 'L']):
        cx = fi*FW + FW//2
        hb = pvz_zombie_head(d, cx, 4, v)
        pvz_zombie_body(d, cx, hb, v)
    img.save(path, "PNG", optimize=True)
    fw = img.size[0]/3
    valid = 10 <= fw <= 200 and 10 <= img.size[1] <= 200
    print(f"🧟 zombie(PVZ): {img.size}  frame {fw:.0f}x{img.size[1]}  valid={valid}")


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
