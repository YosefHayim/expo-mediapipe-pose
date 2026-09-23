"""Encode public pose.jpg into short, static H.264 decode/orientation fixtures."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
fixtures = root / "example" / "fixtures"

def encode(destination, transform):
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1",
        "-i", str(fixtures / "pose.jpg"), "-t", "2", "-r", "10",
        "-vf", transform, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(destination),
    ], check=True)

encode(fixtures / "pose-video.mp4", "scale=1000:668")
working = root / "scripts" / "dev"
working.mkdir(exist_ok=True)
rotated = working / "rotated-fixture.mp4"
try:
    encode(rotated, "scale=1000:668,transpose=1")
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-display_rotation:v:0", "90", "-i", str(rotated),
        "-c", "copy", str(fixtures / "pose-video-rotated.mp4"),
    ], check=True)
finally:
    rotated.unlink(missing_ok=True)
