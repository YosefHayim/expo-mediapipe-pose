"""Encode public pose.jpg into short, static H.264 decode/orientation fixtures.

Requires FFmpeg and ffprobe 8.1.2 on PATH.
"""
from pathlib import Path
import subprocess
import json

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

for filename, dimensions, rotation in [
    ("pose-video.mp4", (1000, 668), None),
    ("pose-video-rotated.mp4", (668, 1000), 90),
]:
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(fixtures / filename)
    ], check=True, capture_output=True, text=True)
    stream = json.loads(probe.stdout)["streams"][0]
    assert stream["codec_name"] == "h264"
    assert (stream["width"], stream["height"]) == dimensions
    assert float(stream["duration"]) == 2
    if rotation is not None:
        assert any(data.get("rotation") == rotation for data in stream["side_data_list"])
