#!/usr/bin/env python3
"""Dekkan icons — dark #0a0a0f tile, red #dc2626 rounded square, white Arabic
Dal (د) monogram. Same family as DuoScore, red bumped to our #dc2626 accent.

Usage:
  python3 scripts/gen-icons.py
Writes icon/icon-192.png, icon/icon-512.png, icon/maskable-512.png.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageColor

DARK = (10, 10, 15, 255)
RED = ImageColor.getrgb('#dc2626') + (255,)
RED_HI = ImageColor.getrgb('#ef4444') + (255,)
WHITE = (255, 255, 255, 255)

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


def master(s, safe=False):
    """Dark tile + red rounded square + white د."""
    img = Image.new('RGBA', (s, s), DARK)
    d = ImageDraw.Draw(img)
    if safe:
        # maskable: art lives inside the 80% safe zone
        m, rad = int(s * 0.10), int(s * 0.28)
        inner = int(s * 0.16)
        d.rounded_rectangle([m, m, s - m, s - m], radius=rad, fill=RED)
    else:
        m, rad = int(s * 0.145), int(s * 0.175)
        inner = int(s * 0.145)
        d.rounded_rectangle([m, m, s - m, s - m], radius=rad, fill=RED)
    font = find_font(int(s * (0.60 if safe else 0.62)))
    b = d.textbbox((0, 0), '\u062f', font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text(((s - w) / 2 - b[0], (s - h) / 2 - b[1] - int(s * 0.02)), '\u062f', font=font, fill=WHITE)
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