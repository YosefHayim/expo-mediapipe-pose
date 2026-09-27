# Pose playground

[Open the playground](https://YosefHayim.github.io/expo-mediapipe-pose/).

A static React/Vite client for evaluating pose configurations with MediaPipe's browser SDK. Start with a public sample, then use a webcam, local image/video, or landmark recording. Controls share the library's documented defaults and pure skeleton, geometry, selection and threshold/hold logic.

```sh
pnpm install --frozen-lockfile
pnpm --filter pose-playground dev
# http://127.0.0.1:5173/expo-mediapipe-pose/
pnpm --filter pose-playground build
pnpm --filter pose-playground exec playwright install chromium
pnpm --filter pose-playground test:e2e
```

`pnpm check` includes playground types and behavioral tests, including compilation of generated Expo snippets against the native API. The Pages workflow tests real inference with public fixtures and deploys successful main builds. `version.json` identifies the deployed source commit. To roll back, revert the playground change and let main redeploy; no persistent server data is involved.

## Browser and native boundaries

- Inference runs on a CPU WASM worker with one frame in flight. The model, pinned SDK/WASM and public samples are served from the same site. Captures, uploads and imported models are never sent to a server. Pages still receives ordinary requests for site assets.
- The bundled full model is copied unchanged from `assets/`. Lite/heavy require the visitor's local `.task`; the selected variant is a user label, not model-content verification. Config sharing excludes local files.
- Inputs are resized to at most 1280 px on their longest side. Uploaded media is limited to 200 MiB. Browser video inference samples during playback, skips frames under load, and is not the native exhaustive file-sampling API. Seeking resets rule history. No audio is requested or analyzed.
- Display mirroring applies to both media and overlays; browser results keep original image coordinates and anatomical names. It does not establish native front-camera alignment.
- Native facing/lens/zoom controls affect exported Expo code only. The browser camera selector uses actual browser devices. Camera frame-rate targets are best effort and the applied browser capture settings are shown.
- Browser masks are copied into bounded alpha buffers and SDK results are closed immediately. This is separate from native mask leases and does not validate native backpressure.
- Static images remain available for feedback while displayed. Live feedback expires when stale. Missing selections and low-confidence geometry remain unknown.
- Browser recording version 1 stores `{format: "pose-playground", version: 1, frames: [{timestampMs, frame}]}`. Frames contain raw image/world landmarks, all poses, image dimensions and inference duration only. It does not fabricate native camera/thermal metadata. Recording stops at 1,800 frames or 15 MiB; imports allow 16 MiB. Native camera and file-detection recordings can be imported, subject to the same frame limit. Browser exports are not native `PoseRecording` files.
- Camera code exports styles and example feedback rules. Photo/video code exports inference options and an async consumer callback with mask cleanup; applications supply their file picker and rendering. Changing a browser upload or custom model requires a corresponding phone-local path in native code.

No accounts, backend or analytics. A same-origin-only Content Security Policy blocks the SDK’s external usage-log endpoint. The bundled worker is launched from a blob URL so it inherits that policy; external script/model URLs are not accepted. Configuration JSON is schema-validated data, never evaluated JavaScript. Source changes, pauses, backgrounding and errors release camera tracks and discard old-worker results. Physical-camera performance, native device capabilities and Safari/Firefox compatibility require separate validation.

Public sample/model provenance and notices are preserved in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and [fixture documentation](../example/fixtures/README.md).
