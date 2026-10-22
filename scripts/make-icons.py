#!/usr/bin/env python3
"""Draws the app icons (public/icon-180.png, icon-192.png, icon-512.png): a brass lantern glowing in a dark cave
mouth. Needs Pillow. Run from the repo root: python3 scripts/make-icons.py"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE = 2048  # drawn large, then scaled down for smooth edges
OUT = Path(__file__).resolve().parent.parent / "public"

ROCK = (20, 22, 26)
ROCK_EDGE = (46, 50, 58)
BRASS = (201, 150, 44)
BRASS_DARK = (122, 84, 20)
GLASS = (255, 226, 140)


def s(v: float) -> int:
    return round(v * SIZE / 512)


def draw() -> Image.Image:
    img = Image.new("RGB", (SIZE, SIZE), ROCK)
    d = ImageDraw.Draw(img)

    # Cave mouth: a rounded arch of lighter rock around a darker opening.
    d.rounded_rectangle([s(40), s(70), s(472), s(520)], radius=s(210), fill=ROCK_EDGE)
    d.rounded_rectangle([s(76), s(104), s(436), s(540)], radius=s(180), fill=(8, 9, 12))

    # Glow behind the lantern.
    glow = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([s(120), s(150), s(392), s(430)], fill=(150, 100, 20))
    glow = glow.filter(ImageFilter.GaussianBlur(s(46)))
    img = ImageChops.add(img, glow)
    d = ImageDraw.Draw(img)

    # Lantern: handle ring, cap, glass body, base.
    d.arc([s(206), s(130), s(306), s(220)], 180, 360, fill=BRASS, width=s(10))
    d.polygon([(s(216), s(214)), (s(296), s(214)), (s(318), s(246)), (s(194), s(246))], fill=BRASS)
    d.rectangle([s(204), s(246), s(308), s(262)], fill=BRASS_DARK)
    d.polygon([(s(204), s(262)), (s(308), s(262)), (s(322), s(366)), (s(190), s(366))], fill=GLASS)
    d.line([(s(256), s(262)), (s(256), s(366))], fill=BRASS_DARK, width=s(7))
    d.line([(s(204), s(262)), (s(190), s(366))], fill=BRASS, width=s(10))
    d.line([(s(308), s(262)), (s(322), s(366))], fill=BRASS, width=s(10))
    d.rounded_rectangle([s(176), s(366), s(336), s(398)], radius=s(10), fill=BRASS)
    d.rectangle([s(188), s(398), s(324), s(412)], fill=BRASS_DARK)

    # Flame.
    d.ellipse([s(238), s(298), s(274), s(358)], fill=(255, 150, 40))
    d.ellipse([s(247), s(322), s(265), s(358)], fill=(255, 245, 200))
    return img


def main() -> None:
    big = draw()
    for px in (180, 192, 512):
        big.resize((px, px), Image.LANCZOS).save(OUT / f"icon-{px}.png", optimize=True)
        print("wrote", OUT / f"icon-{px}.png")


if __name__ == "__main__":
    main()
