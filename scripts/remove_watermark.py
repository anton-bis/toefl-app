"""直接覆盖右下角水印区域 v2"""
from PIL import Image
import os

SRC = r"C:\Users\lj115\Desktop\托福模考软件 (1).png"
OUT_DIR = r"D:\托福阅读模拟软件\assets\icons"

img = Image.open(SRC).convert("RGBA")
w, h = img.size  # 2048x2048
pixels = img.load()

cover_w, cover_h = 400, 120
x0, y0 = w - cover_w, h - cover_h

# 1. 在覆盖前取样背景色（上方 + 左侧）
samples = []
for y in range(y0 - 30, y0):
    for x in range(x0, w):
        samples.append(pixels[x, y][:3])
for y in range(y0, h):
    for x in range(x0 - 30, x0):
        samples.append(pixels[x, y][:3])

bg = tuple(int(sum(c) / len(c)) for c in zip(*samples))
print(f"背景色: RGB{bg}")

# 2. 保存覆盖区域上边缘和左边缘的原始像素（用于渐变）
top_edge = {}
for y in range(y0, y0 + 20):
    for x in range(x0, w):
        top_edge[(x, y)] = pixels[x, y]

left_edge = {}
for x in range(x0, x0 + 20):
    for y in range(y0, h):
        left_edge[(x, y)] = pixels[x, y]

# 3. 纯色覆盖
overlay = Image.new("RGBA", (cover_w, cover_h), bg + (255,))
img.paste(overlay, (x0, y0))
pixels = img.load()  # 刷新

# 4. 上边缘渐变（20px）
feather = 20
for dy in range(feather):
    alpha = dy / feather
    y = y0 + dy
    for x in range(x0, w):
        orig = top_edge.get((x, y))
        if orig is None:
            continue
        r = int(bg[0] * alpha + orig[0] * (1 - alpha))
        g = int(bg[1] * alpha + orig[1] * (1 - alpha))
        b = int(bg[2] * alpha + orig[2] * (1 - alpha))
        pixels[x, y] = (r, g, b, 255)

# 5. 左边缘渐变（20px）
for dx in range(feather):
    alpha = dx / feather
    x = x0 + dx
    for y in range(y0, h):
        orig = left_edge.get((x, y))
        if orig is None:
            continue
        r = int(bg[0] * alpha + orig[0] * (1 - alpha))
        g = int(bg[1] * alpha + orig[1] * (1 - alpha))
        b = int(bg[2] * alpha + orig[2] * (1 - alpha))
        pixels[x, y] = (r, g, b, 255)

print(f"右下角 {cover_w}x{cover_h}px 已覆盖 + 20px 羽化")

# 512
img512 = img.resize((512, 512), Image.LANCZOS)
out_png = os.path.join(OUT_DIR, "icon.png")
img512.save(out_png, "PNG")
print(f"icon.png ({os.path.getsize(out_png) / 1024:.1f} KB)")

# ICO
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
out_ico = os.path.join(OUT_DIR, "icon.ico")
img.save(out_ico, format="ICO", sizes=sizes)
print(f"icon.ico ({os.path.getsize(out_ico) / 1024:.1f} KB)")
print("完成！")
