# expo-mediapipe-pose

On-device pose detection for [Expo](https://docs.expo.dev/) and [React Native](https://reactnative.dev/), powered by Google's [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). Integrates camera, photo and video inference with customizable skeletons, named landmarks and developer-defined feedback.

Community-maintained; not an official Google or Expo package. Frames stay on the device. The module does not download models or upload camera data.

## Who this helps

For Expo and React Native developers building camera interactions, movement visualizations, local photo/video analysis, or feedback driven by named body landmarks. The library handles native inference, coordinates, configurable overlays and event delivery; your app supplies the conditions and user experience.

## Features

| Need | API guide |
| --- | --- |
| Control preview, inference and callback rates; inspect measured metrics | [Frame rates and performance](docs/api.md#frame-rates-and-performance) |
| Measure named angles/distances and react to pose presence | [Geometry](docs/api.md#angles-and-distances), [tracking feedback](docs/api.md#tracking-feedback) |
| Evaluate independent rules with hysteresis and joint-specific feedback | [Multiple rules](docs/api.md#multiple-rules-and-independent-feedback) |
| Discover selectable cameras and frame rates | [Camera discovery](docs/api.md#camera-discovery) |
| Record/replay bounded landmark sessions | [Recording and replay](docs/api.md#landmark-recording-and-replay) |
| Analyze local photos and sample local videos with cancellation | [Photo analysis](docs/api.md#local-photo-analysis), [video analysis](docs/api.md#local-video-analysis) |
| Select among multiple detected poses | [Multiple poses](docs/api.md#multiple-poses-and-explicit-selection) |
| Composite opt-in masks with explicit cleanup and backpressure | [Segmentation](docs/api.md#opt-in-segmentation-masks) |

These additions are implemented on `main`; the installation choices below distinguish the older tag from the newer source snapshot. Styling and rules are configurable without replacing Google's model.

## Status and requirements

The feature set on `main` is unreleased; the tagged v0.2.0 source below provides the earlier camera API. Current development targets Expo SDK 57, React Native 0.86, and React 19.2. Requires an iOS/Android development build; Expo Go cannot load this native module. Native builds, TypeScript, packaging and automated behavior tests are checked. Physical-device alignment, long-session performance and accuracy comparisons remain release evaluation work; no performance advantage over other wrappers is claimed.

## Documentation

- [API reference](docs/api.md): components, hooks, file analysis, coordinates, errors and resource ownership.
- [FAQ](#faq): platform support, native use, privacy, models, performance and limitations.
- [Integration prompt](#integrate-with-a-coding-assistant): copyable instructions for your app's coding assistant.
- [llms.txt](llms.txt): a concise public documentation index for tools that accept it.
- [Runnable example](example/App.tsx): camera, photo/video analysis and feedback flows.

## Install

Until an npm release is published, install the tagged source with [pnpm](https://pnpm.io/):

The command below installs v0.2.0. Its [versioned API documentation](https://github.com/YosefHayim/expo-mediapipe-pose/blob/v0.2.0/docs/api.md) matches that release; the [API on main](docs/api.md) also describes unreleased features.

```sh
pnpm add https://github.com/YosefHayim/expo-mediapipe-pose/archive/refs/tags/v0.2.0.tar.gz effect@^3.21.4
pnpm exec expo install react-native-svg expo-camera
```

<details>
<summary>Try the newer features from a pinned source snapshot</summary>

For the FPS, geometry, tracking, multiple-rule, discovery, recording/replay, photo/video, multiple-pose and segmentation additions, install the tested source snapshot at [`54f6f37`](https://github.com/YosefHayim/expo-mediapipe-pose/commit/54f6f37c0a91243e2096264dc25dc27eed16e05e):

```sh
pnpm add https://github.com/YosefHayim/expo-mediapipe-pose/archive/54f6f37c0a91243e2096264dc25dc27eed16e05e.tar.gz effect@^3.21.4
pnpm exec expo install react-native-svg expo-camera
```

Use the [API at that commit](https://github.com/YosefHayim/expo-mediapipe-pose/blob/54f6f37c0a91243e2096264dc25dc27eed16e05e/docs/api.md). This is an unreleased source snapshot, even though its package manifest still says `0.2.0`; it is not the `v0.2.0` tag or an npm release. Native dependency or configuration changes require a new development build.

</details>

[Effect](https://effect.website/) validates events at the native boundary. [react-native-svg](https://docs.expo.dev/versions/latest/sdk/svg/) draws the optional overlay. The example uses [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) for permissions; another permission provider is also fine.

Configure the permission message in your app config, then rebuild:

```json
{
  "expo": {
    "plugins": [
      ["expo-camera", {
        "cameraPermission": "Allow camera access for on-device pose tracking.",
        "recordAudioAndroid": false
      }]
    ]
  }
}
```

```sh
pnpm exec expo run:ios
# or: pnpm exec expo run:android
```

## Show a pose camera

Mount after permission is granted. The camera fills its layout bounds and draws the skeleton by default:

```tsx
import { PoseCameraView } from "expo-mediapipe-pose";

<PoseCameraView
  style={{ flex: 1 }}
  cameraFacing="front"
  frameLimit={15}
  onLandmark={frame => handlePose(frame.landmarks)}
  onInferenceError={error => showCameraError(error.code)}
/>
```

Change `cameraFacing` to switch cameras. Set `isActive={false}` when the screen loses focus to release capture while keeping the component mounted. The runnable [example](example/App.tsx) includes permissions, camera switching, pause/resume, error recovery and feedback.

## Style joints and body parts

```tsx
<PoseCameraView
  style={{ flex: 1 }}
  skeleton={{
    bodyParts: ["leftArm", "rightArm", "torso"],
    color: "#38bdf8",
    jointRadius: 5,
    lineWidth: 3,
    joints: { leftWrist: { color: "#f59e0b", radius: 8 } },
    connections: { "leftElbow:leftWrist": { color: "#f59e0b" } },
  }}
/>
```

Body-part selection changes the overlay, not the detector or raw results. Individual overrides take precedence over global styles. Use `skeleton={false}` to render your own overlay and avoid internal per-frame overlay state updates. Styling does not restart capture.

## React to a condition

The application defines the condition. `usePoseRule` handles confidence checks, hold duration, stale input and transition callbacks:

```tsx
const feedbackColors = {
  pass: "#22c55e",
  fail: "#ef4444",
  unknown: "#94a3b8",
};

const raisedArm = usePoseRule({
  landmarks: ["leftWrist", "leftShoulder"],
  minVisibility: 0.6,
  holdMs: 250,
  isActive: screenIsFocused,
  evaluate: pose => pose.leftWrist.y < pose.leftShoulder.y,
  onChange: status => handleArmStateChange(status),
});

<PoseCameraView
  style={{ flex: 1 }}
  isActive={screenIsFocused}
  onLandmark={raisedArm.update}
  onCameraConfigured={raisedArm.reset}
  onInferenceError={raisedArm.reset}
  skeleton={{ bodyParts: ["leftArm"], color: feedbackColors[raisedArm.status] }}
/>
```

Import `usePoseRule` from the package. Uncertain, missing or stale landmarks produce `unknown`; that is distinct from a failed condition. Callbacks fire only on transitions. Show text or icons alongside color, as the example does. The hook does not judge exercise form or provide medical interpretation.

For tests or application logic without a native view, import helpers from `expo-mediapipe-pose/core`:

```ts
import { getLandmark } from "expo-mediapipe-pose/core";

const leftWrist = getLandmark(frame, "leftWrist");
```

## Develop

Use Node 24 LTS (`nvm use`) and the pinned pnpm version for contributor checks, matching CI. This development requirement does not change the library’s mobile runtime contract.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm verify:package
pnpm --filter pose-camera-example ios
# or: pnpm --filter pose-camera-example android
```

`pnpm check` runs [Biome](https://biomejs.dev/), [TypeScript](https://www.typescriptlang.org/) checks for the package/example, and tests. CI builds both native example applications. The [native fixture runner](example/fixtures/README.md) exercises real SDK inference on public images/videos; it runs separately from CI build checks. Use physical phones to assess front/back alignment, all interface orientations, zoom, interruptions, permissions, model changes, repeated mounts and sustained capture. Include device, OS, SDK and model details when reporting bugs through [GitHub Issues](https://github.com/YosefHayim/expo-mediapipe-pose/issues).

## API and scope

See [API details](docs/api.md) for props, coordinate semantics, ownership, errors and migration notes. [Public API and native integration](docs/api.md#public-api-and-native-integration) explains the supported entry points.

Recordings contain landmarks/metadata, not camera video. Result indices are not persistent person identities. Repetition counting, exercise scoring and medical interpretation remain application responsibilities. Only the full pose model is bundled; lite/heavy require local model files.

Native inference uses [Swift](https://www.swift.org/) with AVFoundation on iOS and [Kotlin](https://kotlinlang.org/) with CameraX on Android. Detector ownership stays on a serial worker, with camera backpressure and stale-generation rejection. This is an Expo integration, not a replacement pose model.

## FAQ

<details>
<summary>Is this an official Google package? What does it add to MediaPipe?</summary>

It is a community-maintained Expo integration built on Google's official MediaPipe Tasks SDKs and model. It adds a React Native camera component, typed events, skeleton styling, named geometry, rule/tracking hooks, local-media APIs and explicit mask ownership. It does not introduce a new pose model or claim better detection accuracy than the underlying SDK.

</details>

<details>
<summary>Is this a drop-in replacement for ThinkSys/mediapipe-reactnative?</summary>

No. The Expo integration uses a different public API: replace `RNMediapipe` with `PoseCameraView`, use controlled camera props and configure `SkeletonOptions`. Follow the [migration guide](docs/api.md#migration), rebuild the native app and verify your coordinate/overlay handling. Attribution is preserved; no unmeasured speed or accuracy advantage over ThinkSys is claimed.

</details>

<details>
<summary>Does it work in Expo Go, a bare React Native app, or a browser?</summary>

Camera and file inference require an iOS/Android development build. Expo Go cannot load this custom native module. An existing React Native app needs [Expo modules installed](https://docs.expo.dev/bare/installing-expo-modules/) and compatible dependencies; the current development target is Expo SDK 57 / React Native 0.86, not a verified compatibility matrix for older versions. There is no browser inference backend. Pure helpers are available through `expo-mediapipe-pose/core` without initializing React Native.

</details>

<details>
<summary>Can I use it directly from a Swift-only or Kotlin-only app?</summary>

The supported consumer API is TypeScript for Expo/React Native. The Swift and Kotlin sources implement the Expo bridge; this repository does not publish a standalone Swift Package or independent Android library API. For a fully native app, start with Google's official [iOS](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/ios) or [Android](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/android) guide. Native source ownership and extension points are mapped in the [API reference](docs/api.md#public-api-and-native-integration).

</details>

<details>
<summary>Which installation includes all the listed features?</summary>

The `v0.2.0` tag provides the earlier camera API. The pinned source snapshot above includes the ten newer additions. Always read documentation for the installed tag or commit; `main` can advance independently. An npm release containing these additions has not been published.

</details>

<details>
<summary>Can I recolor individual joints or trigger actions when a condition changes?</summary>

Yes. `SkeletonOptions` supports global, joint and connection styling and body-part selection. Define a condition with `usePoseRule`, or multiple conditions with `usePoseRules`, then map their states to colors, text, haptics or app actions. `unknown` means missing, uncertain or stale input. These are developer-defined conditions, not built-in exercise-form judgments. See [styling](docs/api.md#skeletonoptions-and-poseskeleton) and [rules](docs/api.md#multiple-rules-and-independent-feedback).

</details>

<details>
<summary>Can I control FPS, battery use and background behavior?</summary>

`previewFps`, `frameLimit` and `callbackFps` control capture targets, inference limits and JavaScript delivery independently. Metrics report observed work; no requested FPS is guaranteed. Lower callback FPS does not reduce detector work. Use `isActive` with screen focus and app foreground state. There is no automatic thermal/model-switching policy or measured battery-saving guarantee. See [performance](docs/api.md#frame-rates-and-performance).

</details>

<details>
<summary>Do images leave the device? Is video recording included?</summary>

The library runs inference locally and does not upload frames or download models. Applications control their own analytics, networking and storage. Landmark recording/replay stores pose data and metadata, not camera video or segmentation files; local-video analysis reads an existing video. See [recording](docs/api.md#landmark-recording-and-replay).

</details>

<details>
<summary>Does a pose index identify the same person across frames?</summary>

No. `maxPoses` supports up to six detections, and `poseIndex` selects within one result. Indices are not persistent identities. Missing selections remain empty; reset temporal rules/tracking when your selection changes. See [multiple poses](docs/api.md#multiple-poses-and-explicit-selection).

</details>

<details>
<summary>Why do segmentation results report backpressure?</summary>

Segmentation is opt-in. At most two result leases can be outstanding per module; each owns bounded PNG mask files. Call `releasePoseSegmentation` when your consumer finishes, including on errors or when an overlay is replaced/unmounted. The overlay does not release files for you. Already-delivered video masks remain your responsibility after cancellation. See [mask ownership](docs/api.md#opt-in-segmentation-masks).

</details>

<details>
<summary>Are lite/heavy models included? What does a test pass prove?</summary>

Only the full pose model is bundled. Lite/heavy require an explicit local model file. Native builds, behavioral tests and public photo/video fixtures verify integration behavior. They do not prove physical-camera alignment, sustained performance, medical accuracy or superiority over another wrapper. Repetition counting, exercise scoring and medical interpretation are not current library features.

</details>

<details>
<summary>Does llms.txt make AI assistants recommend the package?</summary>

No guarantee. The [llms.txt proposal](https://llmstxt.org/) provides a concise index for agents that choose to read it. You can give an assistant this repository's file directly. It is not a ranking instruction, and [Google Search states that it does not use llms.txt for its Search or generative Search features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide#mythbusting-generative-ai-search-what-you-dont-need-to-do). Accurate public documentation, working examples and clear compatibility information help readers evaluate whether the package fits their needs.

</details>

## Integrate with a coding assistant

Copy the prompt below and replace the bracketed goal. Supply this repository URL and your chosen tag/commit. [llms.txt](llms.txt) provides a short reading list; the versioned API remains authoritative.

<details>
<summary>Copy an integration prompt for your Expo / React Native app</summary>

```text
Integrate expo-mediapipe-pose into this app for: [describe the interaction].
Repository: https://github.com/YosefHayim/expo-mediapipe-pose

Inspect this app's instructions, Expo/React Native versions, navigation,
permission handling and existing camera code before changing anything.
Read the README and API documentation for the exact installed tag/commit.
The v0.2.0 tag predates the newer APIs on main. State the selected source
revision and check compatibility; do not assume an npm release exists.

Use supported exports from expo-mediapipe-pose; import pure helpers from
expo-mediapipe-pose/core. Do not invent API names or treat the internal
Swift/Kotlin Expo bridge as a separately distributed native SDK.

Implement the smallest complete integration for the stated goal:
- Use a native development build, obtain permission before mounting, and
  connect isActive to screen focus and foreground state.
- Keep preview, inference and callback rates explicit where needed.
  Report measured performance without promising a requested frame rate.
- Preserve named anatomical landmarks, the documented coordinate system,
  and unknown/missing states. Do not mirror coordinates twice or treat
  pose indices as persistent person IDs.
- Enable segmentation only if needed. Release each delivered mask lease
  after use/replacement/unmount, including error and cancellation paths.
- Keep exercise rules application-defined. Do not imply medical accuracy,
  built-in repetition counting, video recording, or unsupported platforms.
- Follow the app's structure. Use descriptive names and early returns;
  avoid nested ternaries, nested conditions and duplicated infrastructure.

Run relevant type/behavior checks and native builds. Exercise the actual
screen and report which devices were used. Separate simulator/fixture
coverage from physical-camera and sustained-performance validation.
Explain the changed files, installation/build steps and remaining limits.
```

</details>

## License and attribution

[MIT](LICENSE). This project evolved from [ThinkSys/mediapipe-reactnative](https://github.com/ThinkSys/mediapipe-reactnative); its attribution is preserved in [third-party notices](THIRD_PARTY_NOTICES.md), alongside MediaPipe notices. The native inference SDKs and pose model come from Google. Contributor agent guidance lives in [AGENTS.md](AGENTS.md).
