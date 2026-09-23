# Customize skeleton colors, joints and connections

Use `SkeletonOptions` to highlight a body region or individual landmarks in an Expo / React Native pose camera. Styling changes the overlay without restarting inference or filtering the raw detection results.

First complete [camera setup](expo-pose-detection.md), including the npm installation and `PoseCameraScreen.tsx`. Save the following file beside that wrapper as `StyledPoseScreen.tsx`.

## Highlight the left arm

```tsx
import {
  PoseCameraView,
  type InferenceError,
  type SkeletonOptions,
} from "expo-mediapipe-pose";
import { useState } from "react";
import { Button, Text, View } from "react-native";
import { PoseCameraScreen } from "./PoseCameraScreen";

const armSkeleton = {
  bodyParts: ["leftArm"],
  landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
  color: "#38bdf8",
  jointRadius: 5,
  lineWidth: 3,
  minVisibility: 0.6,
  joints: {
    leftElbow: { color: "#f59e0b", radius: 8 },
    leftWrist: { color: "#a78bfa", radius: 7 },
  },
  connections: {
    "leftElbow:leftWrist": { color: "#a78bfa", width: 5 },
  },
} satisfies SkeletonOptions;

function StyledCamera({ isActive }: { isActive: boolean }) {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [failure, setFailure] = useState<InferenceError | null>(null);
  const toggleLabel = showSkeleton ? "Hide skeleton" : "Show skeleton";

  return (
    <View style={{ flex: 1 }}>
      <PoseCameraView
        style={{ flex: 1 }}
        isActive={isActive}
        frameLimit={15}
        callbackFps={10}
        skeleton={showSkeleton ? armSkeleton : false}
        onCameraConfigured={() => setFailure(null)}
        onInferenceError={setFailure}
      />
      <View style={{ padding: 16, gap: 8 }}>
        <Text>Left arm: amber elbow, purple wrist and forearm.</Text>
        <Button title={toggleLabel} onPress={() => setShowSkeleton(visible => !visible)} />
        {failure && <Text>Camera error: {failure.code}</Text>}
      </View>
    </View>
  );
}

export function StyledPoseScreen({ screenIsFocused }: { screenIsFocused: boolean }) {
  return (
    <PoseCameraScreen screenIsFocused={screenIsFocused}>
      {isActive => <StyledCamera isActive={isActive} />}
    </PoseCameraScreen>
  );
}
```

Render `<StyledPoseScreen screenIsFocused={true} />` in a single-screen app, or supply your navigator's focus state. Use the first guide's retry pattern if your screen should offer recovery from capture errors.

## Choose the right styling control

| Control | Use |
| --- | --- |
| `color`, `jointRadius`, `lineWidth` | Set the shared appearance. |
| `joints.leftElbow` | Override a named joint's color or radius. |
| `connections["leftElbow:leftWrist"]` | Override one connection's color or width. |
| `bodyParts` | Show the union of selected body groups. Omit it for all groups; `[]` shows none. |
| `landmarks` | Further restrict that selection to named joints. |
| `minVisibility` | Hide joints below the visibility threshold. Missing visibility also hides a joint. |
| `skeleton={false}` | Disable the built-in overlay and its per-frame React state updates. Inference continues. |

Individual overrides take precedence over global styles. A connection appears only when both endpoints are selected and visible. Use keys in the canonical order exported by `POSE_CONNECTIONS`; reversing a connection name is not another supported key.

Names refer to the detected person's anatomy: `leftWrist` is not shorthand for the left edge of the screen. Returned front-camera coordinates already account for mirroring. The built-in overlay handles the camera's aspect-fill projection; do not mirror it again.

## Change color from application state

For a static theme, change the options above. For red/green feedback, let an application rule choose the style and show a text label alongside color. The [angle feedback guide](angle-triggered-feedback.md) demonstrates a three-state mapping: green for pass, red for fail, gray for unknown. It also shows where to call your own transition handler.

Changing only the global color will not replace a joint or connection color you explicitly overrode. Update those overrides too when they should reflect feedback. Multiple rules can target different joints with [`composeSkeletonFeedback`](../api.md#multiple-rules-and-independent-feedback).

## Verify the result

Check the elbow and wrist colors on a phone, then toggle the overlay. The preview should remain active. Move the arm out of view: low-confidence endpoints and their connections should disappear. Raw landmarks remain available through `onLandmark` even when the overlay is hidden or restricted to one arm.

For a separate custom overlay, use [`PoseSkeleton`](../api.md#skeletonoptions-and-poseskeleton) with matching preview dimensions and coordinate transforms. Its parent owns clipping and stale-frame handling. Keep the built-in overlay unless your layout needs a separate renderer.
