from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "brand" / "tgtrain-mark-v2.png"
NAVY = (4, 35, 78, 255)


def trimmed_mark():
    source = Image.open(SOURCE).convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds:
        source = source.crop(bounds)

    side = max(source.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.alpha_composite(source, ((side - source.width) // 2, (side - source.height) // 2))
    return square


def render_icon(mark, size, mark_ratio, background, output):
    canvas = Image.new("RGBA", (size, size), background)
    mark_size = round(size * mark_ratio)
    scaled = mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS)
    offset = (size - mark_size) // 2
    canvas.alpha_composite(scaled, (offset, offset))
    if background[3] == 255:
        canvas = canvas.convert("RGB")
    canvas.save(ROOT / output, optimize=True)


mark = trimmed_mark()

# Standard Android/PWA icons: generous padding and an opaque launcher background.
render_icon(mark, 192, 0.86, NAVY, "icon-192.png")
render_icon(mark, 512, 0.86, NAVY, "icon-512.png")

# Android adaptive icons: the complete symbol stays inside the central safe area.
render_icon(mark, 192, 0.70, NAVY, "icon-maskable-192.png")
render_icon(mark, 512, 0.70, NAVY, "icon-maskable-512.png")

# iOS home-screen icon. Apple applies the final rounded-corner mask.
render_icon(mark, 180, 0.86, NAVY, "apple-touch-icon.png")

# Small browser/app-header versions retain transparency around the circular mark.
render_icon(mark, 32, 0.96, (0, 0, 0, 0), "favicon-32.png")
render_icon(mark, 160, 0.96, (0, 0, 0, 0), "assets/brand/tgtrain-mark-160.png")
