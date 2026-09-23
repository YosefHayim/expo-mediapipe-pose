# expo-mediapipe-pose

An on-device pose camera for [Expo](https://docs.expo.dev/) and [React Native](https://reactnative.dev/), powered by Google's [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). Includes a customizable skeleton, named landmarks, and hooks for developer-defined feedback.

Community-maintained; not an official Google or Expo package. Frames stay on the device. The module does not download models or upload camera data.

## Status and requirements

Early release targeting Expo SDK 57, React Native 0.86, and React 19.2. Requires an iOS/Android development build; Expo Go cannot load this native module. Native builds, TypeScript, packaging and automated behavior tests are checked. Physical-device alignment, long-session performance and accuracy comparisons remain release evaluation work; no performance advantage over other wrappers is claimed.

## Install

Until an npm release is published, install the tagged source with [pnpm](https://pnpm.io/):

```sh
pnpm add https://github.com/YosefHayim/expo-mediapipe-pose/archive/refs/tags/v0.2.0.tar.gz effect@^3.21.4
pnpm exec expo install react-native-svg expo-camera
```

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

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm verify:package
pnpm --filter pose-camera-example ios
# or: pnpm --filter pose-camera-example android
```

`pnpm check` runs [Biome](https://biomejs.dev/), [TypeScript](https://www.typescriptlang.org/) checks for the package/example, and tests. CI builds both native example applications. Use physical phones to assess front/back alignment, all interface orientations, zoom, interruptions, permissions, model changes, repeated mounts and sustained capture. Include device, OS, SDK and model details when reporting bugs through [GitHub Issues](https://github.com/YosefHayim/expo-mediapipe-pose/issues).

## API and scope

See [API details](docs/api.md) for props, coordinate semantics, errors and migration notes. This version detects one person. It does not provide recording, persistent person identity, repetition counting or exercise scoring. Only the full pose model is bundled; lite/heavy require local model files.

Native inference uses [Swift](https://www.swift.org/) with AVFoundation on iOS and [Kotlin](https://kotlinlang.org/) with CameraX on Android. Detector ownership stays on a serial worker, with camera backpressure and stale-generation rejection. This is an Expo integration, not a replacement pose model.

## License and attribution

[MIT](LICENSE). This project evolved from [ThinkSys/mediapipe-reactnative](https://github.com/ThinkSys/mediapipe-reactnative); its attribution is preserved in [third-party notices](THIRD_PARTY_NOTICES.md), alongside MediaPipe notices. The native inference SDKs and pose model come from Google. Contributor agent guidance lives in [AGENTS.md](AGENTS.md).
