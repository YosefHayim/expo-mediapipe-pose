import {
	type PoseFrame,
	type PoseRecording,
	PoseSkeleton,
	usePoseReplay,
	usePoseRule,
	usePoseTracking,
} from "expo-mediapipe-pose";
import * as React from "react";
import { Button, Text, View } from "react-native";
import { raisedArmRule } from "./poseRules";

export function ReplayPanel({
	recording,
	notice,
	onClose,
}: {
	recording: PoseRecording;
	notice: string | null;
	onClose: () => void;
}) {
	const [frame, setFrame] = React.useState<PoseFrame | null>(null);
	const [size, setSize] = React.useState({ width: 0, height: 0 });
	const rule = usePoseRule(raisedArmRule);
	const tracking = usePoseTracking({
		landmarks: ["leftWrist", "leftShoulder"],
	});
	const replay = usePoseReplay(recording, {
		onFrame: (next) => {
			setFrame(next);
			rule.update(next);
			tracking.update(next);
		},
		onReset: () => {
			setFrame(null);
			rule.reset();
			tracking.reset();
		},
	});
	return (
		<View style={{ flex: 1, gap: 12 }}>
			{notice && <Text style={{ color: "#fca5a5" }}>{notice}</Text>}
			<Text style={{ color: "white" }}>
				Landmark replay · {recording.frames.length} frames
			</Text>
			<Text style={{ color: "white" }}>
				{replay.status} · {replay.positionMs.toFixed(0)} /{" "}
				{replay.durationMs.toFixed(0)} ms
			</Text>
			<Text style={{ color: "white" }}>
				Tracking: {tracking.status} · Arm: {rule.status}
			</Text>
			<View
				style={{ flex: 1 }}
				onLayout={(event) => setSize(event.nativeEvent.layout)}
			>
				{frame && <PoseSkeleton frame={frame} {...size} color="#38bdf8" />}
			</View>
			<Button
				title="Play"
				onPress={replay.play}
				disabled={replay.status !== "paused"}
			/>
			<Button
				title="Pause"
				onPress={replay.pause}
				disabled={replay.status !== "playing"}
			/>
			<Button title="Reset" onPress={replay.reset} />
			<Button
				title="Seek halfway"
				onPress={() => replay.seek(replay.durationMs / 2)}
			/>
			<Button
				title={`Speed: ${replay.speed}×`}
				onPress={() => replay.setSpeed(replay.speed === 1 ? 2 : 1)}
			/>
			<Button title="Return to camera" onPress={onClose} />
		</View>
	);
}
