# expo-mediapipe-pose

On-device pose landmarks for [Expo](https://docs.expo.dev/) and [React Native](https://reactnative.dev/), using Google's [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).

This is a community library. It is not an official Expo or Google package.

## Why

The app **reads the full body by joint name**. `landmarks` has all 33 MediaPipe joints, so `landmarks.nose`, `landmarks.leftWrist`, and `landmarks.rightAnkle` are the same pose. The same `PoseFrame` comes from the live camera, a photo, and a video. This package draws that skeleton.

## Quick start

You need a [development build](https://docs.expo.dev/develop/development-builds/introduction/). **Expo Go cannot load it.**

```sh
npx expo install expo-mediapipe-pose react-native-svg
npx expo run:ios
npx expo run:android
```

[`react-native-svg`](https://docs.swmansion.com/react-native-svg/) is only there so the skeleton can draw. The pose model is bundled. There is no other runtime dependency.

At prebuild, the config plugin writes the iOS usage sentence (`NSCameraUsageDescription`). Android already declares `CAMERA` in this package.

```json
{
  "plugins": [
    ["expo-mediapipe-pose", "Allow this app to detect your pose."]
  ]
}
```

Leave the sentence out and the plugin uses "Allow this app to use the camera to detect your pose."

An app that does not prebuild must set `NSCameraUsageDescription` itself. The camera view does not ask. If permission is missing, `onPoseFailure` reports `cameraPermission` and the preview stays closed.

```tsx
import { Button } from "react-native";
import { PoseCameraView, usePoseCamera } from "expo-mediapipe-pose";

export function PoseScreen() {
  const camera = usePoseCamera({
    isCameraRunning: true,
    cameraFacing: "front",
  });

  const isClosed = camera.permission != "granted";

  if (isClosed) {
    return <Button title="Allow camera" onPress={camera.askForCamera} />;
  }

  return (
    <PoseCameraView
      style={{ flex: 1 }}
      isCameraRunning={camera.isCameraRunning}
      cameraFacing={camera.cameraFacing}
      onPoseFrame={camera.readFrame}
      onPoseFailure={camera.readFailure}
    />
  );
}
```

`camera.frame.landmarks` is the full body. `leftWrist` is one of those 33 joints. A denied dialog sets `camera.permission` to `"denied"`.

## Usage

### Camera

`usePoseCamera` keeps the permission, the latest full pose, and the last failure. Pass the settings you want to control. It fills the defaults and returns those too, so the view can be filled from `camera`.

```tsx
import { Button } from "react-native";
import { PoseCameraView, usePoseCamera } from "expo-mediapipe-pose";

export function PoseScreen() {
  const camera = usePoseCamera({
    isCameraRunning: true,
    cameraFacing: "front",
    poseModel: "full",
    poseDelegate: "gpu",
    maxPoseCount: 1,
    poseFrameRate: 30,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    skeletonRendering: "shown",
    skeletonColor: "#38bdf8",
    skeletonJoints: [
      { landmarkName: "leftWrist", shown: "hidden" },
      { landmarkName: "rightWrist", shown: "hidden" },
      { landmarkName: "leftShoulder", color: "#f97316" },
      { landmarkName: "leftElbow", color: "#f97316" },
    ],
  });

  const isClosed = camera.permission != "granted";

  if (isClosed) {
    return <Button title="Allow camera" onPress={camera.askForCamera} />;
  }

  return (
    <PoseCameraView
      style={{ flex: 1 }}
      isCameraRunning={camera.isCameraRunning}
      cameraFacing={camera.cameraFacing}
      poseModel={camera.poseModel}
      poseDelegate={camera.poseDelegate}
      maxPoseCount={camera.maxPoseCount}
      poseFrameRate={camera.poseFrameRate}
      minPoseDetectionConfidence={camera.minPoseDetectionConfidence}
      minPosePresenceConfidence={camera.minPosePresenceConfidence}
      minTrackingConfidence={camera.minTrackingConfidence}
      skeletonRendering={camera.skeletonRendering}
      skeletonColor={camera.skeletonColor}
      skeletonJoints={camera.skeletonJoints}
      onPoseFrame={camera.readFrame}
      onPoseFailure={camera.readFailure}
    />
  );
}
```

`camera.frame` is the full pose: all 33 `landmarks`, `worldLandmarks`, every person in `poses`, the timestamp, the image size, and `cameraFacing`. `camera.failure` is the last failure. A dialog that fails sets `camera.failure.reason` to `cameraPermission`.

Changing `poseModel` reloads the landmarker. Changing `poseFrameRate` does not. `requestCameraPermission()` is still there when you want the dialog without the hook.

### Named landmarks

`LANDMARK_NAMES` is the 33 MediaPipe joints, in MediaPipe order. A missing joint is `null`. It is not a failure.

`landmarks` is the first person. `poses` lists every person in that frame. The list order is not a stable identity.

`worldLandmarks` are meters from the hip midpoint. `pointInImage(landmarks.nose, imageWidth, imageHeight)` turns a normalized point into image pixels.

### Skeleton

`skeletonRendering` is `"shown"` by default. `"hidden"` still calls `onPoseFrame`. The skeleton color defaults to `#38bdf8`. A joint is skipped when it is missing or its visibility is below 0.5.

`skeletonJoints` lists joints to hide or recolor. A joint left off the list stays shown in `skeletonColor`. `shown: "hidden"` drops that joint from the drawing only. The pose still has the landmark. A bone is drawn when both ends are shown and visible. The line uses the first joint's color, or `skeletonColor` when that joint has none. The same list works on `PoseCameraView` and `PoseSkeleton`. Listing a name twice throws. List only the joints you want to change.

A photo has no switch. Place `PoseSkeleton` on the image, or skip it.

```tsx
import { PoseSkeleton } from "expo-mediapipe-pose";

<PoseSkeleton
  poseFrame={poseFrame}
  viewWidth={width}
  viewHeight={height}
  skeletonJoints={[
    { landmarkName: "nose", color: "#fafafa" },
    { landmarkName: "leftEye", shown: "hidden" },
    { landmarkName: "rightEye", shown: "hidden" },
  ]}
/>
```

### Photo and video

`usePosePhoto` stores one frame. `usePoseVideo` stores every sampled frame, in order. `read` keeps the error message on `failure` instead of throwing. The functions are there when you want the frame back yourself.

```tsx
export function PhotoScreen() {
  const photo = usePosePhoto();
  const poseFrame = photo.frame;
  const isMissing = poseFrame == null;

  async function handleReadPress() {
    await photo.read({ path: photoPath, poseModel: "heavy" });
  }

  if (isMissing) return <Button title="Read photo" onPress={handleReadPress} />;

  return (
    <PoseSkeleton poseFrame={poseFrame} viewWidth={width} viewHeight={height} />
  );
}

export function VideoScreen() {
  const clip = usePoseVideo();
  const shownFrame = clip.shownFrame;
  const isMissing = shownFrame == null;

  async function handleReadPress() {
    await clip.read({ path: videoPath, sampleFrameRate: 5 });
  }

  if (isMissing) return <Button title="Read video" onPress={handleReadPress} />;

  return (
    <PoseSkeleton
      poseFrame={shownFrame}
      viewWidth={width}
      viewHeight={height}
    />
  );
}

const photoFrame = await readPosePhoto({ path: photoPath });
const videoFrames = await readPoseVideo({
  path: videoPath,
  sampleFrameRate: 5,
});
```

A photo has no frame rate. A bad path throws from `readPosePhoto` and `readPoseVideo`, and the message includes that path. The hooks store that same message on `failure`. A still frame's `timestampMs` is 0.

### Model and frame rate

`poseModel` is `"lite"`, `"full"`, or `"heavy"`. The default is `"full"`. All three models ship with the package. A local `.task` file can be passed as `poseModelPath` and wins over the bundled model.

`poseFrameRate` is how many camera frames per second are sent to the landmarker. It is a whole number from 1 to 60, default 30.

### Settings

| Setting | Default |
| --- | --- |
| `maxPoseCount` | 1, whole number from 1 to 6 |
| `minPoseDetectionConfidence` | 0.5 |
| `minPosePresenceConfidence` | 0.5 |
| `minTrackingConfidence` | 0.5 |
| `poseDelegate` | `"gpu"` (`"cpu"` also works) |

These match the [Pose Landmarker options](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker). A confidence outside 0 to 1 throws.

## How it works

MediaPipe has no fps setting of its own. `poseFrameRate` chooses how many live frames are sent. The preview stays smooth while this number changes, and the landmarker is not reloaded. A live stream can still drop a frame when the landmarker is busy.

Changing `poseModel` reloads the landmarker. The live camera keeps video mode on a background queue.

Video samples timestamps before MediaPipe's video mode, which does not drop frames. The default sample rate is 5. More than 1000 frames throws. Ask for a lower `sampleFrameRate`.

Photo and video use the image and video tasks.

## Status and scope

Active community library. Person masks and a public running-mode switch are not part of this library.

Build success does not prove camera alignment or speed on a device. Pose order is not a person id. This library does not score exercises, record video, or return a person mask.

The bundled models are Google's float16 pose landmarker lite, full, and heavy, version 1. Checksums are checked in `src/package-contents.test.ts`.

## Help

`onPoseFailure` receives one reason:

| Reason | When |
| --- | --- |
| `cameraPermission` | The view opened without permission. It does not ask. |
| `modelLoad` | The model file did not load. |
| `cameraRuntime` | The camera stopped while it was open. |
| `cameraConfiguration` | The camera could not be configured. |
| `inferenceRuntime` | A frame failed inside the landmarker. |
| `nativeViewInitialization` | The native view did not start. |
| `unreadableEvent` | A native event could not be read. |

An empty person is a normal `PoseFrame` whose joints are `null`.

## Development

From the repo root, with [Node.js](https://nodejs.org/) 24 and [pnpm](https://pnpm.io/):

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` is lint, typecheck, test, and build. The example app in `example/` is not in the npm package. Instructions for coding agents are in [Agents.md](Agents.md).

## License

MIT.
