# expo-mediapipe-pose

An Expo native pose-detection library using Google's MediaPipe Tasks SDK. Read [README.md](README.md) for installation/scope and [docs/api.md](docs/api.md) before changing public behavior. This file is the canonical agent instruction source.

## Ownership

- `src/components/`: camera composition and SVG presentation.
- `src/hooks/`: React lifecycle and pose-feedback hooks.
- `src/pose/`: pure contracts, geometry, selection, feedback, recording and replay.
- `src/native/`: validated Expo async bridges for discovery, file inference and mask release.
- `src/contracts.ts`: Effect schemas for the native event boundary; `src/core.ts` must remain importable without React Native initialization.
- `ios/`: Swift capture, file decoding, detector/mask ownership and Expo registration.
- `android/src/main/java/expo/modules/mediapipepose/`: Kotlin equivalents.
- `example/`: one standalone Expo app exercising the public API; `example/fixtures/README.md` documents cold-launch native checks and mask pixel verification.
- `tests/`: behavior tests, including a DOM harness for React-only hooks.
- `assets/`: bundled Google full pose model; preserve provenance and checksum.

## Readable implementation

- Use descriptive domain names and named conditions. Prefer early returns to nested `if` statements; do not introduce nested ternaries or long boolean chains.
- Keep components, hooks and pure logic in their existing owners. Split by responsibility, not arbitrary line counts. Avoid speculative frameworks or duplicate implementations.
- Defaults must be documented API policy. Missing data, unsupported requests and errors must remain explicit; do not fabricate fallback results or report unknown capability as success.
- Comments explain non-obvious threading, coordinate or resource-lifetime constraints. Omit commentary that repeats a variable name or the next statement.
- Use TypeScript functions and typed contracts; Swift structs/enums and isolated capture ownership; Kotlin data classes and explicit lifecycle/resource ownership.
- Keep raw multi-pose results intact. Result indices are not persistent person identities; missing selections stay empty.
- Styling must not restart inference. Rendering selection must not alter raw landmarks. Treat anatomical names, image coordinates, world coordinates and preview pixels as distinct concepts.
- Keep native camera/detector work off the UI thread. Initialize/use/close each detector on its owner. Always release Android `ImageProxy` and inference images. Reject old-generation events after stop/reconfigure.
- Delivered segmentation leases belong to the consumer. Release undelivered/stale masks; bound outstanding leases and decoded output. Recordings exclude mask handles and image/video pixels.
- Keep application-specific scoring out of the library. A rule's `unknown` status is not failure or success.

## Verification

From the root with pnpm:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm verify:package
git diff --check
```

Use `pnpm format` for TypeScript formatting/imports. Format Swift with `xcrun swift-format format --in-place ios/*.swift`. After native changes, generate the example with `pnpm --filter pose-camera-example exec expo prebuild`, then build iOS and Android using the commands in `.github/workflows/check.yml` or the example's `ios` / `android` scripts. Generated native projects and `scripts/dev/` artifacts stay untracked.

Test observable behavior: coordinate transforms, empty/uncertain detections, rule timing/transitions, replay clocks, updated callbacks, cancellation and resource teardown. File/mask changes also require the native fixture runner; inspect mask pixels with `scripts/verify-mask-fixtures.py`. Do not substitute source-text assertions for native compilation or camera tests. Build success does not prove physical-camera alignment or performance. Report unavailable device checks explicitly.

## Delivery

The npm package uses compiled `build/` JavaScript and declarations; `pnpm build` generates them; checkout installation (`prepare`) and packing (`prepack`) run the build. Keep both public entry points working in the packed archive. `pnpm verify:package` checks declarations, native/model files and Node ESM/CommonJS imports of the pure core.

Preserve unrelated work and all license/third-party notices. Do not change SDK/model bytes as an incidental refactor. Keep package/native identity, autolinking, exports and packed files consistent on rename. Do not claim npm publication, production readiness, physical-device validation or performance improvements without evidence. Do not put secrets, camera captures or personal recordings into fixtures. Publishing or deleting external resources requires user authorization.
