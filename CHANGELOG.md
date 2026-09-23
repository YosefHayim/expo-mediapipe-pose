# Changelog

## 0.3.0

First npm distribution of `expo-mediapipe-pose`. Requires a native Expo development build; targets Expo SDK 57, React Native 0.86 and React 19.2.

- Publish compiled JavaScript and TypeScript declarations for the main API and the pure `expo-mediapipe-pose/core` entry point. Include native sources, the bundled full pose model, guides and license notices.
- Add independent preview/inference/callback rate controls and measured performance events.
- Add named image/world geometry, tracking feedback, multiple rules, threshold hysteresis and per-joint feedback composition.
- Add camera capability discovery, bounded landmark recording/replay, local photo and sampled video analysis, multiple-pose selection and opt-in segmentation with explicit mask cleanup.
- Add practical camera setup, skeleton styling and angle-triggered feedback guides.

The earlier `v0.2.0` GitHub source tag contains the initial camera API. Existing consumers should follow the [0.3.0 API](docs/api.md) for the additions. The native Swift/Kotlin code remains an internal Expo bridge, not a standalone native SDK.

Builds and fixture tests do not establish physical-camera alignment, sustained performance or medical accuracy. Pose indices are not persistent identities; exercise scoring and repetition counting remain application responsibilities.
