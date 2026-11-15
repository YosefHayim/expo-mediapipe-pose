# expo-mediapipe-pose

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/hero-dark.svg">
  <img src=".github/hero-light.svg" alt="A body skeleton raises one arm and a usePoseRule check turns from fail to pass" width="100%">
</picture>

On-device pose tracking for [Expo](https://docs.expo.dev/) and [React Native](https://reactnative.dev/), built on Google's [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). One camera component draws a styled skeleton, gives you 33 named landmarks, and runs your own rules on them. Frames stay on the phone: nothing is uploaded and no model is downloaded.

**[Try it in your browser](https://YosefHayim.github.io/expo-mediapipe-pose/)**: sample clips, your webcam or your own files, with live skeleton styling, rules and copyable Expo code. The browser page uses MediaPipe's web SDK with this library's pure helpers; the npm package itself runs only in iOS and Android builds.

Community project, not an official Google or Expo package.

## Install

```sh
pnpm add expo-mediapipe-pose
pnpm exec expo install react-native-svg expo-camera
```

Add the camera permission text to your app config, then make a development build. Expo Go cannot load this native module.

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

Version 0.4.0 targets Expo SDK 58, React Native 0.88 and React 19.3, and its peer ranges also allow SDK 57, React Native 0.86 and React 19.2. Upgrading from 0.3? Read the [0.4.0 breaking changes](CHANGELOG.md).

## Show a pose camera

Mount it after permission is granted. It fills its layout and draws the skeleton by default:

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

Set `isActive={false}` when the screen loses focus to release the camera and keep the component mounted. `previewFps`, `frameLimit` and `callbackFps` set the capture, inference and JavaScript rates on their own.

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

Choosing body parts changes the drawing, not the detector or the landmarks you receive. One joint's style beats the global style. Pass `skeleton={false}` to draw your own overlay.

## React to a condition

Your app writes the condition. `usePoseRule` checks confidence, hold time and stale input, and calls you only when the status changes:

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

Missing, uncertain or stale landmarks give `unknown`, which is not the same as a failed condition. Use `usePoseRules` for several conditions at once. For logic and tests without a native view, import the pure helpers:

```ts
import { getLandmark } from "expo-mediapipe-pose/core";

const leftWrist = getLandmark(frame, "leftWrist");
```

## What else it does

- Measure named angles and distances between landmarks.
- List the cameras and frame rates a phone supports.
- Record and replay landmark sessions (pose data, not video).
- Analyze a local photo, or sample a local video with cancel.
- Pick one of up to six detected poses.
- Opt in to segmentation masks, with explicit release and backpressure.

Every prop and event is typed in the published package. The [runnable example](example/app.tsx) shows permissions, camera switching, pause and resume, error recovery and feedback.

## For agents

The repo ships an [Agent Skill](skills/expo-mediapipe-pose/SKILL.md) with the install steps, a minimal camera, common tasks and common mistakes. Add it to your coding agent:

```sh
npx skills add YosefHayim/expo-mediapipe-pose
```

[llms.txt](llms.txt) is a short reading list for tools that accept it.

## FAQ

<details>
<summary>Does it work in Expo Go, a bare React Native app, or a browser?</summary>

It needs an iOS or Android development build; Expo Go cannot load the native module. A bare React Native app needs [Expo modules installed](https://docs.expo.dev/bare/installing-expo-modules/). There is no browser backend in the package; the browser page above uses MediaPipe's own web SDK.

</details>

<details>
<summary>What does it add to MediaPipe?</summary>

A React Native camera component, typed events, skeleton styling, named geometry, rule hooks, photo and video analysis and mask ownership. It uses Google's official MediaPipe Tasks SDKs and model as they are, so it adds no new model and claims no better accuracy.

</details>

<details>
<summary>Is it a drop-in replacement for ThinkSys/mediapipe-reactnative?</summary>

No. Replace `RNMediapipe` with `PoseCameraView`, use the camera props and `SkeletonOptions`, then rebuild and check your overlay coordinates.

</details>

<details>
<summary>Can I use it from a Swift-only or Kotlin-only app?</summary>

No. The Swift and Kotlin code is the Expo bridge, not a separate SDK. For a fully native app, start with Google's [iOS](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/ios) or [Android](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/android) guide.

</details>

<details>
<summary>Do frames leave the phone?</summary>

No. Inference runs on the phone, and the library uploads nothing and downloads no model. Recordings hold landmarks and metadata, not camera video.

</details>

<details>
<summary>Does a pose index follow the same person across frames?</summary>

No. `poseIndex` picks within one result only. Reset rules and tracking when your selection changes.

</details>

<details>
<summary>Why do segmentation results report backpressure?</summary>

At most two mask leases can be open per module. Call `releasePoseSegmentation` when you finish with one, including on errors and unmount; the overlay does not release them for you.

</details>

<details>
<summary>Which models are included, and what do the tests prove?</summary>

Only the full pose model is bundled; lite and heavy need a local model file. Native builds, behavior tests and public photo and video fixtures check the integration. They do not prove physical-camera alignment, long-session speed or medical accuracy. Rep counting and exercise scoring are left to your app.

</details>

## Develop

Use Node 24 (`nvm use`) and the pinned pnpm.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm verify:package
pnpm --filter pose-camera-example ios
```

`pnpm check` runs [Biome](https://biomejs.dev/), [knip](https://knip.dev/), typecheck, tests and builds for the package, the example and the [site](site/README.md) through [Turborepo](https://turborepo.dev/). The [native fixture runner](example/fixtures/README.md) runs real SDK inference on public images and videos. Report bugs with device, OS, SDK and model details in [GitHub Issues](https://github.com/YosefHayim/expo-mediapipe-pose/issues).

## License

[MIT](LICENSE). This project grew from [ThinkSys/mediapipe-reactnative](https://github.com/ThinkSys/mediapipe-reactnative); its attribution and the MediaPipe notices are kept in [third-party notices](THIRD_PARTY_NOTICES.md). The native inference SDKs and the pose model come from Google.
