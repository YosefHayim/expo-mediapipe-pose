import {
	type CameraCapabilities,
	findCameraCapability,
	getCameraCapabilities,
} from "expo-mediapipe-pose";
import * as React from "react";
import { Button, Text, View } from "react-native";

export type CameraSelection = {
	facing: "front" | "back";
	lens: "wide" | "ultraWide";
	previewFps: number;
};

export function CameraControls({
	selection,
	onSelect,
}: {
	selection: CameraSelection;
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
	const selectedCamera = findCameraCapability(
		capabilities,
		selection.facing,
		selection.lens,
	);
	return (
		<View>
			{capabilities.cameras.map((camera) => (
				<Button
					key={`${camera.facing}-${camera.lens}`}
					title={`${camera.facing} / ${camera.lens} · ${camera.modes[0].previewFps} fps`}
					onPress={() =>
						onSelect({
							facing: camera.facing,
							lens: camera.lens,
							previewFps: camera.modes[0].previewFps,
						})
					}
				/>
			))}
			{selectedCamera?.zoomRange && (
				<Text style={{ color: "white" }}>
					Available zoom: {selectedCamera.zoomRange.min}–
					{selectedCamera.zoomRange.max.toFixed(1)}×
				</Text>
			)}
			{selectedCamera && (
				<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
					{selectedCamera.modes
						.filter((mode) => [15, 24, 30, 60].includes(mode.previewFps))
						.map((mode) => (
							<Button
								key={mode.previewFps}
								title={`${mode.previewFps} fps`}
								disabled={selection.previewFps === mode.previewFps}
								onPress={() =>
									onSelect({ ...selection, previewFps: mode.previewFps })
								}
							/>
						))}
				</View>
			)}
		</View>
	);
}
