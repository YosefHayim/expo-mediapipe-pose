import {
	type PoseFrame,
	type PoseRecording,
	PoseSkeleton,
	usePoseReplay,
	usePoseRule,
	usePoseTracking,
} from "expo-mediapipe-pose";
import * as React from "react";
import {
	Button,
	type LayoutChangeEvent,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { raisedArmRule } from "@/rules/pose-rules";

export const ReplayPanel = ({
	recording,
	notice,
	onClose,
}: {
	recording: PoseRecording;
	notice: string | null;
	onClose: () => void;
}) => {
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
	const handleReplayFrameLayout = (event: LayoutChangeEvent) =>
		setSize(event.nativeEvent.layout);

	const handleReplaySeekMiddlePress = () => replay.seek(replay.durationMs / 2);

	const handleReplaySpeedTogglePress = () => {
		const isNormalSpeed = replay.speed === 1;
		return replay.setSpeed(isNormalSpeed ? 2 : 1);
	};

	return (
		<View style={styles.panel}>
			{notice && <Text style={styles.errorText}>{notice}</Text>}
			<Text style={styles.text}>
				Landmark replay · {recording.frames.length} frames
			</Text>
			<Text style={styles.text}>
				{replay.status} · {replay.positionMs.toFixed(0)} /{" "}
				{replay.durationMs.toFixed(0)} ms
			</Text>
			<Text style={styles.text}>
				Tracking: {tracking.status} · Arm: {rule.status}
			</Text>
			<View style={styles.fillArea} onLayout={handleReplayFrameLayout}>
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
			<Button title="Seek halfway" onPress={handleReplaySeekMiddlePress} />
			<Button
				title={`Speed: ${replay.speed}×`}
				onPress={handleReplaySpeedTogglePress}
			/>
			<Button title="Return to camera" onPress={onClose} />
		</View>
	);
};

const styles = StyleSheet.create({
	fillArea: {
		flex: 1,
	},
	panel: {
		flex: 1,
		gap: 12,
	},
	text: {
		color: "white",
	},
	errorText: {
		color: "#fca5a5",
	},
});
