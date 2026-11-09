# Changelog

## 0.4.0

Breaking: the `effect` peer dependency is removed, and exported schemas are zod schemas now. See "Breaking changes in 0.4.0" in the README.

- The `effect` package is no longer needed. Remove it from your app.
- Exported schemas keep their names but are zod schemas now. Replace `Schema.decodeUnknownSync(PoseFrame)(value)` with `PoseFrame.parse(value)`, and `Schema.decodeUnknownEither(PoseFrame)(value)` with `PoseFrame.safeParse(value)`.
- Parsing `PoseImageOptions` or `PoseVideoSampling` directly now rejects unknown keys. The package's own functions behave as before.
- Validation error messages come from zod now.
- Target Expo SDK 58 (React Native 0.88, React 19.3). The peer ranges add Expo SDK 58 and React Native 0.88 and keep Expo SDK 57 and React Native 0.86, since the native code needs no SDK 58 API.
- Update MediaPipe Tasks native pins: iOS `MediaPipeTasksVision` 1.0.0 (latest CocoaPods release) and Android `tasks-vision` 1.2.2 (latest Maven 1.x). The pose landmarker API used by the Swift and Kotlin code is unchanged in these releases.

## 0.3.0

First npm distribution of `expo-mediapipe-pose`. Requires a native Expo development build; targets Expo SDK 57, React Native 0.86 and React 19.2.

- Publish compiled JavaScript and TypeScript declarations for the main API and the pure `expo-mediapipe-pose/core` entry point. Include native sources, the bundled full pose model, guides and license notices.
- Add independent preview/inference/callback rate controls and measured performance events.
- Add named image/world geometry, tracking feedback, multiple rules, threshold hysteresis and per-joint feedback composition.
- Add camera capability discovery, bounded landmark recording/replay, local photo and sampled video analysis, multiple-pose selection and opt-in segmentation with explicit mask cleanup.
- Add practical camera setup, skeleton styling and angle-triggered feedback guides.

The earlier `v0.2.0` GitHub source tag contains the initial camera API. Existing consumers should follow the [0.3.0 API](https://github.com/YosefHayim/expo-mediapipe-pose/blob/v0.3.0/docs/api.md) for the additions. The native Swift/Kotlin code remains an internal Expo bridge, not a standalone native SDK.

Builds and fixture tests do not establish physical-camera alignment, sustained performance or medical accuracy. Pose indices are not persistent identities; exercise scoring and repetition counting remain application responsibilities.
