# Native inference fixtures

Unmodified Google MediaPipe test assets, used by the upstream [Pose Landmarker tests](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/pose_landmarker_test.py). These are public upstream fixtures, not user camera captures. They are example/test-only and are excluded from the published library package. Upstream notices are retained in ../../THIRD_PARTY_NOTICES.md.

| File | Source | SHA-256 |
| --- | --- | --- |
| pose.jpg | https://storage.googleapis.com/mediapipe-assets/pose.jpg | c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b |
| burger.jpg | https://storage.googleapis.com/mediapipe-assets/burger.jpg | 97c15bbbf3cf3615063b1031c85d669de55839f59262bbe145d15ca75b36ecbf |

Set `EXPO_PUBLIC_POSE_NATIVE_CHECKS=1` before bundling/running the example to execute the public native API checks instead of starting a camera. The screen shows the result and writes `pose-native-checks.json` into the app's documents directory for automated inspection. Both the native SDK and bundled model run on the simulator/emulator; these checks do not prove physical camera behavior.

`pose-exif-2.jpg` through `pose-exif-8.jpg` are test-only derivatives of `pose.jpg`: their stored pixels are transformed inversely to their EXIF orientation, so all seven decode to the same upright scene. They exercise every mirrored/rotated EXIF case against the upright landmark coordinates, allowing 0.05 normalized-coordinate tolerance for JPEG recompression/model variation. Regenerate them with `python3 scripts/generate-orientation-fixtures.py` (Pillow 11.3.0 was used). No private photos are used.
