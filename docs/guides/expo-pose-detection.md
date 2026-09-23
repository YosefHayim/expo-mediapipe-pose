# Pose detection in an Expo / React Native app

Show a native camera preview with an on-device pose skeleton using `expo-mediapipe-pose`. This guide covers installation, camera permission, screen lifecycle, errors and frame-rate controls. The [styling guide](custom-skeleton-styling.md) and [angle feedback guide](angle-triggered-feedback.md) build on the same screen wrapper.

## Install the package

These examples use `expo-mediapipe-pose` 0.3.0. The older `v0.2.0` GitHub tag lacks the geometry and threshold helpers used by the feedback guide. See the [versioned API](https://github.com/YosefHayim/expo-mediapipe-pose/blob/v0.3.0/docs/api.md).

Start with an existing [Expo](https://docs.expo.dev/) app compatible with Expo SDK 57, React Native 0.86 and React 19.2. A bare React Native app needs [Expo modules installed](https://docs.expo.dev/bare/installing-expo-modules/). Run from your app directory:

```sh
pnpm add expo-mediapipe-pose@^0.3.0 effect@^3.21.4
pnpm exec expo install react-native-svg expo-camera
```

For projects using Expo's generated native projects, merge this permission configuration into your existing `app.json`; preserve its other plugins and settings:

```json
{
  "expo": {
    "plugins": [
      ["expo-camera", {
        "cameraPermission": "Allow camera access for on-device pose detection.",
        "recordAudioAndroid": false
      }]
    ]
  }
}
```

[expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) supplies the permission hook here. `PoseCameraView` owns the preview and inference; do not mount a second camera preview alongside it. Pose detection does not require microphone access.

If your generated `ios/` or `android/` directories already exist, run `pnpm exec expo prebuild` to apply plugin changes before rebuilding. `expo run:*` only generates a missing native project automatically. Review the generated changes.

For manually maintained native projects, follow [expo-camera's native setup](https://docs.expo.dev/versions/latest/sdk/camera/#are-you-using-this-library-in-an-existing-react-native-app), including `NSCameraUsageDescription` in the iOS app's `Info.plist` and Android camera permission. App config alone does not update those projects. Do not run Prebuild over hand-maintained native changes; apply the native configuration directly.

Build and install your app on an iOS or Android phone:

```sh
pnpm exec expo run:ios --device
# On Android instead:
pnpm exec expo run:android --device
```

This native module requires your own [development build](https://docs.expo.dev/develop/development-builds/introduction/). Expo Go and browser inference are unsupported. Rebuild after native dependency or permission configuration changes.

## Share permission and lifecycle handling

Save this as `PoseCameraScreen.tsx` in your app's components directory. It gives its child the same active state that a camera and feedback hook should use. [React Native AppState](https://reactnative.dev/docs/appstate) tracks foreground state; your navigator supplies `screenIsFocused`.

```tsx
import { useCameraPermissions } from "expo-camera";
import { type ReactNode, useEffect, useState } from "react";
import { AppState, Button, Linking, Text, View } from "react-native";

interface PoseCameraScreenProps {
  screenIsFocused: boolean;
  children: (isActive: boolean) => ReactNode;
}

export function PoseCameraScreen({
  screenIsFocused,
  children,
}: PoseCameraScreenProps) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [isForeground, setIsForeground] = useState(AppState.currentState === "active");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setIsForeground(state === "active");
    });
    setIsForeground(AppState.currentState === "active");
    return () => subscription.remove();
  }, []);

  async function runPermissionAction(action: () => Promise<unknown>) {
    setPermissionError(null);
    try {
      await action();
    } catch (error) {
      setPermissionError(String(error));
    }
  }

  if (!permission) return <Text>Checking camera permission…</Text>;

  if (!permission.granted) {
    const permissionAction = permission.canAskAgain ? requestPermission : Linking.openSettings;
    const permissionLabel = permission.canAskAgain ? "Allow camera" : "Open settings";

    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
        <Text>Camera access is needed for live pose detection.</Text>
        <Button title={permissionLabel} onPress={() => void runPermissionAction(permissionAction)} />
        <Text>After changing permission in Settings, return here and check again.</Text>
        <Button title="Check permission again" onPress={() => void runPermissionAction(refreshPermission)} />
        {permissionError && <Text>{permissionError}</Text>}
      </View>
    );
  }

  const isActive = screenIsFocused && isForeground;
  return <View style={{ flex: 1 }}>{children(isActive)}</View>;
}
```

Use a component inside the render function when you need hooks, as the examples below do. Do not call hooks directly inside that function. This wrapper deliberately exposes a permission refresh button after a denied request; it does not silently retry requests.

## Display the camera and handle errors

Save `PoseDetectionScreen.tsx` beside the wrapper:

```tsx
import { PoseCameraView, type InferenceError } from "expo-mediapipe-pose";
import { useState } from "react";
import { Button, Text, View } from "react-native";
import { PoseCameraScreen } from "./PoseCameraScreen";

function CameraPreview({ isActive }: { isActive: boolean }) {
  const [failure, setFailure] = useState<InferenceError | null>(null);
  const [cameraSession, setCameraSession] = useState(0);

  function retryCamera() {
    setFailure(null);
    setCameraSession(session => session + 1);
  }

  return (
    <View style={{ flex: 1 }}>
      <PoseCameraView
        key={cameraSession}
        style={{ flex: 1 }}
        isActive={isActive}
        cameraFacing="front"
        previewFps={30}
        frameLimit={15}
        callbackFps={10}
        onCameraConfigured={() => setFailure(null)}
        onInferenceError={setFailure}
      />
      {failure && (
        <View style={{ padding: 16 }}>
          <Text>Camera error: {failure.code}</Text>
          <Button title="Retry camera" onPress={retryCamera} />
        </View>
      )}
    </View>
  );
}

export function PoseDetectionScreen({ screenIsFocused }: { screenIsFocused: boolean }) {
  return (
    <PoseCameraScreen screenIsFocused={screenIsFocused}>
      {isActive => <CameraPreview isActive={isActive} />}
    </PoseCameraScreen>
  );
}
```

Render `<PoseDetectionScreen screenIsFocused={true} />` as the sole screen in a minimal app. In a navigator, pass its actual focus state instead. Keep the parent layout at non-zero dimensions. When inactive, the native camera releases capture and its detector. Handle permission revocation in your app's permission flow; a camera error is not proof of a denied permission.

The skeleton appears by default. To consume raw landmarks, add `onLandmark`; its frame includes normalized image landmarks, estimated world landmarks and metadata. Empty landmark arrays mean no person was detected, not a camera failure. See [frame coordinates](../api.md#frames-and-coordinates).

## Choose processing rates

| Setting in this example | Effect |
| --- | --- |
| `previewFps={30}` | Requests a native capture rate; unsupported settings report an error. |
| `frameLimit={15}` | Limits detector calls while preview capture continues. |
| `callbackFps={10}` | Limits results sent to JavaScript, including updates used by the skeleton. |

These settings do not guarantee throughput. Reducing callbacks alone does not reduce detector work. Add `onPerformanceMetrics` to inspect measured rates and inference duration; see [performance semantics](../api.md#frame-rates-and-performance). Test battery use and sustained performance on your target phones.

## Check the integration

On a physical phone, grant permission and bring your upper body into view. Confirm that the skeleton follows you, hides when detection is lost, and returns when you re-enter. Navigate away and background the app to verify capture stops. Deny permission, then use Settings and the refresh button to verify recovery. Test both camera facings before relying on alignment.

If the native module cannot be found, rebuild the app containing the dependency. A blank view can also mean zero layout size or camera denial; use the reported [error code](../api.md#errors-and-recovery) rather than inventing detections. A simulator build verifies compilation, not a working phone camera.

Continue with [custom skeleton styling](custom-skeleton-styling.md) or [angle-triggered feedback](angle-triggered-feedback.md). The repository's [example app](../../example/App.tsx) contains camera switching, metrics and local-media workflows.
