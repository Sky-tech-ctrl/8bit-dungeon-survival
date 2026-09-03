"""
PVZ 风格丧尸精灵图生成器（基于 AI 生成的 pvz_zombie_src.jpg 抠图 + 3 帧差异合成）
  - 输出 3 帧 72×128 sprite（zombie_sprite.png 216×128）
  - 严格合规：72/128 均 ≤ 200 → spriteValid=True
  - 帧语义：frame0 walkA / frame1 walkB / frame2 attack lunge
"""
from PIL import Image
import os, sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
SRC = f'{BASE}/pvz_zombie_src.jpg'
OUT = f'{BASE}/zombie_sprite.png'
FW, FH = 72, 128

# 阈值：亮度 >= 250 的像素当作白底去掉（变成完全透明）
WHITE_THR = 250

def remove_white_bg(im, thr=WHITE_THR):
    """把 (>=thr,>=thr,>=thr) 的近白像素 alpha 置 0，其余保留"""
    im = im.convert('RGBA')
    pxdata = list(im.getdata())
    new = []
    for r,g,b,a in pxdata:
        if r >= thr and g >= thr and b >= thr:
            new.append((0,0,0,0))
        else:
            new.append((r,g,b,a))
    im.putdata(new)
    return im

def crop_content(im):
    """按实际内容裁剪（去掉四周透明空白），返回 (im, bbox)"""
    bbox = im.getbbox()
    if bbox is None:
        return im, (0,0,*im.size)
    return im.crop(bbox), bbox

def fit_into(im, target_w, target_h, pad=2):
    """按比例缩放 + 居中放到 target_w × target_h 画布
       - pad 是预留上下左右透明边距，防止贴边被 drawImage 抗锯齿截断"""
    W, H = im.size
    avail_w = target_w - pad*2
    avail_h = target_h - pad*2
    scale = min(avail_w / W, avail_h / H)
    nw, nh = int(round(W * scale)), int(round(H * scale))
    resized = im.resize((nw, nh), Image.Resampling.NEAREST)  # 像素风最近邻
    canvas = Image.new('RGBA', (target_w, target_h), (0,0,0,0))
    ox = (target_w - nw) // 2
    oy = target_h - nh - pad   # 脚底与画布底边对齐
    canvas.paste(resized, (ox, oy), resized)
    return canvas

# ===== 3 帧差异 =====
def make_walk_a(im_clean, fw, fh):
    """frame 0: 正常站立（原比例居中放）"""
    return fit_into(im_clean, fw, fh, pad=1)

def make_walk_b(im_clean, fw, fh):
    """frame 1: 走动中 —— 整体上移 1 px，脚底换脚（两腿交错感由裁剪+上下 1px 位移模拟）
       以及左臂右臂高度差 1px（通过左右轻微水平翻转 + 垂直 1px 抖动）"""
    base = fit_into(im_clean, fw, fh, pad=1)
    # 上移 1：整张复制向上挪 1，底部补 1 行透明
    shifted = Image.new('RGBA', (fw, fh), (0,0,0,0))
    shifted.paste(base, (0, -1), base)
    # 左半与右半像素级交换（简单的列镜像：列 36..71 与列 0..35 对调）→ 形成"换脚"错觉
    w_, h_ = shifted.size
    half = w_ // 2
    px_ = shifted.load()
    for y in range(h_):
        for x in range(half):
            a = px_[x, y]
            b = px_[w_-1-x, y]
            px_[x, y] = b
            px_[w_-1-x, y] = a
    return shifted

def make_attack(im_clean, fw, fh):
    """frame 2: 攻击冲刺 —— 双手更往前（整体水平方向拉伸 ~8%），嘴更大，身微倾
       为稳妥起见：水平 scale 1.08（手臂外扩更前） + 垂直 scale 1.04，再居中"""
    # 先正常 fit_into
    base = fit_into(im_clean, fw, fh, pad=1)
    # 再对整张做水平+垂直 1.08/1.04 的 NEAREST 拉伸（= 双臂向前伸+身体前倾）
    nw = int(round(fw * 1.10))
    nh = int(round(fh * 1.03))
    stretched = base.resize((nw, nh), Image.Resampling.NEAREST)
    # 居中：超出部分裁掉，不足部分透明
    canvas = Image.new('RGBA', (fw, fh), (0,0,0,0))
    ox = (fw - nw) // 2
    oy = fh - nh   # 脚底对齐
    canvas.paste(stretched, (ox, oy), stretched)
    # 再在嘴部画几条血滴（加强攻击帧视觉差）——在原图底部附近没有意义，直接跳过避免复杂化
    return canvas


def main():
    if not os.path.exists(SRC):
        print(f'ERROR: 找不到 {SRC}，请先运行 GenerateImage 生成 pvz_zombie_src.jpg')
        sys.exit(1)
    src = Image.open(SRC)
    clean = remove_white_bg(src, WHITE_THR)
    cropped, _ = crop_content(clean)
    # 3 帧
    fa = make_walk_a(cropped, FW, FH)
    fb = make_walk_b(cropped, FW, FH)
    fl = make_attack(cropped, FW, FH)
    # 拼成 3 列 sprite
    sheet = Image.new('RGBA', (FW*3, FH), (0,0,0,0))
    for i, frame in enumerate([fa, fb, fl]):
        sheet.paste(frame, (i*FW, 0), frame)
    sheet.save(OUT, 'PNG', optimize=True)
    # 打印验证
    w, h = sheet.size
    fw, fh = w/3, h
    valid = 10 <= fw <= 200 and 10 <= fh <= 200
    print(f'🧟 zombie(PVZ AI): {w}x{h}  frame={fw:.0f}x{fh}  valid={valid}')
    # 额外信息：每帧实际非透明像素数（确认不是空帧）
    for fi in range(3):
        sub = sheet.crop((fi*FW, 0, fi*FW+FW, FH))
        cnt = sum(1 for p in list(sub.getdata()) if p[3] > 10)
        # 每帧最右非透明列 —— 检查手臂是否都在帧内
        rmc = 0
        pxdata = sub.load()
        for y in range(FH):
            for x in range(FW):
                if pxdata[x,y][3] > 10 and x > rmc: rmc = x
        print(f'  frame {fi}: non-transparent px={cnt}, rightmost_col={rmc}/{FW-1}')

if __name__ == '__main__':
    main()
