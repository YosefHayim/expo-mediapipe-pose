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
	React.useEffect(() => {
		let cancelled = false;
		getCameraCapabilities()
			.then((result) => {
				if (!cancelled) setCapabilities(result);
			})
			.catch(() => {
				if (!cancelled) setError(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	if (error)
		return (
			<Text style={{ color: "white" }}>
				Camera discovery failed. Reopen this screen to retry.
			</Text>
		);
	if (!capabilities)
		return <Text style={{ color: "white" }}>Discovering cameras…</Text>;
	if (capabilities.status !== "available")
		return <Text style={{ color: "white" }}>{capabilities.status}</Text>;
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
				return (
					<Button
						key={`${camera.facing}-${camera.lens}`}
						title={`${camera.facing} / ${camera.lens} · ${initialMode.previewFps} fps`}
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
