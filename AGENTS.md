# expo-mediapipe-pose

Expo native pose landmarks on MediaPipe Pose Landmarker. Read [README.md](README.md) before changing the public API.

## Layout

- `src/index.ts` is the only public import. There is no second entry.
- `src/camera/`: `PoseCameraView`, `requestCameraPermission`, and `usePoseCamera`. The hook keeps the permission, the latest full pose, and the failure. Settings passed in are returned with defaults filled.
- `src/landmarks/`: the 33 names and `PoseFrame` reading. Image pixels, world meters, and preview pixels stay different.
- `src/skeleton/`: the bones, `PoseSkeleton`, and `skeletonJoints`. Hiding the skeleton or one joint does not change landmarks or reload the landmarker. A bone is drawn only when both ends are shown and visible. Its color is the first joint's color.
- `src/read-pose-file.ts`: `readPosePhoto` and `readPoseVideo`.
- `src/use-pose-photo.ts` and `src/use-pose-video.ts`: store the photo frame, or the sampled video frames, and the failure message.
- `src/pose-settings.ts`: model, delegate, pose count, confidences, and frame-rate checks.
- `plugin/set-ios-camera-usage-text.ts`: writes only `NSCameraUsageDescription`. `app.plugin.js` loads the compiled plugin.
- `ios/` and `android/src/main/java/expo/modules/mediapipepose/`: capture, file decoding, and the landmarker. Keep that work off the UI thread. Close Android `ImageProxy` and inference images. Drop events from an old camera generation.
- `example/`: one Expo app that compiles the native module. It is not in the npm package.
- `assets/`: bundled lite, full, and heavy models. Do not replace the full model bytes. Record new checksums in `src/package-contents.test.ts`.

## API rules

- Keep every person in `poses`. The index is not a person id. A missing joint is `null`, not a thrown error.
- `poseFrameRate` can change while the camera stays open. Changing `poseModel` reloads the landmarker.
- The live camera stays on MediaPipe video mode on a background queue and may drop a late frame. Do not add a public running-mode switch.
- Photo and video accept `poseDelegate`. Person masks stay off.
- Defaults are 0.5 confidence, full model, gpu, one pose, camera rate 30, video sample rate 5.
- Do not invent a result when the request is unsupported. Say which failure it is.

## Checks

From the repo root:

```sh
pnpm install --frozen-lockfile
pnpm check
git diff --check
```

`pnpm check` is lint, typecheck, test, and build. Lint runs Biome, then ESLint with the SDK 58 flat config from `eslint-config-expo`. Swift frame-timing tests run on macOS only. Format Swift with `xcrun swift-format format --in-place ios/*.swift`.

After native changes, prebuild the example and build it:

```sh
pnpm --filter pose-camera-example exec expo prebuild
pnpm --filter pose-camera-example ios
pnpm --filter pose-camera-example android
```

Generated `example/ios` and `example/android` stay untracked. A successful build does not prove camera alignment or speed on a device.

`pnpm build` writes `build/` and `plugin/build/`. Packing runs that build. Do not publish npm from an agent session. Do not commit secrets or personal camera recordings.
