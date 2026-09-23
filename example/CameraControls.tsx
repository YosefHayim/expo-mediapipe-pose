import {
	type CameraCapabilities,
	findCameraCapability,
	getCameraCapabilities,
} from "expo-mediapipe-pose";
import * as React from "react";
import { Button, ScrollView, Text, View } from "react-native";

export type CameraSelection = {
	facing: "front" | "back";
	lens: "wide" | "ultraWide";
	previewFps: number;
};

export function CameraControls({
	selection,
	onSelect,
}: {
	selection: CameraSelection | null;
	onSelect: (selection: CameraSelection) => void;
}) {
	const [capabilities, setCapabilities] =
		React.useState<CameraCapabilities | null>(null);
	const [error, setError] = React.useState(false);
	const request = React.useRef(0);
	const discover = React.useCallback(async () => {
		const token = ++request.current;
		setError(false);
		setCapabilities(null);
		try {
			const result = await getCameraCapabilities();
			if (request.current === token) setCapabilities(result);
		} catch {
			if (request.current === token) setError(true);
		}
	}, []);
	React.useEffect(() => {
		void discover();
		return () => {
			request.current += 1;
		};
	}, [discover]);
	if (error)
		return (
			<View>
				<Text style={{ color: "white" }}>Camera discovery failed.</Text>
				<Button title="Retry discovery" onPress={discover} />
			</View>
		);
	if (!capabilities)
		return <Text style={{ color: "white" }}>Discovering cameras…</Text>;
	if (capabilities.status !== "available") {
		const message =
			capabilities.status === "permissionRequired"
				? "Allow camera access in settings, then retry discovery."
				: "No selectable camera is currently available.";
		return (
			<View>
				<Text style={{ color: "white" }}>{message}</Text>
				<Button title="Retry discovery" onPress={discover} />
			</View>
		);
	}
	const selectedCamera = selection
		? findCameraCapability(capabilities, selection.facing, selection.lens)
		: undefined;
	return (
		<View>
			{capabilities.cameras.map((camera) => {
				const initialMode = camera.modes.reduce((nearest, mode) =>
					Math.abs(mode.previewFps - 30) < Math.abs(nearest.previewFps - 30)
						? mode
						: nearest,
				);
				const displayedFps =
					selectedCamera === camera && selection
						? selection.previewFps
						: initialMode.previewFps;
				return (
					<Button
						key={`${camera.facing}-${camera.lens}`}
						disabled={selectedCamera === camera}
						title={`${camera.facing} / ${camera.lens} · ${displayedFps} fps`}
						onPress={() =>
							onSelect({
								facing: camera.facing,
								lens: camera.lens,
								previewFps: initialMode.previewFps,
							})
						}
					/>
				);
			})}
			{selectedCamera?.zoomRange && (
				<Text style={{ color: "white" }}>
					Available zoom: {selectedCamera.zoomRange.min}–
					{selectedCamera.zoomRange.max.toFixed(1)}×
				</Text>
			)}
			{selectedCamera && (
				<ScrollView horizontal>
					{selectedCamera.modes.map((mode) => (
						<Button
							key={mode.previewFps}
							title={`${mode.previewFps} fps`}
							disabled={selection?.previewFps === mode.previewFps}
							onPress={() =>
								onSelect({
									facing: selectedCamera.facing,
									lens: selectedCamera.lens,
									previewFps: mode.previewFps,
								})
							}
						/>
					))}
				</ScrollView>
			)}
		</View>
	);
}
