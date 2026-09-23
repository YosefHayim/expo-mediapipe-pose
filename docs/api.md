# API

This document describes `main`, including unreleased additions. For the tagged source installation, use the [v0.2.0 API](https://github.com/YosefHayim/expo-mediapipe-pose/blob/v0.2.0/docs/api.md).

## PoseCameraView

The component accepts React Native `ViewProps`, including `style`, `onLayout` and overlay children. Give it non-zero bounds. Obtain camera permission before mounting.

| Prop | Default | Meaning |
| --- | --- | --- |
| `isActive` | `true` | Releases capture/detector when false; recreates them when true. Use screen focus and foreground state. |
| `cameraFacing` | `front` | `front` or `back`. Preview and inference input mirror together on front. |
| `cameraLens` | `auto` | `auto`/`wide` select the default wide camera. Explicit `ultraWide` works on supported iOS cameras; unavailable requests fail. Android rejects `ultraWide`. |
| `cameraZoomFactor` | `1` | Finite value at least 1, clamped to supported device bounds. Applied zoom is acknowledged. |
| `frameLimit` | `30` | Integer 1–60; caps inference cadence without restarting the detector. |
| `previewFps` | `30` | Integer 1–60; native capture target. Unsupported device rates report `cameraConfiguration`. Changes reconfigure capture. |
| `callbackFps` | `30` | Integer 1–60; caps landmark events delivered to JavaScript without restarting capture. |
| `poseModelVariant` | `full` | `full`, `lite` or `heavy`. Only full is bundled. |
| `poseModelAssetPath` | `null` | Absolute local file path or `file://` URI. Required for lite/heavy. No model download occurs in the module. |
| `minPoseDetectionConfidence` | `0.35` | MediaPipe detector threshold, 0–1. |
| `minPosePresenceConfidence` | `0.35` | MediaPipe pose-presence threshold, 0–1. |
| `minTrackingConfidence` | `0.35` | MediaPipe tracking threshold, 0–1. |
| `skeleton` | `true` | `false`, `true`, or `SkeletonOptions`. Disabled overlays avoid internal per-frame React state updates. |

`onCameraConfigured(configuration)` acknowledges effective facing/lens/zoom, mirroring and actual inference dimensions before landmarks. `onLandmark(frame)` is optional. `onInferenceError(error)` reports a stable code. Changing capture/model options restarts capture; changing skeleton styles does not. Backgrounding/detaching stops native work. Events from earlier capture generations are discarded.

## Frame rates and performance

For a 30 fps capture target with 15 fps inference and 5 fps JavaScript landmark delivery, set `previewFps={30}`, `frameLimit={15}` and `callbackFps={5}`. These are independent cadence targets/limits, not guaranteed throughput. Native scheduling permits frames up to the smaller of 5 ms or one quarter of an interval early to absorb arrival jitter; it preserves a fixed deadline and never runs catch-up bursts after a long gap. The limits describe sustained cadence, not a strict minimum time between every pair of events. Result cadence cannot exceed inference cadence. Lowering callback FPS reduces event conversion/bridge work; it does not reduce detector work. Lowering the inference limit skips detector calls while keeping preview capture active. Intermediate camera frames may also be dropped by the platform when the analyzer is busy.

`onPerformanceMetrics(metrics)` enables optional measurements approximately once per second while frames arrive. `intervalMs` is the measured window. `observedFrames`, `inferenceCount`, `resultCount` and `skippedInferenceFrames` count analyzer arrivals, completed inferences, dispatched results and rate-limited inference skips. `observedFps`, `inferenceFps` and `resultFps` divide their counts by the window duration. `averageInferenceDurationMs` is null when the window contains no completed inference. Observed FPS is analyzer throughput, not display refresh or the sensor's total frame count; platform-dropped frames are not counted. Stopping capture stops metrics, and restarting resets the window. Changing processing rates preserves detector tracking and frame numbering.

Low callback rates require an appropriate `usePoseRule.staleAfterMs`; the hook's default remains 500 ms. Metrics exclude preprocessing and bridge delivery time. No automatic quality switching or thermal policy is applied.

## Frames and coordinates

`PoseFrame` contains `landmarks`, `worldLandmarks` and `additionalData`. Each landmark has `x`, `y`, `z` and optional `visibility` / `presence`. Arrays follow MediaPipe's 33-landmark ordering. Empty arrays are valid no-person heartbeats. Offscreen coordinates are retained, not clamped.

Image coordinates refer to the upright inference image, with front-camera mirroring already applied. Image `x` increases rightward, `y` downward. World coordinates are the model's hip-centered 3D estimates in meters; do not project them as image coordinates. Landmark names follow MediaPipe's anatomical labels; avoid treating left as “left side of the screen.”

The built-in overlay uses centered aspect-fill projection. On Android, capture and preview share a CameraX viewport and the detector uses its crop rectangle. On iOS, video and preview share interface orientation/mirroring. `projectLandmark(joint, imageSize, viewSize)` performs the image-to-view scale/crop mapping; do not mirror a returned point again. A custom camera with another crop/rotation needs its own transform.

Metadata includes dimensions, effective camera settings, frame number, model source/variant/delegate, luminance and thermal state. `receivedAtMs` is Unix time sampled when the analyzer handles the frame, not a sensor capture timestamp. `inferenceDurationMs` measures the synchronous detector call, excluding image preprocessing and result mapping. `frameNumber` starts over after reconfiguration. `poseModelSource` is `bundled` or `local`. Thermal state is `unknown` when Android cannot provide it.

## SkeletonOptions and PoseSkeleton

`SkeletonOptions` supports `color`, `jointRadius`, `lineWidth`, `minVisibility`, `bodyParts`, `landmarks`, `joints` and `connections`. Defaults are green (`#22c55e`), radius 4, width 3, and minimum visibility 0.5.

Supported body parts: `face`, `leftArm`, `rightArm`, `leftWrist`, `rightWrist`, `torso`, `leftLeg`, `rightLeg`, `leftAnkle`, `rightAnkle`. Wrist groups include the hand landmarks; ankle groups include heel and foot landmarks. An omitted list selects all groups, an empty list selects none. Selected groups form a union; shared joints appear once. An optional `landmarks` list further restricts the selection. This reproduces the body-region controls of the preceding ThinkSys integration with one typed selection API.

`joints` maps landmark names to `{ color, radius }` overrides. `connections` maps keys such as `leftElbow:leftWrist` to `{ color, width }` overrides; see exported `POSE_CONNECTIONS` for canonical order. An edge renders only when both endpoints are selected and visible. Missing visibility is treated as unknown and is not rendered. The camera clears stale overlay frames after the greater of 500 ms or two expected result intervals (`2000 / Math.min(previewFps, frameLimit, callbackFps)`) and clears them on camera reconfiguration/error.

`PoseSkeleton` is also exported independently. Supply `frame`, view `width`/`height`, and the styling options. Its parent is responsible for clipping, stale-frame handling and using a matching preview transform.

## Named landmarks and rules

`LANDMARK_NAMES`, `BODY_PARTS` and `POSE_CONNECTIONS` describe topology. `getLandmark(frame, name)` returns a joint or `undefined`. `getNamedLandmarks(frame)` returns the present joints by name. Pure helpers are available from `expo-mediapipe-pose/core`, without native-view initialization.

`usePoseRule({ landmarks, evaluate, minVisibility, holdMs, staleAfterMs, isActive, onChange })` returns `{ status, update, reset }`.

- `landmarks`: non-empty list required by the predicate. Its names determine the typed `evaluate` input.
- `evaluate`: synchronous application function receiving `(pose, frame, previousOutcome)` and returning a boolean or `"unknown"`. Return `"unknown"` when a derived measurement is unavailable. `previousOutcome` is the previous evaluated outcome before hold confirmation; it enables stateful comparisons without mutable predicate closures. It is called only when all required joints have adequate visibility and, when available, presence. Errors thrown by application functions are not swallowed.
- `minVisibility`: defaults to 0.6; must be 0–1. Missing confidence or coordinates yields `unknown`.
- `holdMs`: defaults to 0; non-negative duration a candidate condition must remain consistent before committing. The prior committed result stays visible during confirmation. Unknown input clears it immediately.
- `staleAfterMs`: defaults to 500; positive interval without an update before invalidating feedback. No new frame is needed to expire it.
- `isActive`: defaults to true. Set false when pausing/backgrounding and pass the same intent to the camera.
- `resetKey`: optional string or finite number; change it to reset history when the meaning of an inline predicate changes.
- `onChange`: receives `pass`, `fail` or `unknown` only when the committed state changes. The initial unknown state is not a transition notification.

Connect `update` to `onLandmark`, and `reset` to camera configuration/error callbacks. The hook also detects restarted frame counters. Threshold, landmark, duration and active-state changes reset history. Inline predicates/callbacks use their latest committed versions; call `reset` when changing the semantic meaning of a predicate and you need a fresh hold window. Unmount clears its timer. Conditions run on the JS thread, so keep them small and synchronous.

## Angles and distances

`getImageJointAngle(input, start, vertex, end, options?)` and `getImageDistance(input, start, end, options?)` accept `{ landmarks, imageSize: { width, height } }`. Use the inference image dimensions (`frame.additionalData`), not preview bounds. Image angles use scaled x/y coordinates, excluding estimated z; distances are in inference-image pixels. This accounts for image aspect ratio and does not mirror coordinates again.

`getWorldJointAngle({ worldLandmarks }, start, vertex, end, options?)` and `getWorldDistance({ worldLandmarks }, start, end, options?)` use all three world axes. Angles are 0–180 degrees, with the middle named joint as the vertex. World distances are model estimates in meters, not calibrated physical measurements. These coordinate definitions follow [Google's Pose Landmarker output contract](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python#handle_and_display_results).

Every helper returns `{ status: "available", value, unit }` or `{ status: "unavailable", reason }`. Units are `degrees`, `pixels` or `meters`. Reasons are `missing-landmark`, `uncertain-landmark`, `invalid-coordinates` and `degenerate-angle`. An endpoint coinciding with the vertex makes the angle degenerate; zero distance is valid. Input arrays are never modified. `minVisibility` defaults to 0.6; present presence must also meet the threshold. Missing visibility remains unknown. Invalid confidence options or non-positive/non-finite image dimensions throw `RangeError`.

```tsx
const bentElbow = usePoseRule({
  landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
  holdMs: 250,
  evaluate: (_pose, frame) => {
    const angle = getImageJointAngle(
      { landmarks: frame.landmarks, imageSize: frame.additionalData },
      "leftShoulder", "leftElbow", "leftWrist",
    );
    if (angle.status === "unavailable") return "unknown";
    return angle.value < 90;
  },
});
```

The example app displays this rule alongside wrist-height feedback. Applications choose their own thresholds; the library does not assign exercise correctness or clinical meaning.

## Multiple rules and independent feedback

`usePoseRules({ ruleName: options, ... })` returns `{ statuses, update, reset }`. Each rule uses the same options and timing policy as `usePoseRule`; predicates retain their own required-landmark types and statuses retain their configured names. `update(frame)` evaluates the collection. `reset()` clears all rules; `reset("ruleName")` clears one. Each rule has independent hold and stale timers. Changing one rule's settings resets only that rule; adding/removing rules preserves the others. Removed rules stop their timers without emitting a final transition. Inline predicates and callbacks use their latest committed versions. Use `resetKey` when changing a predicate's meaning should reset its history.

`definePoseRule(options)` preserves landmark inference when defining a reusable rule outside the hook call. The single-rule hook uses the same lifecycle implementation as the collection.

`createThresholdRule({ landmarks, measure, direction, enterThreshold, exitThreshold, ...ruleOptions })` creates a rule with hysteresis. `measure(pose, frame)` returns a number or null. For `above`, entry is inclusive at the higher enter threshold and exit is inclusive at the lower exit threshold; `below` reverses these comparisons. Thresholds must be finite and distinct in the specified order. Values inside the band retain the previous evaluated outcome, including initial `unknown`, so hysteresis remains effective during hold confirmation. Null or non-finite measurements return unknown immediately. Changing thresholds/direction resets history automatically. Hold timing still applies to a candidate pass/fail outcome. The pure `evaluatePoseThreshold(value, previousStatus, threshold)` helper exposes this comparison without React.

```tsx
const feedback = usePoseRules({
  raisedWrist: {
    landmarks: ["leftWrist", "leftShoulder"],
    evaluate: pose => pose.leftWrist.y < pose.leftShoulder.y,
  },
  elbow: createThresholdRule({
    landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
    direction: "below", enterThreshold: 85, exitThreshold: 95,
    measure: (_pose, frame) => {
      const angle = getImageJointAngle(
        { landmarks: frame.landmarks, imageSize: frame.additionalData },
        "leftShoulder", "leftElbow", "leftWrist",
      );
      if (angle.status === "unavailable") return null;
      return angle.value;
    },
  }),
});
```

`composeSkeletonFeedback(base, entries)` combines appearance in array order. Each entry has `{ status, styles: { pass?, fail?, unknown? } }`; an omitted status style makes no change. Later entries win conflicting attributes, including individual attributes of a shared joint/connection, while preserving unrelated radius/width/color settings. Feedback can change global color/radius/width and named joint/connection styles; selection and confidence options remain on the base. Inputs are not modified. The example colors the wrist and elbow independently and uses 85°/95° elbow thresholds to avoid boundary flicker.

## Tracking feedback

`usePoseTracking({ landmarks, minVisibility, holdMs, staleAfterMs, isActive, onChange })` returns `{ status, missingLandmarks, uncertainLandmarks, outsideImageLandmarks, update, reset }`. Pass `update` to camera/replay frame handling, `reset` to camera configuration/error handling, and the camera's active intent to `isActive`. Required landmarks must be a non-empty list. Confidence defaults to 0.6, acquisition hold to 0 ms and stale expiry to 500 ms; validation matches pose rules.

| Status | Meaning |
| --- | --- |
| `searching` | Active, awaiting a result after mount/reset/options change. |
| `acquiring` | All required joints are usable, but the acquisition hold is not complete. |
| `found` | Required joints have remained usable for the configured hold. |
| `lost` | The latest result contains no pose landmarks. |
| `incomplete` | A pose was detected but required landmarks are missing, uncertain or outside the image. |
| `stale` | No update arrived before `staleAfterMs`; no new frame is needed to expire feedback. |
| `inactive` | Application paused tracking. Incoming updates are ignored. |

`missingLandmarks` lists absent required joints; `uncertainLandmarks` lists joints with insufficient/unknown confidence or invalid coordinates. `outsideImageLandmarks` lists confident joints whose x/y coordinates lie outside [0, 1]; raw coordinates remain unchanged. Lists are deduplicated in configuration order and are empty outside `incomplete`. `onChange(state)` fires only when the status or any list changes, using the latest committed callback; initial state is not a notification. Use `state.status === "found"` or `"lost"` for application triggers.

Loss and uncertainty invalidate tracking immediately. `holdMs` stabilizes acquisition only. Stale input and restarted frame counters discard the acquisition history. Updating confidence, required joints, durations or active state resets tracking; unmount clears its timer. Timing uses the hook's monotonic wall clock. This describes landmark availability, not persistent person identity or exercise correctness. `inspectPoseTracking(frame, options)` exposes the immediate frame inspection without React, hold timing or stale timers. The example displays left-arm positioning feedback.

```tsx
const tracking = usePoseTracking({
  landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
  holdMs: 400,
  isActive,
  onChange: state => {
    if (state.status === "found") beginInteraction();
    if (state.status === "lost") requestRepositioning();
  },
});
// Connect tracking.update to frame handling and tracking.reset to camera changes.
```

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

## Camera discovery

After obtaining camera permission, call `await getCameraCapabilities()`. It never requests permission or starts a capture session. Results are `permissionRequired`, `unavailable`, or `available` with `platform` and `cameras`. Query failures reject; malformed native results fail schema validation. Query again after permission/device changes; this is a snapshot, not a reservation.

Each camera exposes `facing`, selectable `lens`, nullable `zoomRange: { min, max }`, and `modes: { previewFps, resolution }[]`. Only integer rates within the public 1–60 range are listed. `auto` is an alias for `wide`; `findCameraCapability(result, facing, lens?)` resolves it or returns `undefined`. Android does not advertise ultra-wide because this library cannot select it.

On iOS each rate is paired with the sensor-format dimensions selected by the same policy as capture (nearest area to 1280×720). Dimensions precede orientation/cropping. On Android `resolution` is explicitly `null`: CameraX negotiates Preview + Analysis together at bind time, and this SDK version cannot query their session-specific resolution/rate combinations in advance. Its modes come from camera-level auto-exposure (AE) ranges and are not validated for the combined Preview + Analysis pipeline. They are advertised fixed-rate requests, not a guarantee of successful binding or measured FPS. No Cartesian product of sizes and rates is invented. Resolution selection remains automatic on both platforms; use `onCameraConfigured` for actual capture dimensions.

Zoom bounds are the current device snapshot clamped to the library's 1–100 range; an unknown Android zoom state is `null`. Bounds can change with configuration. The configured event remains authoritative for applied zoom. Other apps, permissions, session combinations and device state can still prevent capture after discovery.

The example waits for an explicit camera/lens choice before starting capture and makes every advertised frame rate selectable. Each camera button explicitly offers its advertised rate nearest 30 fps. The underlying sources are [AVCaptureDevice formats](https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats) and [CameraX advertised frame-rate ranges](https://developer.android.com/reference/androidx/camera/core/CameraInfo#getSupportedFrameRateRanges()).

## Landmark recording and replay

`createPoseRecorder({ maxFrames: 1800 })` creates an idle recorder. Call `start()` explicitly, feed camera results into `append(frame)`, then call `stop()` for a copied `PoseRecording`. `append` returns whether it accepted the frame. At capacity the status becomes `full` and additional appends return `false`; `start()` begins a new empty recording. Other states are `idle`, `recording`, and `stopped`. `frameCount` reports accepted frames. Capacity must be 1–10,000 frames. The recorder stores landmarks and their existing result metadata, never camera pixels, and performs no file or network I/O.

The version-1 JSON format contains `{ version: 1, frames: [{ timestampMs, frame }] }`. Relative timestamps begin at the first accepted frame, using `performance.now()` by default. An optional second `append` argument supplies a monotonic millisecond time; timestamps must strictly increase and sessions cannot exceed 24 hours. Wall-clock `receivedAtMs` is preserved as original metadata and does not drive scheduling. `serializePoseRecording` and `parsePoseRecording` validate versions, fields, finite values, chronology, landmark count, frame capacity and a 64 Mi-character JSON ceiling. Unknown fields are rejected. Imported and returned frames cannot mutate recorder/replay storage.

```tsx
const recorder = createPoseRecorder({ maxFrames: 300 });
recorder.start();
// Inside onLandmark:
recorder.append(frame);
// When the user finishes:
const session = recorder.stop();
const json = serializePoseRecording(session);
```

`usePoseReplay(session, { onFrame, onReset?, onStateChange? })` owns replay for a stable session object. It exposes `play()`, `pause()`, `seek(milliseconds)`, `setSpeed(0.1…4)`, `reset()`, and `status`, `positionMs`, `durationMs`, `speed`. A session starts paused at 1×. Ended playback needs `reset()` or `seek()` before `play()`. Seeking selects the first frame at or after the requested time, invokes `onReset` so callers clear their rules/tracking, and preserves playing/paused state. `reset` pauses and seeks to zero. A replacement session resets playback; unmount cancels scheduled delivery. Keep the recording reference stable between renders.

`onFrame(frame, timestampMs)` receives the original relative time. Pass the frame to `usePoseRule`/`usePoseRules`/`usePoseTracking` and render `PoseSkeleton`. These hooks measure hold/staleness in real elapsed time: slow playback can expire tracking and faster playback shortens observed holds. For speed-independent offline evaluation, use `evaluatePoseRule` with `advancePoseRule(state, outcome, timestampMs, holdMs)` instead. Seeking backwards must reset that state too. Replay preserves chronological delivery, including when the JS thread is late; it does not claim real-time playback under load. Position notifications occur on controls and delivered frames, not on every display refresh.

The pure `createPoseReplay(session, callbacks)` controller exposes the same controls, a `state` getter and `dispose()`. Dispose it when its owner ends. The example records at most 300 results and demonstrates playback, pause, speed, seek, reset, tracking and skeleton rendering without keeping the camera running.

## Local photo analysis

`await analyzePoseImage(location, options?)` uses the official MediaPipe IMAGE API on a native background queue, without camera access. `location` must be a readable absolute file path or local `file://` URI. HTTP, picker `content://`/`ph://` locations, directories and unreadable/invalid files are unsupported; copy picker results into app storage first. The library does not download files. Validation, decoding and model errors reject the promise.

Options are `modelVariant` (default `full`), `modelPath` (optional local model), `maxImageDimension` (default 2048, integer 256–2048), `minPoseDetectionConfidence` and `minPosePresenceConfidence` (both default 0.35, range 0–1). Only the full model is bundled; lite/heavy require an explicit local model. File analysis uses the CPU delegate on both platforms, with detector construction, inference and release on the same owner. Calls do not reuse live-camera tracking history.

Decoding applies EXIF orientation, including mirrored cases, before inference. Images larger than `maxImageDimension` are downsampled; Android uses decoder power-of-two sampling and iOS uses ImageIO thumbnails. `imageSize` reports the actual upright pixels analyzed, so downsampled dimensions can differ across platforms. Sources above 16,777,216 pixels are rejected from their headers before pixel decoding; resize larger photos in the app first. These limits bound accepted dimensions, not total peak memory or available device memory. No input files are modified.

The validated `PoseDetection` result contains `landmarks`, `worldLandmarks`, `imageSize: { width, height }`, measured `inferenceDurationMs`, and `model: { variant, source, delegate }`. An empty pair of landmark arrays means no pose was detected. It contains no fabricated facing, lens, zoom, camera frame number or capture timestamp. Geometry and named-landmark helpers accept it directly; `createDetectionSkeleton(detection, viewSize, options?)` and `<PoseSkeleton detection={detection} width={width} height={height} />` render the same configurable overlay over an aspect-fill image.

```tsx
const detection = await analyzePoseImage(photoUri, { maxImageDimension: 1024 });
const elbow = getImageJointAngle(detection, "leftShoulder", "leftElbow", "leftWrist");
```

The example includes a local-file photo screen and a native fixture mode covering real pose/no-pose images, all EXIF orientations, decode bounds, invalid inputs and recovery. See [fixture instructions](../example/fixtures/README.md). Implementation follows Google's [iOS IMAGE guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/ios) and [Android IMAGE guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/android), [ImageIO thumbnail decoding](https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:)) and [ExifInterface's flip-before-rotation convention](https://developer.android.com/reference/androidx/exifinterface/media/ExifInterface#getRotationDegrees()).
