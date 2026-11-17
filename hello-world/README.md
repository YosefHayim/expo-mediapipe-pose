# Pose hello world

One screen that shows the camera, draws a skeleton and turns it green when both of your hands are above your nose. Read `app.tsx` from top to bottom: the comments are numbered 1 to 6.

## Run it

You need an iPhone or Android phone (or a simulator or emulator with a camera) and the tools for an [Expo development build](https://docs.expo.dev/develop/development-builds/introduction/). [Expo Go](https://expo.dev/go) cannot load this native module.

From the repository root:

```sh
pnpm install
pnpm --filter pose-hello-world ios
# or: pnpm --filter pose-hello-world android
```

The first run builds the native app, so it takes a few minutes. Tap "Allow camera", stand back until your upper body is in view, and raise both hands above your nose. The skeleton turns green and the text says `pass`.

## The six steps

1. Install `expo-mediapipe-pose`, `react-native-svg` and `expo-camera`.
2. Ask for the camera with `useCameraPermissions`.
3. Write a condition with `usePoseRule`.
4. Read the landmarks in a frame handler.
5. Show the camera with `PoseCameraView`.
6. Color the skeleton by the rule status.

Next, read the guides and the API reference in the [main README](../README.md).
