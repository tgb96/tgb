from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = 512


def font(size):
    candidates = [Path("C:/Windows/Fonts/arialbd.ttf"), Path("C:/Windows/Fonts/segoeuib.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


image = Image.new("RGB", (SIZE, SIZE), "#111522")
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((24, 24, 488, 488), radius=101, outline="#7FAF57", width=8)
draw.ellipse((132, 94, 380, 342), fill="#C8FF4D")
draw.line([(158, 142), (192, 161), (220, 196), (242, 250), (262, 298), (300, 326)], fill="#111522", width=15, joint="curve")
draw.line([(354, 142), (320, 161), (292, 196), (270, 250), (250, 298), (212, 326)], fill="#111522", width=15, joint="curve")
draw.line([(176, 259), (226, 209), (268, 247), (338, 166)], fill="#3157FF", width=19, joint="curve")
draw.line([(306, 166), (338, 166), (338, 198)], fill="#3157FF", width=19, joint="curve")
draw.text((256, 393), "TGTRAIN", font=font(61), fill="#FFFFFF", anchor="mm")
draw.text((256, 435), "PROGRESO SEMANAL", font=font(17), fill="#AAB3C5", anchor="mm")
image.save(ROOT / "icon-512.png", optimize=True)
image.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "icon-192.png", optimize=True)
