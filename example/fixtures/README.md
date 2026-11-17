# Native inference fixtures

Unmodified Google MediaPipe test assets, used by the upstream [Pose Landmarker tests](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/pose_landmarker_test.py). These are public upstream fixtures, not user camera captures. They are example/test-only and are excluded from the published library package. Upstream notices are retained in ../../THIRD_PARTY_NOTICES.md.

| File | Source | SHA-256 |
| --- | --- | --- |
| pose.jpg | https://storage.googleapis.com/mediapipe-assets/pose.jpg | c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b |
| man-woman-okay.jpg | https://storage.googleapis.com/mediapipe-assets/man-woman-okay.jpg | 064bbf589dc1a2e05dff7e3fdddd00bbe5c5feadf4fd350f0e515f5a6bbfbbc4 |
| pose-segmentation-golden.png | https://storage.googleapis.com/mediapipe-assets/pose_segmentation_mask_golden.png | 62ee418e18f317327572da5fcc988af703eb31e6f0b9e0bf3d55e6f4797d6953 |
| burger.jpg | https://storage.googleapis.com/mediapipe-assets/burger.jpg | 97c15bbbf3cf3615063b1031c85d669de55839f59262bbe145d15ca75b36ecbf |

Set `EXPO_PUBLIC_POSE_NATIVE_CHECKS=1` before bundling/running the example to execute the public native API checks instead of starting a camera. The screen shows the result and writes `pose-native-checks.json` into the app's documents directory for automated inspection. Both the native SDK and bundled model run on the simulator/emulator; these checks do not prove physical camera behavior.

`pose-exif-2.jpg` through `pose-exif-8.jpg` are test-only derivatives of `pose.jpg`: their stored pixels are transformed inversely to their EXIF orientation, so all seven decode to the same upright scene. They exercise every mirrored/rotated EXIF case against the upright landmark coordinates, allowing 0.05 normalized-coordinate tolerance for JPEG recompression/model variation. Regenerate them from `example/fixtures` with Pillow 11.3.0 (`python3 -m pip install Pillow==11.3.0`); the same command recreates `oversized.png`:

```sh
python3 - <<'PY'
from PIL import Image, ImageOps

transforms = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_90,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_270,
}
with Image.open("pose.jpg") as source:
    for orientation, transform in transforms.items():
        exif = Image.Exif()
        exif[274] = orientation
        output = f"pose-exif-{orientation}.jpg"
        source.transpose(transform).save(output, quality=95, subsampling=0, exif=exif)
        with Image.open(output) as encoded:
            assert encoded.getexif()[274] == orientation
            assert ImageOps.exif_transpose(encoded).size == source.size
Image.new("RGB", (5000, 4000)).save("oversized.png")
PY
```

No private photos are used.

`oversized.png` is a generated, solid-black 5000×4000 RGB image. It verifies rejection of sources above the 16,777,216-pixel limit without allocating their decoded pixels. The command above recreates it. Native failure reports include the actual bridge error code and message.

`pose-video.mp4` and `pose-video-rotated.mp4` are two-second, 10 fps H.264 derivatives of the public pose image. The rotated file stores clockwise-rotated pixels and a 90° counterclockwise display matrix. Regenerate from `example/fixtures` with FFmpeg 8.1.2 ([display_rotation documentation](https://ffmpeg.org/ffmpeg.html)):

```sh
ffmpeg -hide_banner -y -loop 1 -i pose.jpg -t 2 -r 10 -vf scale=1000:668 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart pose-video.mp4
ffmpeg -hide_banner -y -loop 1 -i pose.jpg -t 2 -r 10 -vf scale=1000:668,transpose=1 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart rotated-pixels.mp4
ffmpeg -hide_banner -y -display_rotation:v:0 90 -i rotated-pixels.mp4 -c copy pose-video-rotated.mp4
rm rotated-pixels.mp4
ffprobe -v error -show_streams -of json pose-video-rotated.mp4
```

The last command should show H.264, 668×1000, a 2 second duration and a `rotation` of 90 in the side data (`pose-video.mp4` is H.264, 1000×668, 2 seconds). They exercise actual native video decoding, orientation, sampling, cancellation and reopening; the static scene does not prove tracking of moving people.

`man-woman-okay.jpg` contains two people and exercises native `maxPoses: 2`, both image/world landmark arrays, first-pose compatibility and explicit selection. Their partly cropped bodies are not used to assert visibility or full-body accuracy.

`pose-segmentation-golden.png` is Google's unmodified reference mask. The native runner saves test-only copies `mask-upright.png` and `mask-rotated.png` in Documents, then releases all leased originals. Copy those artifacts into two folders outside the repo, here `~/mask-artifacts/ios` and `~/mask-artifacts/android`, and run from the repo root:

```sh
python3 example/fixtures/verify_mask_fixtures.py ~/mask-artifacts/ios
python3 example/fixtures/verify_mask_fixtures.py ~/mask-artifacts/android
```

The pixel check uses Pillow (11.3.0 used here), verifies RGBA alpha bounds/white foreground, and requires at least 0.90 intersection-over-union with the official mask at a 0.5 threshold. Run the native suite from a **cold app launch**: its startup-cleanup check deliberately creates a file representing an interrupted earlier process. Fixture copies in Documents are diagnostic artifacts, not library-owned mask leases.
