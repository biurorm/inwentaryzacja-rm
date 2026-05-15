"""Generator ikon PWA dla aplikacji Inwentaryzacja RM, używa logo.png jako bazy."""
from PIL import Image
import os

OUT = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(OUT, "icons")
os.makedirs(ICONS, exist_ok=True)

BRAND = (9, 77, 71)
LOGO_SRC = os.path.join(OUT, "logo.png")

def make_icon(size, path):
    """Tworzy kwadratową ikonę z logo, wykadrowaną do samego symbolu RM."""
    logo = Image.open(LOGO_SRC).convert("RGBA")
    w, h = logo.size

    # Logo jest poziome: monogram RM po lewej, tekst BIURO NIERUCHOMOŚCI po prawej.
    # Wykadrujmy lewą część (kwadrat) - mniej więcej pierwsze 26% szerokości.
    crop_w = int(w * 0.26)
    crop_h = h
    # crop środek pionowo: tu po prostu cała wysokość
    box = (0, 0, crop_w, crop_h)
    cropped = logo.crop(box)

    # Wpasuj w kwadrat z marginesem
    canvas = Image.new("RGBA", (size, size), BRAND + (255,))

    # Skaluj cropped tak, żeby zmieścił się z marginesem 10%
    target = int(size * 0.78)
    cropped.thumbnail((target, target), Image.LANCZOS)
    cx = (size - cropped.width) // 2
    cy = (size - cropped.height) // 2
    canvas.paste(cropped, (cx, cy), cropped)

    # Zaokrąglone rogi
    from PIL import ImageDraw
    r = size // 6
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size, size), radius=r, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    out.save(path, "PNG")
    print(f"OK: {path}")

make_icon(192, os.path.join(ICONS, "icon-192.png"))
make_icon(512, os.path.join(ICONS, "icon-512.png"))
make_icon(180, os.path.join(ICONS, "apple-touch-icon.png"))
print("Done.")
