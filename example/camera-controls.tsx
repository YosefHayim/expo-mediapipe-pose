import {
	type CameraCapabilities,
	findCameraCapability,
	getCameraCapabilities,
} from "expo-mediapipe-pose";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CameraSelectButton } from "./camera-select-button";

export type CameraSelection = {
	facing: "front" | "back";
	lens: "wide" | "ultraWide";
	previewFps: number;
};

export const CameraControls = ({
	selection,
	onSelect,
}: {
	selection: CameraSelection | null;
	onSelect: (selection: CameraSelection) => void;
}) => {
	const [capabilities, setCapabilities] =
		React.useState<CameraCapabilities | null>(null);
	const [error, setError] = React.useState(false);
	const request = React.useRef(0);
	const discover = React.useCallback(async () => {
		const token = ++request.current;
		setError(false);
		setCapabilities(null);
		try {
			const report = await getCameraCapabilities();

			const isRequestCurrentEqualsToken = request.current === token;
			if (isRequestCurrentEqualsToken) setCapabilities(report);
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
				<Text style={styles.text}>Camera discovery failed.</Text>
				<Button title="Retry discovery" onPress={discover} />
			</View>
		);

	const isCapabilitiesMissing = capabilities == null;
	if (isCapabilitiesMissing)
		return <Text style={styles.text}>Discovering cameras…</Text>;

	const isCapabilitiesUnavailable = capabilities.status !== "available";
	if (isCapabilitiesUnavailable) {
		const isPermissionRequired = capabilities.status === "permissionRequired";
		const message = isPermissionRequired
			? "Allow camera access in settings, then retry discovery."
			: "No selectable camera is currently available.";
		return (
			<View>
				<Text style={styles.text}>{message}</Text>
				<Button title="Retry discovery" onPress={discover} />
			</View>
		);
	}

	const hasSelection = selection !== null;
	const selectedCamera = hasSelection
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
					<CameraSelectButton
						key={`${camera.facing}-${camera.lens}`}
						title={`${camera.facing} / ${camera.lens} · ${displayedFps} fps`}
						isSelected={selectedCamera === camera}
						selection={{
							facing: camera.facing,
							lens: camera.lens,
							previewFps: initialMode.previewFps,
						}}
						onSelect={onSelect}
					/>
				);
			})}
			{selectedCamera?.zoomRange && (
				<Text style={styles.text}>
					Available zoom: {selectedCamera.zoomRange.min}–
					{selectedCamera.zoomRange.max.toFixed(1)}×
				</Text>
			)}
			{selectedCamera && (
				<ScrollView horizontal>
					{selectedCamera.modes.map((mode) => (
						<CameraSelectButton
							key={mode.previewFps}
							title={`${mode.previewFps} fps`}
							isSelected={selection?.previewFps === mode.previewFps}
							selection={{
								facing: selectedCamera.facing,
								lens: selectedCamera.lens,
								previewFps: mode.previewFps,
							}}
							onSelect={onSelect}
						/>
					))}
				</ScrollView>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	text: {
		color: "white",
	},
});
