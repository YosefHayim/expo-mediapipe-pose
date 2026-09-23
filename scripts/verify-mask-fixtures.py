"""Check exported native PNG masks against Google's pose segmentation reference."""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("artifacts", type=Path, help="Directory containing mask-upright.png and mask-rotated.png")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
reference = Image.open(root / "example" / "fixtures" / "pose-segmentation-golden.png").convert("L")
results = []
for name in ("upright", "rotated"):
    image = Image.open(args.artifacts / f"mask-{name}.png")
    assert image.mode == "RGBA", "Mask must be RGBA8"
    assert max(image.size) <= 256, "Mask must respect its requested dimensions"
    alpha = image.getchannel("A")
    assert alpha.getextrema() == (0, 255), "Fixture must contain background and foreground probabilities"
    expected = reference.resize(image.size, Image.Resampling.NEAREST)
    values = list(zip(alpha.getdata(), expected.getdata()))
    intersection = sum(actual >= 128 and golden >= 128 for actual, golden in values)
    union = sum(actual >= 128 or golden >= 128 for actual, golden in values)
    overlap = intersection / union
    assert overlap >= 0.90, f"Mask does not align with reference: IoU={overlap}"
    assert all(min(pixel[:3]) >= 250 for pixel in image.getdata() if pixel[3] >= 128), "Foreground must encode white RGB with probability alpha"
    results.append({"fixture": name, "width": image.width, "height": image.height, "intersectionOverUnion": overlap})
print(json.dumps({"status": "passed", "artifacts": str(args.artifacts), "checks": results}, indent=2))
