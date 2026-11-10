import { Asset } from "expo-asset";
import {
	analyzePoseImage,
	type PoseDetection,
	PoseSegmentationOverlay,
	PoseSkeleton,
	releasePoseSegmentation,
} from "expo-mediapipe-pose";
import * as React from "react";
import {
	Button,
	Image,
	type LayoutChangeEvent,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { PoseIndexButton } from "./pose-index-button";

const releaseMasks = async (detection: PoseDetection | undefined) => {
	const isDetectionSegmentationUnavailable =
		detection?.segmentation?.status !== "available";
	if (isDetectionSegmentationUnavailable) return;

	await releasePoseSegmentation(detection.segmentation.leaseId);
};

export const PhotoPanel = ({ onClose }: { onClose: () => void }) => {
	const [location, setLocation] = React.useState("");
	const [maxPoses, setMaxPoses] = React.useState(1);
	const [segmentationEnabled, setSegmentationEnabled] = React.useState(false);
	const [poseIndex, setPoseIndex] = React.useState(0);
	const [report, setReport] = React.useState<{
		location: string;
		detection: PoseDetection;
	} | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [size, setSize] = React.useState({ width: 0, height: 0 });
	const hasLocation = location.trim().length > 0;
	const canAnalyze = hasLocation && !busy;
	const request = React.useRef(0);
	React.useEffect(
		() => () => {
			request.current += 1;
		},
		[],
	);
	React.useEffect(
		() => () => {
			void releaseMasks(report?.detection).catch((error) =>
				console.error("Mask cleanup failed", error),
			);
		},
		[report],
	);
	const analyze = async () => {
		const token = ++request.current;
		setBusy(true);
		setError(null);
		setReport(null);
		setPoseIndex(0);
		try {
			const detection = await analyzePoseImage(location, {
				maxPoses,
				segmentationEnabled,
			});
			const isAbsoluteLocation = location.startsWith("/");
			const imageUri = isAbsoluteLocation
				? `file://${location.split("/").map(encodeURIComponent).join("/")}`
				: location;

			const isTokenNotEqualsRequestCurrent = token !== request.current;
			if (isTokenNotEqualsRequestCurrent) {
				await releaseMasks(detection);
				return;
			}

			setReport({ location: imageUri, detection });
		} catch (failure) {
			const isTokenEqualsRequestCurrent = token === request.current;
			if (isTokenEqualsRequestCurrent) setError(String(failure));
		} finally {
			const isTokenCurrent = token === request.current;
			if (isTokenCurrent) setBusy(false);
		}
	};
	const loadFixture = async () => {
		const token = ++request.current;
		setBusy(true);
		setError(null);
		try {
			const asset = await Asset.fromModule(
				require("./fixtures/man-woman-okay.jpg"),
			).downloadAsync();

			const isAssetLocalUriMissing = asset.localUri === null;
			if (isAssetLocalUriMissing)
				throw new Error("Fixture is unavailable locally");

			const isTokenNotEqualsRequestCurrent = token !== request.current;
			if (isTokenNotEqualsRequestCurrent) return;

			setLocation(asset.localUri);
			setMaxPoses(2);
		} catch (failure) {
			const isTokenEqualsRequestCurrent = token === request.current;
			if (isTokenEqualsRequestCurrent) setError(String(failure));
		} finally {
			const isTokenCurrent = token === request.current;
			if (isTokenCurrent) setBusy(false);
		}
	};
	const poseIndices = Array.from(
		{ length: report?.detection.poses?.length ?? 0 },
		(_, index) => index,
	);
	const segmentationStatusLabel = segmentationEnabled ? "on" : "off";
	const analyzeButtonLabel = busy ? "Analyzing…" : "Analyze";

	const handleSegmentationTogglePress = () =>
		setSegmentationEnabled((isEnabled) => !isEnabled);

	const handleMaxPosesTogglePress = () => {
		const isSinglePose = maxPoses === 1;
		return setMaxPoses(isSinglePose ? 2 : 1);
	};

	const handlePhotoFrameLayout = (event: LayoutChangeEvent) =>
		setSize(event.nativeEvent.layout);

	return (
		<View style={{ flex: 1, gap: 12 }}>
			<Text style={{ color: "white" }}>Analyze a local photo</Text>
			<Button
				title={`Segmentation: ${segmentationStatusLabel}`}
				onPress={handleSegmentationTogglePress}
				disabled={busy}
			/>
			<Button
				title="Load public two-person photo"
				onPress={loadFixture}
				disabled={busy}
			/>
			<Button
				title={`Maximum poses: ${maxPoses}`}
				onPress={handleMaxPosesTogglePress}
				disabled={busy}
			/>
			{poseIndices.map((index) => (
				<PoseIndexButton
					key={index}
					index={index}
					isSelected={poseIndex === index}
					onSelect={setPoseIndex}
				/>
			))}
			<TextInput
				value={location}
				onChangeText={setLocation}
				editable={!busy}
				autoCapitalize="none"
				placeholder="file:///… (copy picker results into app storage)"
				placeholderTextColor="#94a3b8"
				style={{
					color: "white",
					borderColor: "#64748b",
					borderWidth: 1,
					padding: 12,
				}}
			/>
			<Button
				title={analyzeButtonLabel}
				onPress={analyze}
				disabled={!canAnalyze}
			/>
			{error && <Text style={{ color: "#fca5a5" }}>{error}</Text>}
			{report && (
				<Text style={{ color: "white" }}>
					{report.detection.segmentation &&
						`Masks: ${report.detection.segmentation.status} · `}
					{report.detection.landmarks.length} landmarks ·{" "}
					{report.detection.inferenceDurationMs.toFixed(1)} ms inference
				</Text>
			)}
			<View style={styles.fillArea} onLayout={handlePhotoFrameLayout}>
				{report && (
					<>
						<Image
							source={{ uri: report.location }}
							resizeMode="cover"
							style={{
								position: "absolute",
								width: size.width,
								height: size.height,
							}}
						/>
						{report.detection.segmentation && (
							<PoseSegmentationOverlay
								segmentation={report.detection.segmentation}
								poseIndex={poseIndex}
								{...size}
							/>
						)}
						<PoseSkeleton
							poseIndex={poseIndex}
							detection={report.detection}
							{...size}
						/>
					</>
				)}
			</View>
			<Button title="Return to camera" onPress={onClose} />
		</View>
	);
};

const styles = StyleSheet.create({
	fillArea: {
		flex: 1,
	},
});
