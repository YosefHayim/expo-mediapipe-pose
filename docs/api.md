# API

## PoseCameraView

The component accepts React Native `ViewProps`, including `style`, `onLayout` and overlay children. Give it non-zero bounds. Obtain camera permission before mounting.

| Prop | Default | Meaning |
| --- | --- | --- |
| `isActive` | `true` | Releases capture/detector when false; recreates them when true. Use screen focus and foreground state. |
| `cameraFacing` | `front` | `front` or `back`. Preview and inference input mirror together on front. |
| `cameraLens` | `auto` | `auto`/`wide` select the default wide camera. Explicit `ultraWide` works on supported iOS cameras; unavailable requests fail. Android rejects `ultraWide`. |
| `cameraZoomFactor` | `1` | Finite value at least 1, clamped to supported device bounds. Applied zoom is acknowledged. |
| `frameLimit` | `30` | Integer 1–60; caps inference cadence. Actual cadence depends on camera and inference throughput. |
| `poseModelVariant` | `full` | `full`, `lite` or `heavy`. Only full is bundled. |
| `poseModelAssetPath` | `null` | Absolute local file path or `file://` URI. Required for lite/heavy. No model download occurs in the module. |
| `minPoseDetectionConfidence` | `0.35` | MediaPipe detector threshold, 0–1. |
| `minPosePresenceConfidence` | `0.35` | MediaPipe pose-presence threshold, 0–1. |
| `minTrackingConfidence` | `0.35` | MediaPipe tracking threshold, 0–1. |
| `skeleton` | `true` | `false`, `true`, or `SkeletonOptions`. Disabled overlays avoid internal per-frame React state updates. |

`onCameraConfigured(configuration)` acknowledges effective facing/lens/zoom, mirroring and actual inference dimensions before landmarks. `onLandmark(frame)` is optional. `onInferenceError(error)` reports a stable code. Changing capture/model options restarts capture; changing skeleton styles does not. Backgrounding/detaching stops native work. Events from earlier capture generations are discarded.

## Frames and coordinates

`PoseFrame` contains `landmarks`, `worldLandmarks` and `additionalData`. Each landmark has `x`, `y`, `z` and optional `visibility` / `presence`. Arrays follow MediaPipe's 33-landmark ordering. Empty arrays are valid no-person heartbeats. Offscreen coordinates are retained, not clamped.

Image coordinates refer to the upright inference image, with front-camera mirroring already applied. Image `x` increases rightward, `y` downward. World coordinates are the model's hip-centered 3D estimates in meters; do not project them as image coordinates. Landmark names follow MediaPipe's anatomical labels; avoid treating left as “left side of the screen.”

The built-in overlay uses centered aspect-fill projection. On Android, capture and preview share a CameraX viewport and the detector uses its crop rectangle. On iOS, video and preview share interface orientation/mirroring. `projectLandmark(joint, imageSize, viewSize)` performs the image-to-view scale/crop mapping; do not mirror a returned point again. A custom camera with another crop/rotation needs its own transform.

Metadata includes dimensions, effective camera settings, frame number, model source/variant/delegate, luminance and thermal state. `receivedAtMs` is Unix time sampled when the analyzer handles the frame, not a sensor capture timestamp. `inferenceDurationMs` measures the synchronous detector call, excluding image preprocessing and result mapping. `frameNumber` starts over after reconfiguration. `poseModelSource` is `bundled` or `local`. Thermal state is `unknown` when Android cannot provide it.

## SkeletonOptions and PoseSkeleton

`SkeletonOptions` supports `color`, `jointRadius`, `lineWidth`, `minVisibility`, `bodyParts`, `landmarks`, `joints` and `connections`. Defaults are green (`#22c55e`), radius 4, width 3, and minimum visibility 0.5.

Supported body parts: `face`, `leftArm`, `rightArm`, `leftWrist`, `rightWrist`, `torso`, `leftLeg`, `rightLeg`, `leftAnkle`, `rightAnkle`. Wrist groups include the hand landmarks; ankle groups include heel and foot landmarks. An omitted list selects all groups, an empty list selects none. Selected groups form a union; shared joints appear once. An optional `landmarks` list further restricts the selection. This reproduces the body-region controls of the preceding ThinkSys integration with one typed selection API.

`joints` maps landmark names to `{ color, radius }` overrides. `connections` maps keys such as `leftElbow:leftWrist` to `{ color, width }` overrides; see exported `POSE_CONNECTIONS` for canonical order. An edge renders only when both endpoints are selected and visible. Missing visibility is treated as unknown and is not rendered. The camera clears stale overlay frames after 500 ms and clears them on camera reconfiguration/error.

`PoseSkeleton` is also exported independently. Supply `frame`, view `width`/`height`, and the styling options. Its parent is responsible for clipping, stale-frame handling and using a matching preview transform.

## Named landmarks and rules

`LANDMARK_NAMES`, `BODY_PARTS` and `POSE_CONNECTIONS` describe topology. `getLandmark(frame, name)` returns a joint or `undefined`. `getNamedLandmarks(frame)` returns the present joints by name. Pure helpers are available from `expo-mediapipe-pose/core`, without native-view initialization.

`usePoseRule({ landmarks, evaluate, minVisibility, holdMs, staleAfterMs, isActive, onChange })` returns `{ status, update, reset }`.

- `landmarks`: non-empty list required by the predicate. Its names determine the typed `evaluate` input.
- `evaluate`: synchronous application function returning a boolean. It is called only when all required joints have adequate visibility and, when available, presence. Errors thrown by application functions are not swallowed.
- `minVisibility`: defaults to 0.6; must be 0–1. Missing confidence or coordinates yields `unknown`.
- `holdMs`: defaults to 0; non-negative duration a candidate condition must remain consistent before committing. The prior committed result stays visible during confirmation. Unknown input clears it immediately.
- `staleAfterMs`: defaults to 500; positive interval without an update before invalidating feedback. No new frame is needed to expire it.
- `isActive`: defaults to true. Set false when pausing/backgrounding and pass the same intent to the camera.
- `onChange`: receives `pass`, `fail` or `unknown` only when the committed state changes. The initial unknown state is not a transition notification.

Connect `update` to `onLandmark`, and `reset` to camera configuration/error callbacks. The hook also detects restarted frame counters. Threshold, landmark, duration and active-state changes reset history. Inline predicates/callbacks use their latest committed versions; call `reset` when changing the semantic meaning of a predicate and you need a fresh hold window. Unmount clears its timer. Conditions run on the JS thread, so keep them small and synchronous.

## Errors and recovery

Codes: `cameraPermission`, `cameraConfiguration`, `cameraRuntime`, `modelInitialization`, `inferenceRuntime`, `nativeViewInitialization`, `invalidNativeEvent`. Native payloads never include raw exceptions or device paths. Invalid payloads report `invalidNativeEvent`, rather than being presented as valid detection results.

Native failures release camera/detector resources and invalidate queued frames. The application owns recovery. After correcting permissions/options, toggle `isActive` or remount using a new React `key`. Use bounded retries appropriate to your UI. Empty detections are not errors.

## Native dependencies

| Platform | Capture | SDK | Delegate |
| --- | --- | --- | --- |
| iOS | AVFoundation | MediaPipeTasksVision 0.10.14 | GPU |
| Android | CameraX 1.4.2 | tasks-vision 0.10.29 | CPU |

Both use one pose and sequential VIDEO-mode inference on a serial worker. SDKs are deliberately pinned; version numbers alone do not establish parity. The bundled model is [Google's full float16 version 1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task), SHA-256 `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`.

## Migration

From ThinkSys: replace `RNMediapipe` with `PoseCameraView`; use a React Native `style` for sizing, controlled `cameraFacing` instead of global `switchCamera()`, and `skeleton.bodyParts` instead of body-part boolean props. Read typed raw results in `onLandmark`; rendering selection does not remove detections.

From the private `@oly/pose-camera` 0.1 integration: change the package import and rebuild for the renamed native module. Skeleton rendering now defaults to enabled; pass `skeleton={false}` for an existing application overlay. `auto` now selects the default wide camera consistently. Unsupported explicit ultra-wide selection errors instead of silently switching lenses. Metadata uses `receivedAtMs` instead of the misleading `capturedAtMs`, and `local` instead of `downloaded`. Thermal state can be `unknown`. The existing Oly consumer remains on its pinned older commit until explicitly migrated.
