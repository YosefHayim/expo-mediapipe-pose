# Native inference fixtures

Unmodified Google MediaPipe test assets, used by the upstream [Pose Landmarker tests](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/pose_landmarker_test.py). These are public upstream fixtures, not user camera captures. They are example/test-only and are excluded from the published library package. Upstream notices are retained in ../../THIRD_PARTY_NOTICES.md.

| File | Source | SHA-256 |
| --- | --- | --- |
| pose.jpg | https://storage.googleapis.com/mediapipe-assets/pose.jpg | c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b |
| man-woman-okay.jpg | https://storage.googleapis.com/mediapipe-assets/man-woman-okay.jpg | 064bbf589dc1a2e05dff7e3fdddd00bbe5c5feadf4fd350f0e515f5a6bbfbbc4 |
| pose-segmentation-golden.png | https://storage.googleapis.com/mediapipe-assets/pose_segmentation_mask_golden.png | 62ee418e18f317327572da5fcc988af703eb31e6f0b9e0bf3d55e6f4797d6953 |
| burger.jpg | https://storage.googleapis.com/mediapipe-assets/burger.jpg | 97c15bbbf3cf3615063b1031c85d669de55839f59262bbe145d15ca75b36ecbf |

Set `EXPO_PUBLIC_POSE_NATIVE_CHECKS=1` before bundling/running the example to execute the public native API checks instead of starting a camera. The screen shows the result and writes `pose-native-checks.json` into the app's documents directory for automated inspection. Both the native SDK and bundled model run on the simulator/emulator; these checks do not prove physical camera behavior.

`pose-exif-2.jpg` through `pose-exif-8.jpg` are test-only derivatives of `pose.jpg`: their stored pixels are transformed inversely to their EXIF orientation, so all seven decode to the same upright scene. They exercise every mirrored/rotated EXIF case against the upright landmark coordinates, allowing 0.05 normalized-coordinate tolerance for JPEG recompression/model variation. Regenerate them with `python3 scripts/generate-orientation-fixtures.py` (Pillow 11.3.0 was used). No private photos are used.

`oversized.png` is a generated, solid-black 5000×4000 RGB image. It verifies rejection of sources above the 16,777,216-pixel limit without allocating their decoded pixels. The same generator recreates it. Native failure reports include the actual bridge error code and message.

`pose-video.mp4` and `pose-video-rotated.mp4` are two-second, 10 fps H.264 derivatives of the public pose image. The rotated file stores clockwise-rotated pixels and a 90° counterclockwise display matrix. Regenerate with `python3 scripts/generate-video-fixtures.py` (FFmpeg 8.1.2 was used; [display_rotation documentation](https://ffmpeg.org/ffmpeg.html)). They exercise actual native video decoding, orientation, sampling, cancellation and reopening; the static scene does not prove tracking of moving people.

`man-woman-okay.jpg` contains two people and exercises native `maxPoses: 2`, both image/world landmark arrays, first-pose compatibility and explicit selection. Their partly cropped bodies are not used to assert visibility or full-body accuracy.

`pose-segmentation-golden.png` is Google's unmodified reference mask. The native runner saves test-only copies `mask-upright.png` and `mask-rotated.png` in Documents, then releases all leased originals. Copy those artifacts into `scripts/dev/masks-ios` / `scripts/dev/masks-android` and run:

```sh
python3 scripts/verify-mask-fixtures.py scripts/dev/masks-ios
python3 scripts/verify-mask-fixtures.py scripts/dev/masks-android
```

The pixel check uses Pillow (11.3.0 used here), verifies RGBA alpha bounds/white foreground, and requires at least 0.90 intersection-over-union with the official mask at a 0.5 threshold. Run the native suite from a **cold app launch**: its startup-cleanup check deliberately creates a file representing an interrupted earlier process. Fixture copies in Documents are diagnostic artifacts, not library-owned mask leases.
