"""Generate EXIF and source-size fixtures.

Requires Pillow 11.3.0: python3 -m pip install Pillow==11.3.0
"""
from pathlib import Path
from PIL import Image, ImageOps

fixtures = Path(__file__).resolve().parent.parent / "example" / "fixtures"
transforms = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_90,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_270,
}
with Image.open(fixtures / "pose.jpg") as source:
    for orientation, transform in transforms.items():
        stored = source.transpose(transform)
        exif = Image.Exif()
        exif[274] = orientation
        output = fixtures / f"pose-exif-{orientation}.jpg"
        stored.save(output, quality=95, subsampling=0, exif=exif)
        with Image.open(output) as encoded:
            assert encoded.getexif()[274] == orientation
            assert ImageOps.exif_transpose(encoded).size == source.size

Image.new("RGB", (5000, 4000)).save(fixtures / "oversized.png")
