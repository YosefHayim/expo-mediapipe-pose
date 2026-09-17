# Oly Pose Camera

`@oly/pose-camera` is Oly's Expo native camera module. It connects AVFoundation on iOS and CameraX on Android directly to Google's MediaPipe Tasks SDK. Camera frames and pose inference remain on the device. React receives joint coordinates and capture telemetry.

This private repository owns the implementation and its fixes. Oly-App consumes a commit-pinned archive from this repository; it contains no local native patches. The preceding ThinkSys implementation remains in Git history, with attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Use in an Expo app

Requires Expo SDK 57, React Native 0.86, React 19.2, and Effect 3.21. Use a development build; Expo Go cannot load custom native modules.

```tsx
import { PoseCameraView } from '@oly/pose-camera';

<PoseCameraView
  style={{ width: 390, height: 844 }}
  cameraFacing="front"
  frameLimit={15}
  onCameraConfigured={handleCameraConfigured}
  onLandmark={handlePoseFrame}
  onInferenceError={handleCameraFailure}
/>
```

Obtain camera permission before mounting (Oly uses `expo-camera`), and configure `NSCameraUsageDescription` in the app. Android camera permission is declared by this module. Rebuild the native app after changing its pinned module commit.

| Prop | Default | Behavior |
| --- | --- | --- |
| `cameraFacing` | `front` | `front` or `back`; preview and inference mirror together on front. |
| `cameraLens` | `auto` | iOS rear auto prefers ultra-wide, falling back to wide. Android uses its default wide camera and acknowledges that fallback. |
| `cameraZoomFactor` | `1` | Clamped to the selected device's supported range, never below 1. |
| `frameLimit` | `30` | Inference cadence cap, 1–60. Oly requests 15. |
| `poseModelVariant` | `full` | `lite`, `full`, or `heavy`. Only full is bundled. |
| `poseModelAssetPath` | omitted | Absolute local path or `file://` URI. Required for lite/heavy; never fetched by the module. |

`onCameraConfigured` acknowledges the effective lens, facing, zoom, mirroring, and capture dimensions before pose events. `onLandmark` includes normalized image coordinates, world coordinates, optional visibility/presence, and timing/model/thermal metadata. Empty landmark arrays are valid no-person heartbeats. `onInferenceError` carries a stable code without raw exceptions or file paths.

Changing camera/model props restarts capture. Backgrounding or detaching releases the camera and detector; returning restarts them. Events from previous capture generations are discarded. The app owns retry policy, calibration, skeleton drawing, and scoring.

## Native pipeline

| Platform | SDK | Delegate | Capture |
| --- | --- | --- | --- |
| iOS | MediaPipeTasksVision 0.10.14 | GPU | AVFoundation, 720p preference, late frames discarded |
| Android | tasks-vision 0.10.29 | CPU | CameraX 1.4.2, 720p preference, keep latest frame |

One pose, detection/presence/tracking confidence 0.35. Sequential VIDEO-mode inference runs on a dedicated serial worker, using monotonic timestamps and capture-time metadata. Camera backpressure bounds queued frames; inference never blocks the UI thread. The SDK versions, model bytes, confidence gates, and delegates match the previous Oly configuration. This does not establish performance or accuracy parity: compare on physical devices before release.

The bundled [Google full float16 model, version 1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task) has SHA-256 `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`. Both platforms package the same file from `assets/`.

## Develop and review fixes

Clone this repository beside Oly-App. Create a branch, edit here, and open a pull request against `oly-native`. During development, use a local `file:` dependency in an isolated Oly checkout. Run:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Build Oly for iOS and Android after native changes. On physical phones verify front/back preview and skeleton alignment, portrait/landscape, supported lens/zoom, empty detections, denied permission, model switches, background/resume, and repeated mount/unmount. Compare cadence, latency, and thermal behavior during a long session.

After review, replace Oly's dependency with `https://api.github.com/repos/YosefHayim/mediapipe-reactnative/tarball/<full-commit-sha>` and update its lockfile. Its scoped `.npmrc` reads `MEDIAPIPE_GITHUB_TOKEN`; CI/EAS needs repository Contents:read access. Never commit a token. No prepare/build scripts run when this package is installed: Metro consumes TypeScript and Expo autolinks the Swift/Kotlin module.

References: [Expo Modules](https://docs.expo.dev/modules/overview/), [Google iOS guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/ios), [Google Android guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/android).
