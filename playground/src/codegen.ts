import type { SkeletonOptions } from "expo-mediapipe-pose/core";
import type { Config, Rule } from "./config";
import type { SourceMode } from "./types";
export function skeletonOptions(config: Config): SkeletonOptions {
	const { enabled: _enabled, ...options } = config.skeleton;
	return options;
}
function ruleCode(rule: Rule) {
	const names = JSON.stringify([rule.start, rule.vertex, rule.end]);
	const a = JSON.stringify(rule.start);
	const b = JSON.stringify(rule.vertex);
	const c = JSON.stringify(rule.end);
	let measure: string;
	if (rule.kind === "height") {
		measure = `const input = { landmarks: frame.landmarks, imageSize: frame.additionalData };
        const confidence = getImageDistance(input, ${a}, ${c}, { minVisibility: ${rule.minVisibility} });
        if (confidence.status !== "available") return null;
        const start = getLandmark(frame, ${a}); const end = getLandmark(frame, ${c});
        return start && end ? (start.y - end.y) * frame.additionalData.height : null;`;
	} else {
		const helper = `get${rule.space === "image" ? "Image" : "World"}${rule.kind === "angle" ? "JointAngle" : "Distance"}`;
		const input =
			rule.space === "image"
				? "{ landmarks: frame.landmarks, imageSize: frame.additionalData }"
				: "frame";
		const args = rule.kind === "angle" ? `${a}, ${b}, ${c}` : `${a}, ${c}`;
		measure = `const result = ${helper}(${input}, ${args}, { minVisibility: ${rule.minVisibility} });
        return result.status === "available" ? result.value : null;`;
	}
	return `createThresholdRule({
      landmarks: ${names}, direction: "${rule.direction}",
      enterThreshold: ${rule.enterThreshold}, exitThreshold: ${rule.exitThreshold},
      minVisibility: ${rule.minVisibility}, holdMs: ${rule.holdMs}, staleAfterMs: ${rule.staleAfterMs}, isActive: active,
      measure: (_pose, frame) => { ${measure} }
    })`;
}
export function generateCode(
	config: Config,
	mode: SourceMode,
	hasLocalModel = false,
): string {
	const d = config.detection;
	const needsModelPath = hasLocalModel || d.modelVariant !== "full";
	if (mode === "photo" || mode === "video" || mode === "sample") {
		const options = {
			minPoseDetectionConfidence: d.minPoseDetectionConfidence,
			minPosePresenceConfidence: d.minPosePresenceConfidence,
			maxPoses: d.maxPoses,
			modelVariant: d.modelVariant,
			...(needsModelPath
				? { modelPath: "/absolute/path/to/your-model.task" }
				: {}),
			segmentationEnabled: d.segmentationEnabled,
			maskMaxDimension: d.maskMaxDimension,
		};
		if (mode === "video")
			return `import { analyzePoseVideo, releasePoseSegmentation, type PoseDetection } from "expo-mediapipe-pose";

// Pass an AbortSignal to cancel; delivered masks still belong to this consumer.
export async function analyzeVideo(localUri: string, consume: (result: PoseDetection) => Promise<void>, signal: AbortSignal) {
  for await (const sample of analyzePoseVideo(localUri, { ...${JSON.stringify(options, null, 2)}, samplingFps: ${config.timing.frameLimit}, minTrackingConfidence: ${d.minTrackingConfidence}, signal })) {
    try { await consume(sample.detection); }
    finally {
      const masks = sample.detection.segmentation;
      if (masks?.status === "available") await releasePoseSegmentation(masks.leaseId);
    }
  }
}
`;
		return `import { analyzePoseImage, releasePoseSegmentation, type PoseDetection, type SkeletonOptions } from "expo-mediapipe-pose";

export const skeleton: SkeletonOptions = ${JSON.stringify(skeletonOptions(config), null, 2)};

// A local file URI on the phone, not the browser upload URL.
export async function analyzePhoto(localUri: string, consume: (result: PoseDetection) => Promise<void>) {
  const result = await analyzePoseImage(localUri, ${JSON.stringify(options, null, 2)});
  try { await consume(result); }
  finally {
    const masks = result.segmentation;
    if (masks?.status === "available") await releasePoseSegmentation(masks.leaseId);
  }
}
`;
	}
	const rules = config.rules
		.map((rule, i) => `rule${i}: ${ruleCode(rule)}`)
		.join(",\n    ");
	const styles = config.rules
		.map(
			(rule, i) => `{ status: feedback.statuses.rule${i}, styles: {
      pass: { joints: { ${rule.vertex}: { color: "${rule.passColor}" } } },
      fail: { joints: { ${rule.vertex}: { color: "${rule.failColor}" } } },
      unknown: { joints: { ${rule.vertex}: { color: "${rule.unknownColor}" } } }
    } }`,
		)
		.join(",\n    ");
	return `import * as React from "react";
import { AppState, Button, Linking, Text, View } from "react-native";
import { useCameraPermissions } from "expo-camera";
import {
  PoseCameraView, usePoseRules, createThresholdRule, composeSkeletonFeedback,
  getImageJointAngle, getWorldJointAngle, getImageDistance, getWorldDistance,
  getLandmark, selectPose, releasePoseSegmentation, type SkeletonOptions,
  ${d.segmentationEnabled ? "PoseSegmentationOverlay, PoseSkeleton, type PoseFrame," : ""}
} from "expo-mediapipe-pose";

const baseSkeleton: SkeletonOptions = ${JSON.stringify(skeletonOptions(config), null, 2)};

// Supply screen focus from your navigation library. Requires a native development build.
export function PoseScreen({ focused = true }: { focused?: boolean }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  const active = focused && foreground && error === null;
  ${d.segmentationEnabled ? maskStateCode(config) : ""}
  const feedback = usePoseRules({
    ${rules}
  });
  const skeleton = composeSkeletonFeedback(baseSkeleton, [${styles}]);
  if (!permission) return <Text>Checking permission…</Text>;
  if (!permission.granted) return <Button title="Allow camera" onPress={() => {
    if (permission.canAskAgain) void requestPermission(); else void Linking.openSettings();
  }} />;
  if (error) return <View><Text>{error}</Text><Button title="Retry" onPress={() => setError(null)} /></View>;
  return <PoseCameraView
    style={{ flex: 1 }} isActive={active}
    cameraFacing="${config.native.cameraFacing}" cameraLens="${config.native.cameraLens}" cameraZoomFactor={${config.native.cameraZoomFactor}}
    previewFps={${config.timing.previewFps}} frameLimit={${config.timing.frameLimit}} callbackFps={${config.timing.callbackFps}}
    poseModelVariant="${d.modelVariant}"${needsModelPath ? '\n    poseModelAssetPath="/absolute/path/to/your-model.task"' : ""}
    minPoseDetectionConfidence={${d.minPoseDetectionConfidence}} minPosePresenceConfidence={${d.minPosePresenceConfidence}} minTrackingConfidence={${d.minTrackingConfidence}}
    maxPoses={${d.maxPoses}} segmentationEnabled={${d.segmentationEnabled}} maskMaxDimension={${d.maskMaxDimension}}
    skeleton={${config.skeleton.enabled && !d.segmentationEnabled ? "skeleton" : "false"}}
    ${d.segmentationEnabled ? "onLayout={event => setSize(event.nativeEvent.layout)}" : ""}
    onCameraConfigured={() => { feedback.reset(); ${d.segmentationEnabled ? "setOverlayFrame(null);" : ""} }}
    onInferenceError={event => { feedback.reset(); setError(event.code); }}
    onLandmark={frame => {
      ${
				d.segmentationEnabled
					? `if (frame.segmentation?.status === "available") leases.current.add(frame.segmentation.leaseId);
      setOverlayFrame(frame);
      feedback.update(selectPose(frame, ${config.skeleton.poseIndex}));`
					: `try { feedback.update(selectPose(frame, ${config.skeleton.poseIndex})); }
      finally {
        // This example consumes landmarks only. If rendering a mask, keep its lease
        // until the overlay is replaced/unmounted, then release it.
        if (frame.segmentation?.status === "available") {
          void releasePoseSegmentation(frame.segmentation.leaseId).catch(cause => setError(String(cause)));
        }
      }`
			}
    }}
  ${
		d.segmentationEnabled
			? `>
    {overlayFrame?.segmentation && <PoseSegmentationOverlay segmentation={overlayFrame.segmentation} {...size} poseIndex={${config.skeleton.poseIndex}} color="${config.mask.color}" opacity={${config.mask.opacity}} onError={() => setError("Mask image unavailable")} />}
    ${config.skeleton.enabled ? "{overlayFrame && <PoseSkeleton frame={overlayFrame} {...size} {...skeleton} />}" : ""}
  </PoseCameraView>`
			: "/>"
	};
}
`;
}

function maskStateCode(config: Config): string {
	const staleMs = Math.max(
		500,
		2000 /
			Math.min(
				config.timing.previewFps,
				config.timing.frameLimit,
				config.timing.callbackFps,
			),
	);
	return `const [overlayFrame, setOverlayFrame] = React.useState<PoseFrame | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const leases = React.useRef(new Set<string>());
  const releaseLease = React.useCallback((id: string) => {
    leases.current.delete(id);
    void releasePoseSegmentation(id).catch(cause => console.error("Mask cleanup failed", cause));
  }, []);
  // Release replaced or batched-away leases only after the new overlay commits.
  React.useLayoutEffect(() => {
    const masks = overlayFrame?.segmentation;
    const retained = masks?.status === "available" ? masks.leaseId : null;
    for (const id of leases.current) if (id !== retained) releaseLease(id);
  }, [overlayFrame, releaseLease]);
  React.useLayoutEffect(() => () => {
    for (const id of leases.current) releaseLease(id);
  }, [releaseLease]);
  React.useEffect(() => { if (!active) setOverlayFrame(null); }, [active]);
  React.useEffect(() => {
    if (!overlayFrame) return;
    const timer = setTimeout(() => setOverlayFrame(null), ${staleMs});
    return () => clearTimeout(timer);
  }, [overlayFrame]);`;
}
