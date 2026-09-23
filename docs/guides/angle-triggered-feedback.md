# Trigger feedback from a joint angle

Turn a detected elbow angle into green/red feedback and an application callback with `getImageJointAngle`, `createThresholdRule` and `usePoseRule`. The rule handles uncertain landmarks, confirmation time and stale input. Your application chooses the thresholds and what each transition does.

Complete [camera setup](expo-pose-detection.md) first and keep `PoseCameraScreen.tsx`. This guide uses version 0.3.0; the older `v0.2.0` tag lacks these geometry and threshold helpers.

## Define the interaction

This example enters `pass` when the image-plane left elbow angle is at most 85°, and enters `fail` when it is at least 95°. Between those thresholds, it keeps the previous evaluated outcome; with no prior outcome it stays `unknown`. A candidate pass/fail must persist across incoming results for 250 ms before it becomes the displayed state.

The 10° gap is hysteresis: it reduces repeated switching near a boundary. The angle's middle landmark is its vertex. The values illustrate a UI interaction, not a definition of correct exercise form.

Save `ElbowFeedbackScreen.tsx` beside the shared wrapper:

```tsx
import {
  createThresholdRule,
  getImageJointAngle,
  PoseCameraView,
  type InferenceError,
  type PoseRuleStatus,
  usePoseRule,
} from "expo-mediapipe-pose";
import { useState } from "react";
import { Text, View } from "react-native";
import { PoseCameraScreen } from "./PoseCameraScreen";

const feedbackColors = {
  pass: "#22c55e",
  fail: "#ef4444",
  unknown: "#94a3b8",
} satisfies Record<PoseRuleStatus, string>;

const feedbackLabels = {
  pass: "Elbow bend target reached",
  fail: "Bend your left elbow toward the target",
  unknown: "Waiting for a clear, confirmed elbow measurement",
} satisfies Record<PoseRuleStatus, string>;

interface ElbowCameraProps {
  isActive: boolean;
  onFeedbackChange: (status: PoseRuleStatus) => void;
}

function ElbowCamera({ isActive, onFeedbackChange }: ElbowCameraProps) {
  const [failure, setFailure] = useState<InferenceError | null>(null);
  const elbowRule = usePoseRule(createThresholdRule({
    landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
    minVisibility: 0.6,
    direction: "below",
    enterThreshold: 85,
    exitThreshold: 95,
    holdMs: 250,
    staleAfterMs: 750,
    isActive,
    measure: (_pose, frame) => {
      const angle = getImageJointAngle(
        { landmarks: frame.landmarks, imageSize: frame.additionalData },
        "leftShoulder",
        "leftElbow",
        "leftWrist",
        { minVisibility: 0.6 },
      );
      if (angle.status === "unavailable") return null;
      return angle.value;
    },
    onChange: onFeedbackChange,
  }));

  function handleCameraConfigured() {
    elbowRule.reset();
    setFailure(null);
  }

  function handleCameraError(error: InferenceError) {
    elbowRule.reset();
    setFailure(error);
  }

  return (
    <View style={{ flex: 1 }}>
      <PoseCameraView
        style={{ flex: 1 }}
        isActive={isActive}
        frameLimit={15}
        callbackFps={10}
        onLandmark={elbowRule.update}
        onCameraConfigured={handleCameraConfigured}
        onInferenceError={handleCameraError}
        skeleton={{
          bodyParts: ["leftArm"],
          color: feedbackColors[elbowRule.status],
          minVisibility: 0.6,
          joints: { leftElbow: { radius: 8 } },
        }}
      />
      <View style={{ padding: 16 }}>
        <Text>{feedbackLabels[elbowRule.status]}</Text>
        {failure && <Text>Camera error: {failure.code}</Text>}
      </View>
    </View>
  );
}

interface ElbowFeedbackScreenProps {
  screenIsFocused: boolean;
  onFeedbackChange: (status: PoseRuleStatus) => void;
}

export function ElbowFeedbackScreen({
  screenIsFocused,
  onFeedbackChange,
}: ElbowFeedbackScreenProps) {
  return (
    <PoseCameraScreen screenIsFocused={screenIsFocused}>
      {isActive => <ElbowCamera isActive={isActive} onFeedbackChange={onFeedbackChange} />}
    </PoseCameraScreen>
  );
}
```

## Connect your own function

For a minimal single-screen `App.tsx`, place it beside the example files:

```tsx
import type { PoseRuleStatus } from "expo-mediapipe-pose";
import { ElbowFeedbackScreen } from "./ElbowFeedbackScreen";

function handleFeedbackChange(status: PoseRuleStatus) {
  if (status !== "pass") return;
  console.info("Confirmed elbow target reached");
}

export default function App() {
  return <ElbowFeedbackScreen screenIsFocused={true} onFeedbackChange={handleFeedbackChange} />;
}
```

Replace the logging action with your app's next-step UI, sound or haptic integration. `onChange` runs only when the committed status changes; remaining green does not repeatedly invoke it. The initial `unknown` state is not a transition notification. A later `unknown` → `pass` transition can invoke it again, so use application state if an action must happen only once per session. Keep the callback small and handle errors from any asynchronous action you start.

## Handle uncertainty and timing

- Missing or insufficiently confident required joints produce `unknown` immediately. An unavailable angle returns `null` from `measure`, which also produces `unknown`; it never becomes a fabricated zero-degree measurement.
- The displayed previous status remains during pass/fail confirmation. Holding a result for 250 ms requires continued incoming results; it is not a timer that passes the rule after one frame.
- With no updates for 750 ms, feedback expires to `unknown`, even without a new camera frame. The timeout is chosen for the example's 10 fps callback limit; allow appropriate headroom if you lower the callback rate.
- Camera configuration/error callbacks reset rule history. The camera and hook share `isActive`, so losing focus or backgrounding also invalidates feedback.

Changing threshold values resets threshold history. If you change the meaning of a custom measurement function, use `resetKey` or call `reset` as described in the [rule API](../api.md#named-landmarks-and-rules).

## Choose image or world geometry

`getImageJointAngle` uses inference-image width/height to correct for aspect ratio before measuring a 2D angle. Use `frame.additionalData`, not the phone screen dimensions. Do not calculate an angle directly from normalized x/y values in a non-square image. Turning an arm toward the camera changes its projected angle; use a consistent viewpoint for this interaction.

For an estimated 3D angle, use `getWorldJointAngle` with `frame.worldLandmarks` and retain its unavailable-result handling. World estimates are not calibrated motion-capture measurements. See [geometry contracts](../api.md#angles-and-distances).

This example uses the first pose, with the camera's default `maxPoses={1}`. If you add multiple poses, explicitly [select a pose](../api.md#multiple-poses-and-explicit-selection) for both feedback and display and reset history when selection changes. A result index does not establish persistent person identity.

## Verify transitions

On a phone, hold a clear side-on view of your left arm. Bend through the entry threshold and confirm the label turns green after sustained detections; straighten through the exit threshold and confirm red. Move near the boundary to check stability, cover the required joints to check unknown, and background the app to check reset. Verify your callback is transition-based rather than called every frame.

These steps require device testing in your app. Type checks and the library's automated rule tests do not establish physical-camera accuracy, exercise safety or repetition counts. For independent conditions on several joints, continue with [multiple rules and feedback composition](../api.md#multiple-rules-and-independent-feedback).
