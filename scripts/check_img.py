import os
import base64
from pathlib import Path

img_dir = Path("assets/img")
files = ["worship.jpg", "comunidad.jpg", "min-kids.jpg", "jovenes.jpg", "pastor robert.jpg", "familias.jpg", "reunion-general.jpg"]

for f in files:
    try:
        size = os.path.getsize(img_dir / f)
        print(f"{f}: {size} bytes")
    except Exception as e:
        print(f"Error reading {f}")
