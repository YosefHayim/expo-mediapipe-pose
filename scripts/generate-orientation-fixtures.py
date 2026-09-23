"""Generate EXIF fixtures with identical upright content from Google's pose test image."""
from pathlib import Path
from PIL import Image

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
        stored.save(fixtures / f"pose-exif-{orientation}.jpg", quality=95, subsampling=0, exif=exif)
