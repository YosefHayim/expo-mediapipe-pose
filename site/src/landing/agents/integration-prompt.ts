/** The prompt from the README section "Integrate with a coding assistant". */
export const INTEGRATION_PROMPT = `Integrate expo-mediapipe-pose into this app for: [describe the interaction].
Repository: https://github.com/YosefHayim/expo-mediapipe-pose

Inspect this app's instructions, Expo/React Native versions, navigation,
permission handling and existing camera code before changing anything.
Read the README and API documentation for the exact installed tag/commit.
The npm 0.4.0 API includes the current guides; the older v0.2.0 GitHub tag
predates the newer APIs. Check the installed version and compatibility.

Use supported exports from expo-mediapipe-pose; import pure helpers from
expo-mediapipe-pose/core. Do not invent API names or treat the internal
Swift/Kotlin Expo bridge as a separately distributed native SDK.

Implement the smallest complete integration for the stated goal:
- Use a native development build, obtain permission before mounting, and
  connect isActive to screen focus and foreground state.
- Keep preview, inference and callback rates explicit where needed.
  Report measured performance without promising a requested frame rate.
- Preserve named anatomical landmarks, the documented coordinate system,
  and unknown/missing states. Do not mirror coordinates twice or treat
  pose indices as persistent person IDs.
- Enable segmentation only if needed. Release each delivered mask lease
  after use/replacement/unmount, including error and cancellation paths.
- Keep exercise rules application-defined. Do not imply medical accuracy,
  built-in repetition counting, video recording, or unsupported platforms.
- Follow the app's structure. Use descriptive names and early returns;
  avoid nested ternaries, nested conditions and duplicated infrastructure.

Run relevant type/behavior checks and native builds. Exercise the actual
screen and report which devices were used. Separate simulator/fixture
coverage from physical-camera and sustained-performance validation.
Explain the changed files, installation/build steps and remaining limits.`;
