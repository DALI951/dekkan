#!/usr/bin/env python3
"""Dekkan icons — the "souk ledger" identity: an espresso-ink tile #0e0c0a with
a brass-gold coin (#e8b04b family, radial sheen, soft glow ring, dashed inner
ring) carrying an ink Arabic Dal (د). Gold = the shop's money, ink = the ledger.

Usage:
  python scripts/gen-icons.py
Writes icon/icon-192.png, icon/icon-512.png, icon/maskable-512.png.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

ESPRESSO = (14, 12, 10, 255)       # #0e0c0a tile
GOLD_HI = (250, 213, 140)          # #fad58c sheen center
GOLD_MID = (232, 176, 75)          # #e8b04b
GOLD_LO = (169, 122, 40)           # #a97a28 coin rim
GOLD_RING = (232, 176, 75)         # outer soft glow ring
INK = (36, 26, 8)                  # #241a08 coin engraving

FONT_CANDIDATES = [
    r'C:\Windows\Fonts\seguisb.ttf',   # Segoe UI Semibold (Arabic)
    r'C:\Windows\Fonts\arialbd.ttf',   # Arial Bold (Arabic)
    r'C:\Windows\Fonts\segoeui.ttf',
]


def find_font(size):
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default(size=size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def gold_coin(d, cx, cy, r):
    """Filled disc with a radial sheen: bright center -> brass -> dark rim."""
    rings = max(70, int(r))
    for i in range(rings, 0, -1):
        f = i / rings
        if f < 0.7:
            color = lerp(GOLD_HI, GOLD_MID, f / 0.7)
        else:
            color = lerp(GOLD_MID, GOLD_LO, (f - 0.7) / 0.3)
        rr = r * f
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color)


def dashed_circle(d, cx, cy, r, color, width, dashes=20, fill_ratio=0.5):
    step = 2 * math.pi / dashes
    seg = step * fill_ratio
    for i in range(dashes):
        a0 = i * step
        a1 = a0 + seg
        d.line([(cx + r * math.cos(a0), cy + r * math.sin(a0)),
                (cx + r * math.cos(a1), cy + r * math.sin(a1))],
               fill=color, width=width)


def master(s, safe=False):
    """Espresso tile + brass coin + ink د engraving."""
    img = Image.new('RGBA', (s, s), ESPRESSO)
    d = ImageDraw.Draw(img)
    cx = cy = s / 2
    r = s * (0.38 if not safe else 0.34)  # maskable stays in the 80% safe zone
    gold_coin(d, cx, cy, r)
    ring_w = max(3, int(s * 0.012))
    # soft glow ring around the coin
    d.ellipse([cx - r - ring_w, cy - r - ring_w, cx + r + ring_w, cy + r + ring_w],
              outline=GOLD_RING + (64,), width=ring_w)
    # dashed inner ring (mint mark) - skip on tiny sizes
    if s >= 128:
        dashed_circle(d, cx, cy, r * 0.74, INK + (110,), max(3, int(s * 0.010)))
    font = find_font(int(s * 0.40))
    text = '\u062f'
    b = d.textbbox((0, 0), text, font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text((cx - w / 2 - b[0], cy - h / 2 - b[1] + int(s * 0.015)),
           text, font=font, fill=INK + (255,))
    return img


def write(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'PNG')
    print('wrote', path)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', 'icon')
    write(os.path.join(out, 'icon-192.png'), master(192))
    write(os.path.join(out, 'icon-512.png'), master(512))
    write(os.path.join(out, 'maskable-512.png'), master(512, safe=True))


if __name__ == '__main__':
    main()