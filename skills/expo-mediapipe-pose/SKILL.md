---
name: expo-mediapipe-pose
description: Adds on-device pose tracking to an Expo or React Native app with expo-mediapipe-pose (camera skeleton, joint angles, body-landmark rules, photo and video analysis). Use it when a task asks for pose detection, joint angles, or feedback based on body landmarks in an Expo app.
---

# expo-mediapipe-pose

On-device pose detection for Expo and React Native, built on Google's MediaPipe Pose Landmarker. Frames stay on the device: the module does not upload camera data or download models.

## When to use it

- Use it for a camera pose view with a skeleton, named landmarks, angles and distances, rules with hold times, local photo or video analysis, landmark recording and replay, and opt-in segmentation masks.
- It needs an iOS or Android development build. Expo Go cannot load the native module, and there is no browser inference.
- Do not use it for repetition counting, exercise scoring or medical judgments. Those stay in the app.
- Do not use the internal Swift or Kotlin code as a standalone SDK.

## Install

```sh
pnpm add expo-mediapipe-pose
pnpm exec expo install react-native-svg expo-camera
```

`expo-camera` is used for the permission only; another permission provider also works. Set the permission text in the app config, then rebuild:

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

Version 0.4.0 targets Expo SDK 58, React Native 0.88 and React 19.3. Native dependency or config changes need a new development build. Check the installed version before using any API.

## Minimal example

Mount the view only after camera permission is granted. It fills its layout bounds and draws the skeleton by default.

```tsx
import { PoseCameraView } from "expo-mediapipe-pose";

<PoseCameraView
  style={{ flex: 1 }}
  cameraFacing="front"
  frameLimit={15}
  isActive={screenIsFocused}
  onLandmark={frame => handlePose(frame.landmarks)}
  onInferenceError={error => showCameraError(error.code)}
/>
```

Set `isActive={false}` when the screen loses focus: capture stops but the view stays mounted. Tie `isActive` to screen focus and app foreground state.

## Common tasks

### Style joints and body parts

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

Styling changes the overlay only, not the detector or the raw results, and does not restart capture. Single overrides beat global styles. `skeleton={false}` turns the built-in overlay off so you can draw your own. Body parts are the keys of `BODY_PARTS`.

### Read angles and distances

Import from `expo-mediapipe-pose/core` for pure helpers that need no native view.

```ts
import { getImageJointAngle, getImageDistance, getLandmark } from "expo-mediapipe-pose/core";

const input = { landmarks: frame.landmarks, imageSize: frame.imageSize };
const elbow = getImageJointAngle(input, "leftShoulder", "leftElbow", "leftWrist", { minVisibility: 0.6 });
if (elbow.status === "available") use(elbow.value); // degrees
```

- `getImageJointAngle` (degrees) and `getImageDistance` (pixels) take `{ landmarks, imageSize }`.
- `getWorldJointAngle` and `getWorldDistance` (meters) take `{ worldLandmarks }`.
- A result is `{ status: "available", value, unit }` or `{ status: "unavailable", reason }`. Always handle the unavailable case.
- `getLandmark(frame, "leftWrist")` reads one named landmark.

### Rules with hysteresis

The app defines the condition. `usePoseRule` adds the confidence check, hold time, stale-input handling and transition callbacks.

```tsx
const raisedArm = usePoseRule({
  landmarks: ["leftWrist", "leftShoulder"],
  minVisibility: 0.6,
  holdMs: 250,
  isActive: screenIsFocused,
  evaluate: pose => pose.leftWrist.y < pose.leftShoulder.y,
  onChange: status => handleArmStateChange(status),
});

<PoseCameraView
  isActive={screenIsFocused}
  onLandmark={raisedArm.update}
  onCameraConfigured={raisedArm.reset}
  onInferenceError={raisedArm.reset}
  skeleton={{ bodyParts: ["leftArm"], color: colorFor(raisedArm.status) }}
/>
```

- Status is `pass`, `fail` or `unknown`. `unknown` means missing, uncertain or stale landmarks. It is not a failure.
- `onChange` fires only on transitions. Show text or icons next to color.
- Use `usePoseRules` for several named rules at once, and `usePoseTracking` for pose presence.
- Outside React, use `definePoseRule`, `evaluatePoseRule` and `advancePoseRule`.

### Choose camera and frame rate

- Props: `cameraFacing`, `cameraLens`, `cameraZoomFactor`, `previewFps`, `frameLimit`, `callbackFps`.
- `previewFps` sets capture, `frameLimit` limits inference, `callbackFps` limits JavaScript delivery. A lower `callbackFps` does not reduce detector work.
- `getCameraCapabilities()` lists selectable cameras and frame rates. `onPerformanceMetrics` reports measured work. No requested rate is guaranteed.

### Record and replay

```ts
const recorder = createPoseRecorder({ maxFrames: 1800 });
recorder.start();
recorder.append(frame);          // from onLandmark
const recording = recorder.stop();
const text = serializePoseRecording(recording);   // parsePoseRecording(text) reads it back
```

Replay with `usePoseReplay(recording, { onFrame, onReset, onStateChange })`, or `createPoseReplay` outside React. The controller has `play`, `reset`, `setSpeed` and `dispose`. For photo and video results use `createPoseDetectionRecorder` and `createPoseDetectionReplay`. Recordings hold landmarks and metadata, not camera video or masks.

### Photo and video input

```ts
const detection = await analyzePoseImage(localFileUri, { maxPoses: 2 });

for await (const sample of analyzePoseVideo(localVideoUri, { samplingFps: 5, signal, onProgress })) {
  handle(sample.detection, sample.timestampMs);
}
```

Inputs are local file locations. Video is sampled, and `signal` (an `AbortSignal`) cancels it. Image options include `segmentationEnabled`, `maskMaxDimension`, `maxPoses`, `modelVariant`, `modelPath`, `maxImageDimension` and the two confidence minimums.

### Multiple poses

`maxPoses` allows up to six poses. `poseIndex` and `selectPose` pick one pose from a result. Indices are not persistent person identities. Reset rules and tracking when the selection changes.

### Segmentation masks

Set `segmentationEnabled` and draw with `PoseSegmentationOverlay` (`segmentation`, `width`, `height`, `poseIndex`, `color`, `opacity`). At most two mask results can be outstanding. Call `releasePoseSegmentation` when you finish with one, including on errors and on unmount. The overlay does not release files for you.

## Landmark names

The 33 landmarks are in the exported `LANDMARK_NAMES` array. The array position is the landmark index. `POSE_CONNECTIONS` lists the skeleton lines and `BODY_PARTS` groups the names. Do not type names from memory: import the array or use the `LandmarkName` type.

## Common mistakes

- Running in Expo Go: build a development build instead.
- Forgetting to rebuild after install or config changes.
- Mounting the view before camera permission is granted.
- Treating `unknown` as failure, or ignoring the `unavailable` measurement case.
- Mirroring coordinates twice for the front camera.
- Treating a pose index as a person identity across frames.
- Not releasing segmentation masks. Call `releasePoseSegmentation`.
- Expecting a lower `callbackFps` to save detector work, or a guaranteed frame rate.
- Using lite or heavy models without a local `modelPath`. Only the full model is bundled.
- Importing from the main entry in plain Node tests. Use `expo-mediapipe-pose/core`.
- Inventing API names. Check the exports in the package declarations.

## Links

- README: https://github.com/YosefHayim/expo-mediapipe-pose#readme
- Live site and playground: https://yosefhayim.github.io/expo-mediapipe-pose/
- Index for tools: https://raw.githubusercontent.com/YosefHayim/expo-mediapipe-pose/main/llms.txt
- Runnable example: https://github.com/YosefHayim/expo-mediapipe-pose/blob/main/example/app.tsx
