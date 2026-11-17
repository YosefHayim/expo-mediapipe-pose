# expo-mediapipe-pose

An Expo native pose-detection library using Google's MediaPipe Tasks SDK. Read [README.md](README.md) for installation/scope before changing public behavior. This file is the canonical agent instruction source. For using the library in an app, see [skills/expo-mediapipe-pose/SKILL.md](skills/expo-mediapipe-pose/SKILL.md) and the public index [llms.txt](llms.txt); update both when the public API changes.

## Ownership

- `src/camera/`, `src/person-mask/`, `src/skeleton/`, `src/tracking/`, `src/replay/`, `src/rules/`, `src/file-analysis/`: one folder per job. Each holds its React component or hook, its pure logic and, where it needs them, its validated Expo async bridge, in files named for what they do.
- `src/landmarks/`: landmark names and connections, confidence checks and measurement geometry.
- `src/shared-contracts.ts`: zod schemas for the native event boundary; `src/native-module.ts`: the one typed native module (`getNativeModule()`); `src/core.ts` must remain importable without React Native initialization.
- `ios/`: Swift capture, file decoding, detector/mask ownership and Expo registration.
- `android/src/main/java/expo/modules/mediapipepose/`: Kotlin equivalents; `android/src/test/` holds their JVM unit tests.
- `example/`: one standalone Expo app exercising the public API; `example/fixtures/README.md` documents cold-launch native checks and mask pixel verification.
- `hello-world/`: the beginner Expo app with numbered steps; keep it in step with the public API.
- `skills/expo-mediapipe-pose/SKILL.md`: the Agent Skill for apps that use the library. It ships in the npm package.
- `llms.txt`: the public documentation index for coding agents; every link must resolve.
- `src/**/*.test.ts`: behavior tests next to their source, including a DOM harness for React-only hooks. `src/testing/` holds shared test helpers and expo stubs. `ios/PoseFrameTimingTests.swift`: the Swift frame-timing tests.
- `assets/`: bundled Google full pose model; preserve provenance and checksum.

## Domain rules

- Keep raw multi-pose results intact. Result indices are not persistent person identities; missing selections stay empty.
- Styling must not restart inference. Rendering selection must not alter raw landmarks. Treat anatomical names, image coordinates, world coordinates and preview pixels as distinct concepts.
- Keep native camera/detector work off the UI thread. Initialize/use/close each detector on its owner. Always release Android `ImageProxy` and inference images. Reject old-generation events after stop/reconfigure.
- Delivered person mask leases belong to the consumer. Release undelivered/stale masks; bound outstanding leases and decoded output. Recordings exclude mask handles and image/video pixels.
- Keep application-specific scoring out of the library. A rule's `unknown` status is not failure or success.
- Defaults must be documented API policy. Missing data, unsupported requests and errors must remain explicit; do not fabricate fallback results or report unknown capability as success.

## Verification

From the root with pnpm:

```sh
pnpm install --frozen-lockfile
pnpm check
git diff --check
```

`pnpm check` is the one gate: lint (Biome and knip), typecheck, test and build through Turborepo. The pre-commit hook only runs Biome on staged files. `pnpm test` also runs the Swift frame-timing tests (`pnpm test:swift`) on macOS and skips them on other systems, so Linux CI still passes.

The root `.` workspace is the published library, so the exports of `src/index.ts` and `src/core.ts` are its public API and stay.

Use `pnpm lint:fix` for Biome formatting and import order. Format Swift with `xcrun swift-format format --in-place ios/*.swift`. After native changes, generate the example with `pnpm --filter pose-camera-example exec expo prebuild`, then build iOS with `pnpm --filter pose-camera-example ios` and Android with `pnpm --filter pose-camera-example android` (or the Gradle commands in `.github/workflows/check.yml`). Generated native projects stay untracked.

Test observable behavior: coordinate transforms, empty/uncertain detections, rule timing/transitions, replay clocks, updated callbacks, cancellation and resource teardown. File/mask changes also require the native fixture runner; inspect mask pixels with `example/fixtures/verify_mask_fixtures.py`. Do not substitute source-text assertions for native compilation or camera tests. Build success does not prove physical-camera alignment or performance. Report unavailable device checks explicitly.

## Delivery

The npm package uses compiled `build/` JavaScript and declarations; `pnpm build` generates them; checkout installation (`prepare`) and packing (`prepack`) run the build. Keep both public entry points working in the packed archive. `src/package-contents.test.ts`, run by `pnpm test`, checks declarations, every native Swift/Kotlin source, the model and Node ESM/CommonJS imports of the pure core.

Preserve unrelated work and all license/third-party notices. Do not change SDK/model bytes as an incidental refactor. Keep package/native identity, autolinking, exports and packed files consistent on rename. Do not claim npm publication, production readiness, physical-device validation or performance improvements without evidence. Do not put secrets, camera captures or personal recordings into fixtures. Publishing or deleting external resources requires user authorization.
