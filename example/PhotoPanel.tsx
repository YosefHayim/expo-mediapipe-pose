import { Asset } from "expo-asset";
import {
	analyzePoseImage,
	type PoseDetection,
	PoseSkeleton,
} from "expo-mediapipe-pose";
import * as React from "react";
import { Button, Image, Text, TextInput, View } from "react-native";

export function PhotoPanel({ onClose }: { onClose: () => void }) {
	const [location, setLocation] = React.useState("");
	const [maxPoses, setMaxPoses] = React.useState(1);
	const [poseIndex, setPoseIndex] = React.useState(0);
	const [result, setResult] = React.useState<{
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
	const analyze = async () => {
		const token = ++request.current;
		setBusy(true);
		setError(null);
		setResult(null);
		setPoseIndex(0);
		try {
			const detection = await analyzePoseImage(location, { maxPoses });
			const imageUri = location.startsWith("/")
				? `file://${location.split("/").map(encodeURIComponent).join("/")}`
				: location;
			if (token === request.current)
				setResult({ location: imageUri, detection });
		} catch (failure) {
			if (token === request.current) setError(String(failure));
		} finally {
			if (token === request.current) setBusy(false);
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
			if (asset.localUri === null)
				throw new Error("Fixture is unavailable locally");
			if (token !== request.current) return;
			setLocation(asset.localUri);
			setMaxPoses(2);
		} catch (failure) {
			if (token === request.current) setError(String(failure));
		} finally {
			if (token === request.current) setBusy(false);
		}
	};
	const poseIndices = Array.from(
		{ length: result?.detection.poses?.length ?? 0 },
		(_, index) => index,
	);
	return (
		<View style={{ flex: 1, gap: 12 }}>
			<Text style={{ color: "white" }}>Analyze a local photo</Text>
			<Button
				title="Load public two-person photo"
				onPress={loadFixture}
				disabled={busy}
			/>
			<Button
				title={`Maximum poses: ${maxPoses}`}
				onPress={() => setMaxPoses(maxPoses === 1 ? 2 : 1)}
				disabled={busy}
			/>
			{poseIndices.map((index) => (
				<Button
					key={index}
					title={`Show pose ${index + 1}`}
					onPress={() => setPoseIndex(index)}
					disabled={poseIndex === index}
				/>
			))}
			<TextInput
				value={location}
				onChangeText={setLocation}
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
				title={busy ? "Analyzing…" : "Analyze"}
				onPress={analyze}
				disabled={!canAnalyze}
			/>
			{error && <Text style={{ color: "#fca5a5" }}>{error}</Text>}
			{result && (
				<Text style={{ color: "white" }}>
					{result.detection.landmarks.length} landmarks ·{" "}
					{result.detection.inferenceDurationMs.toFixed(1)} ms inference
				</Text>
			)}
			<View
				style={{ flex: 1 }}
				onLayout={(event) => setSize(event.nativeEvent.layout)}
			>
				{result && (
					<>
						<Image
							source={{ uri: result.location }}
							resizeMode="cover"
							style={{
								position: "absolute",
								width: size.width,
								height: size.height,
							}}
						/>
						<PoseSkeleton
							poseIndex={poseIndex}
							detection={result.detection}
							{...size}
						/>
					</>
				)}
			</View>
			<Button title="Return to camera" onPress={onClose} />
		</View>
	);
}
