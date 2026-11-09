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

			const isRequestCurrentEqualsToken = request.current === token;
			if (isRequestCurrentEqualsToken) setCapabilities(result);
		} catch {
			const isRequestStillCurrentInCatch = request.current === token;
			if (isRequestStillCurrentInCatch) setError(true);
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

	const isCapabilitiesMissing = capabilities == null;
	if (isCapabilitiesMissing)
		return <Text style={{ color: "white" }}>Discovering cameras…</Text>;

	const isCapabilitiesUnavailable = capabilities.status !== "available";
	if (isCapabilitiesUnavailable) {
		const isPermissionRequired = capabilities.status === "permissionRequired";
		const message = isPermissionRequired
			? "Allow camera access in settings, then retry discovery."
			: "No selectable camera is currently available.";
		return (
			<View>
				<Text style={{ color: "white" }}>{message}</Text>
				<Button title="Retry discovery" onPress={discover} />
			</View>
		);
	}

	const isSelectionPresent = selection !== null;
	const selectedCamera = isSelectionPresent
		? findCameraCapability(capabilities, selection.facing, selection.lens)
		: undefined;
	return (
		<View>
			{capabilities.cameras.map((camera) => {
				const initialMode = camera.modes.reduce((nearest, mode) => {
					const isCloserToThirtyFps =
						Math.abs(mode.previewFps - 30) < Math.abs(nearest.previewFps - 30);
					return isCloserToThirtyFps ? mode : nearest;
				});
				const isCameraSelectionActive = selectedCamera === camera && selection;
				const displayedFps = isCameraSelectionActive
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
