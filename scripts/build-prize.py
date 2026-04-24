#!/usr/bin/env python3
"""
build-prize.py
================
Generates the Cicada-3301-style prize image that is revealed to anyone
who completes the puzzle and signs the guestbook.

The image itself is just a minimal emblem. The payload is the hidden
Caesar-ciphered (ROT13) text embedded in the PNG file:
  - via a PNG tEXt metadata chunk  (survives most image tools)
  - via a raw text block appended after IEND  (what you see when you
    drag the .png onto a text editor)

Solver flow, as intended:
  1. user finishes the puzzle, signs the guestbook
  2. gets a link to /prize.png
  3. saves it, opens it in a text editor
  4. sees a ROT13 block, decodes it
  5. emails carlo at the address with the win code
  6. they get a reply

Usage:
    python3 scripts/build-prize.py
Writes ./public/prize.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
import codecs

OUT = Path(__file__).resolve().parent.parent / 'public' / 'prize.png'
OUT.parent.mkdir(parents=True, exist_ok=True)

# ── color + size ──────────────────────────────────────────────────────────
W, H = 1200, 630
INK      = (15, 14, 12)
PAPER    = (236, 230, 215)
SIGNAL   = (142, 224, 0)
PRIMARY  = (230, 62, 33)
DIM      = (100, 95, 85)

img = Image.new('RGB', (W, H), INK)
d = ImageDraw.Draw(img)

# ── fonts: try a few, fall back gracefully ────────────────────────────────
def load_font(candidates, size):
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()

display_candidates = [
    '/System/Library/Fonts/Supplemental/Impact.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]
mono_candidates = [
    '/System/Library/Fonts/Menlo.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/Library/Fonts/Courier New.ttf',
]

f_huge  = load_font(display_candidates, 112)
f_mid   = load_font(display_candidates, 44)
f_mono  = load_font(mono_candidates, 13)
f_small = load_font(mono_candidates, 11)

def centered_text(y, text, font, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, y), text, font=font, fill=fill)

# ── top-left + top-right metadata strips (mirrors the site's chrome) ──────
d.text((40, 32), 'CARLO DOROFF · CRA-0004', font=f_small, fill=DIM)
bbox = d.textbbox((0, 0), 'ARCHIVE · 01 / 01', font=f_small)
tw = bbox[2] - bbox[0]
d.text((W - 40 - tw, 32), 'ARCHIVE · 01 / 01', font=f_small, fill=DIM)

# ── emblem: three ascending ticks (signal mark / cicada wing) ─────────────
cx, cy = W // 2, 170
for i, h in enumerate([42, 72, 104]):
    x0 = cx - 60 + i * 42
    d.rectangle([x0, cy - h // 2, x0 + 8, cy + h // 2], fill=SIGNAL)

# ── type stack, centered ──────────────────────────────────────────────────
centered_text(260, '// a signal, not on the map', f_mono, DIM)
centered_text(310, 'YOU FILTERED IN.', f_huge, PAPER)
centered_text(450, 'this was never a game. it was a filter.', f_mid, PRIMARY)
centered_text(530, '· not on the sitemap · not on the menu ·', f_small, DIM)
centered_text(560, 'open me somewhere quiet.', f_small, SIGNAL)

# ── hidden payload ────────────────────────────────────────────────────────
# Unique win code. If you want to rotate this, change it + redeploy.
WIN_CODE = 'ORION-4217'
EMAIL    = 'carlo@joincraze.com'
SUBJECT  = 'WIN'

plain = (
    f"Well played.\n"
    f"Email {EMAIL} with the subject \"{SUBJECT}\" and this code:\n"
    f"  {WIN_CODE}\n"
    f"Tell me what you built to get here.\n"
    f"Bring work. We'll talk.\n"
    f"  — c"
)
cipher = codecs.encode(plain, 'rot_13')

pnginfo = PngImagePlugin.PngInfo()
pnginfo.add_text('cicada', cipher)
pnginfo.add_text('hint', 'rot13. caesar cipher. same as 3301.')
pnginfo.add_text('Software', 'carlo-doroff.portfolio / cra-0004')

img.save(OUT, 'PNG', pnginfo=pnginfo, optimize=True)

# append a plain-text block after IEND so it surfaces immediately when the
# file is opened in a text editor. PNG readers ignore bytes after IEND.
trailer = (
    "\n\n"
    "================================================================\n"
    "  you are reading the file in a text editor. good.\n"
    "  the payload below is a caesar cipher (rot13).\n"
    "  it was already embedded as PNG metadata above, but this copy\n"
    "  is easier to see.\n"
    "================================================================\n"
    f"{cipher}\n"
    "================================================================\n"
)
with open(OUT, 'ab') as f:
    f.write(trailer.encode('utf-8'))

print(f"wrote {OUT}")
print(f"  size: {OUT.stat().st_size} bytes")
print(f"  win code (rotated): {codecs.encode(WIN_CODE, 'rot_13')}")
