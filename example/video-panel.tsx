import { Asset } from "expo-asset";
import {
	analyzePoseVideo,
	createPoseDetectionRecorder,
	PoseSkeleton,
	type PoseVideoFrame,
	type PoseVideoProgress,
} from "expo-mediapipe-pose";
import * as React from "react";
import { Button, Text, TextInput, View } from "react-native";

function videoFailureMessage(error: unknown): string {
	if (error instanceof AggregateError) return String(error);
	if (error instanceof Error && error.name === "AbortError")
		return "Cancelled.";
	return String(error);
}

export function VideoPanel({ onClose }: { onClose: () => void }) {
	const [location, setLocation] = React.useState("");
	const [result, setResult] = React.useState<PoseVideoFrame | null>(null);
	const [progress, setProgress] = React.useState<PoseVideoProgress | null>(
		null,
	);
	const [status, setStatus] = React.useState(
		"Choose a local video up to 60 seconds or load the public fixture.",
	);
	const [running, setRunning] = React.useState(false);
	const [size, setSize] = React.useState({ width: 0, height: 0 });
	const hasLocation = location.trim().length > 0;
	const canAnalyze = hasLocation && !running;
	const controller = React.useRef<AbortController | null>(null);
	React.useEffect(
		() => () => {
			controller.current?.abort();
			controller.current = null;
		},
		[],
	);
	const analyze = async () => {
		const request = new AbortController();
		controller.current = request;
		const recorder = createPoseDetectionRecorder({ maxFrames: 300 });
		recorder.start();
		setRunning(true);
		setResult(null);
		setProgress(null);
		setStatus("Analyzing at 5 samples per second…");
		try {
			for await (const frame of analyzePoseVideo(location, {
				samplingFps: 5,
				maxFrames: 300,
				signal: request.signal,
				onProgress: (value) => {
					if (controller.current === request) setProgress(value);
				},
			})) {
				recorder.append(frame.detection, frame.timestampMs);
				if (controller.current === request) setResult(frame);
			}
			if (controller.current === request)
				setStatus(
					`Complete: ${recorder.stop().frames.length} landmark frames recorded in memory.`,
				);
		} catch (error) {
			if (controller.current === request) setStatus(videoFailureMessage(error));
		} finally {
			if (controller.current === request) {
				controller.current = null;
				setRunning(false);
			}
		}
	};
	const loadFixture = async () => {
		try {
			const asset = await Asset.fromModule(
				require("./fixtures/pose-video.mp4"),
			).downloadAsync();
			if (asset.localUri === null)
				throw new Error("Fixture is not available locally");
			setLocation(asset.localUri);
		} catch (error) {
			setStatus(String(error));
		}
	};
	return (
		<View style={{ flex: 1, gap: 12 }}>
			<Text style={{ color: "white" }}>
				Analyze a local video (up to 60 seconds)
			</Text>
			<TextInput
				value={location}
				onChangeText={setLocation}
				editable={!running}
				autoCapitalize="none"
				placeholder="file:///…"
				placeholderTextColor="#94a3b8"
				style={{
					color: "white",
					borderColor: "#64748b",
					borderWidth: 1,
					padding: 12,
				}}
			/>
			<Button
				title="Load public test video"
				onPress={loadFixture}
				disabled={running}
			/>
			<Button title="Analyze" onPress={analyze} disabled={!canAnalyze} />
			<Button
				title="Cancel"
				onPress={() => controller.current?.abort()}
				disabled={!running}
			/>
			<Text style={{ color: "white" }}>{status}</Text>
			{progress && (
				<Text style={{ color: "white" }}>
					{progress.completedFrames}/{progress.totalFrames} samples ·{" "}
					{progress.timestampMs} ms
				</Text>
			)}
			<View
				style={{ flex: 1 }}
				onLayout={(event) => setSize(event.nativeEvent.layout)}
			>
				{result && <PoseSkeleton detection={result.detection} {...size} />}
			</View>
			<Button title="Return to camera" onPress={onClose} />
		</View>
	);
}
