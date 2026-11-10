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
	Text,
	TextInput,
	View,
} from "react-native";
import { panelStyles } from "./panel-styles";
import { PoseIndexButton } from "./pose-index-button";

const releaseMasks = async (detection: PoseDetection | undefined) => {
	const segmentation = detection?.segmentation;
	const isSegmentationAvailable = segmentation?.status === "available";
	if (!isSegmentationAvailable) return;

	await releasePoseSegmentation(segmentation.leaseId);
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

			const assetLocalUri = asset.localUri;
			const isAssetLocalUriMissing = assetLocalUri === null;
			if (isAssetLocalUriMissing)
				throw new Error("Fixture is unavailable locally");

			const isTokenNotEqualsRequestCurrent = token !== request.current;
			if (isTokenNotEqualsRequestCurrent) return;

			setLocation(assetLocalUri);
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

	const hasError = error != null;

	const hasReport = report != null;
	const reportSegmentation = report?.detection.segmentation;
	const hasSegmentation = reportSegmentation != null;

	return (
		<View style={panelStyles.panel}>
			<Text style={panelStyles.label}>Analyze a local photo</Text>
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
				style={panelStyles.input}
			/>
			<Button
				title={analyzeButtonLabel}
				onPress={analyze}
				disabled={!canAnalyze}
			/>
			{hasError && <Text style={panelStyles.errorLabel}>{error}</Text>}
			{hasReport && (
				<Text style={panelStyles.label}>
					{hasSegmentation && `Masks: ${reportSegmentation.status} · `}
					{report.detection.landmarks.length} landmarks ·{" "}
					{report.detection.inferenceDurationMs.toFixed(1)} ms inference
				</Text>
			)}
			<View style={panelStyles.fillArea} onLayout={handlePhotoFrameLayout}>
				{hasReport && (
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
						{hasSegmentation && (
							<PoseSegmentationOverlay
								segmentation={reportSegmentation}
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
