import type { ReactNode } from "react";

export type FaqItem = {
	id: string;
	question: string;
	answer: ReactNode;
};

/** Moved from the README FAQ, with the wording tightened and the meaning kept. */
export const FAQ_ITEMS: readonly FaqItem[] = [
	{
		id: "official",
		question:
			"Is this an official Google package? What does it add to MediaPipe?",
		answer: (
			<p>
				No. It is a community-maintained Expo integration built on Google's
				official MediaPipe Tasks SDKs and model. It adds a React Native camera
				component, typed events, skeleton styling, named geometry, rule and
				tracking hooks, local-media APIs and explicit mask ownership. It brings
				no new pose model and claims no better accuracy than the SDK underneath.
			</p>
		),
	},
	{
		id: "thinksys",
		question:
			"Is this a drop-in replacement for ThinkSys/mediapipe-reactnative?",
		answer: (
			<p>
				No. The public API is different: replace <code>RNMediapipe</code> with{" "}
				<code>PoseCameraView</code>, use controlled camera props and configure{" "}
				<code>SkeletonOptions</code>. Rebuild the native app and check your
				coordinate and overlay handling. Attribution is kept, and no speed or
				accuracy advantage over ThinkSys is claimed.
			</p>
		),
	},
	{
		id: "expo-go",
		question: "Does it work in Expo Go, a bare React Native app, or a browser?",
		answer: (
			<p>
				Camera and file inference need an iOS or Android development build. Expo
				Go cannot load this custom native module. A bare React Native app needs{" "}
				<a
					href="https://docs.expo.dev/bare/installing-expo-modules/"
					target="_blank"
					rel="noreferrer"
				>
					Expo modules installed
				</a>
				. The current target is Expo SDK 58 and React Native 0.88; older
				versions are not a verified match. There is no browser inference
				backend. Pure helpers are available from{" "}
				<code>expo-mediapipe-pose/core</code> without starting React Native.
			</p>
		),
	},
	{
		id: "native-only",
		question: "Can I use it from a Swift-only or Kotlin-only app?",
		answer: (
			<p>
				The supported API is TypeScript for Expo and React Native. The Swift and
				Kotlin sources are the Expo bridge, not a standalone Swift Package or
				Android library. For a fully native app, start with Google's{" "}
				<a
					href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/ios"
					target="_blank"
					rel="noreferrer"
				>
					iOS
				</a>{" "}
				or{" "}
				<a
					href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/android"
					target="_blank"
					rel="noreferrer"
				>
					Android
				</a>{" "}
				guide.
			</p>
		),
	},
	{
		id: "installation",
		question: "Which version do I install?",
		answer: (
			<p>
				Install <code>expo-mediapipe-pose@^0.4.0</code> from npm. It brings zod
				along, so <code>effect</code> is not needed. The older v0.2.0 GitHub tag
				has the earlier camera API. Read the documentation for the version you
				installed, because <code>main</code> can move ahead of it.
			</p>
		),
	},
	{
		id: "styling-rules",
		question: "Can I recolor single joints or act when a condition changes?",
		answer: (
			<p>
				Yes. <code>SkeletonOptions</code> styles the whole skeleton, single
				joints and connections, and picks body parts. Define one condition with{" "}
				<code>usePoseRule</code> or several with <code>usePoseRules</code>, then
				map their states to colors, text, haptics or app actions.{" "}
				<code>unknown</code> means missing, uncertain or stale input. These are
				conditions you define, not built-in exercise-form judgments.
			</p>
		),
	},
	{
		id: "frame-rate",
		question: "Can I control frame rate, battery use and background behavior?",
		answer: (
			<p>
				<code>previewFps</code>, <code>frameLimit</code> and{" "}
				<code>callbackFps</code> set capture targets, inference limits and
				JavaScript delivery on their own. Metrics report observed work; no
				requested rate is guaranteed. A lower callback rate does not reduce
				detector work. Tie <code>isActive</code> to screen focus and app
				foreground state. There is no automatic thermal or model switching, and
				no measured battery saving.
			</p>
		),
	},
	{
		id: "privacy",
		question: "Do images leave the device? Does it record video?",
		answer: (
			<p>
				Inference runs locally. The library does not upload frames or download
				models. Your app controls its own analytics, networking and storage.
				Landmark recording and replay keep pose data and metadata, not camera
				video or mask files. Local-video analysis reads a video that already
				exists.
			</p>
		),
	},
	{
		id: "pose-index",
		question: "Does a pose index identify the same person across frames?",
		answer: (
			<p>
				No. <code>maxPoses</code> allows up to six detections and{" "}
				<code>poseIndex</code> picks one inside a single result. Indices are not
				persistent identities. A missing selection stays empty; reset your
				temporal rules and tracking when the selection changes.
			</p>
		),
	},
	{
		id: "segmentation",
		question: "Why do segmentation results report backpressure?",
		answer: (
			<p>
				Segmentation is opt-in. At most two result leases can be open per
				module, and each owns bounded PNG mask files. Call{" "}
				<code>releasePoseSegmentation</code> when your consumer is done, also on
				errors and when an overlay is replaced or unmounted. The overlay does
				not release files for you. After a cancellation, masks already delivered
				for a video are still yours to release.
			</p>
		),
	},
	{
		id: "models",
		question:
			"Are the lite and heavy models included? What does a passing test prove?",
		answer: (
			<p>
				Only the full pose model is bundled. Lite and heavy need an explicit
				local model file. Native builds, behavior tests and public photo and
				video fixtures check the integration. They do not prove physical-camera
				alignment, sustained performance, medical accuracy or an edge over
				another wrapper. Repetition counting, exercise scoring and medical
				interpretation are not library features.
			</p>
		),
	},
];
