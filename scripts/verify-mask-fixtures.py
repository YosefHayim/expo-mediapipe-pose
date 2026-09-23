"""Check exported native PNG masks against Google's pose segmentation reference.

Requires Pillow 11.3.0: python3 -m pip install Pillow==11.3.0
"""
import argparse
import json
from pathlib import Path
from PIL import Image

def verify(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


parser = argparse.ArgumentParser()
parser.add_argument("artifacts", type=Path, help="Directory containing mask-upright.png and mask-rotated.png")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
reference = Image.open(root / "example" / "fixtures" / "pose-segmentation-golden.png").convert("L")
results = []
for name in ("upright", "rotated"):
    image = Image.open(args.artifacts / f"mask-{name}.png")
    verify(image.mode == "RGBA", "Mask must be RGBA8")
    verify(image.size == (256, 170), "Default pose fixture masks must be 256 by 170 pixels")
    alpha = image.getchannel("A")
    verify(alpha.getextrema() == (0, 255), "Fixture must contain background and foreground probabilities")
    expected = reference.resize(image.size, Image.Resampling.NEAREST)
    values = list(zip(alpha.getdata(), expected.getdata()))
    intersection = sum(actual >= 128 and golden >= 128 for actual, golden in values)
    union = sum(actual >= 128 or golden >= 128 for actual, golden in values)
    overlap = intersection / union
    verify(overlap >= 0.90, f"Mask does not align with reference: IoU={overlap}")
    verify(all(
        pixel[:3] == (255, 255, 255) for pixel in image.getdata() if pixel[3] > 0
    ), "Nontransparent pixels must encode white RGB with probability alpha")
    results.append({"fixture": name, "width": image.width, "height": image.height, "intersectionOverUnion": overlap})
print(json.dumps({"status": "passed", "artifacts": str(args.artifacts), "checks": results}, indent=2))
