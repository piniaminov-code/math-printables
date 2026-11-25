"""Generates the app icons from the site's own look (teal, cream, sun-yellow; a ½ fraction).
Usage: python3 tools/make-icons.py   (needs Pillow and the DejaVu Sans Bold font)"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'icons')
TEAL, TEAL_DARK, CREAM, SUN, INK = (31, 158, 143), (22, 120, 109), (255, 248, 236), (255, 182, 39), (34, 48, 74)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
S = 1024  # draw large, downscale for clean edges


def glyph(d, cx, cy, scale):
    """white 1 over a bar over 2, plus a small sun diamond; scale = height of the whole mark"""
    f = ImageFont.truetype(FONT, int(scale * 0.42))
    for txt, dy in (('1', -0.27), ('2', 0.27)):
        x0, y0, x1, y1 = d.textbbox((0, 0), txt, font=f)
        d.text((cx - (x1 - x0) / 2 - x0, cy + dy * scale - (y1 - y0) / 2 - y0), txt, font=f, fill=CREAM)
    bw, bh = scale * 0.46, scale * 0.075
    d.rounded_rectangle([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], radius=bh / 2, fill=CREAM)
    r = scale * 0.09
    sx, sy = cx + scale * 0.36, cy - scale * 0.36
    d.polygon([(sx, sy - r), (sx + r, sy), (sx, sy + r), (sx - r, sy)], fill=SUN)


def make(kind):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == 'any':  # rounded square with transparent corners
        # like the site's buttons: a darker base peeking out under the teal face
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=TEAL_DARK)
        d.rounded_rectangle([0, 0, S - 1, S * 0.95], radius=S * 0.22, fill=TEAL)
        glyph(d, S / 2, S * 0.475, S * 0.74)
    else:  # full-bleed square: maskable (mark inside the 80% safe circle) and apple-touch (iOS rounds it)
        d.rectangle([0, 0, S, S], fill=TEAL)
        glyph(d, S / 2, S / 2, S * (0.56 if kind == 'maskable' else 0.7))
    return im


def save(im, name, size, opaque=False):
    out = im.resize((size, size), Image.LANCZOS)
    if opaque:
        bg = Image.new('RGB', out.size, TEAL)
        bg.paste(out, mask=out.split()[3])
        out = bg
    out.save(os.path.join(ROOT, name), optimize=True)


os.makedirs(ROOT, exist_ok=True)
anyi, mask, apple = make('any'), make('maskable'), make('apple')
save(anyi, 'icon-192.png', 192)
save(anyi, 'icon-512.png', 512)
save(mask, 'icon-maskable-512.png', 512, opaque=True)
save(apple, 'apple-touch-icon.png', 180, opaque=True)
save(anyi, 'favicon-32.png', 32)
print('icons written to', os.path.abspath(ROOT))
