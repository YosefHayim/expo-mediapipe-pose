import { Button } from "react-native";
import type { CameraSelection } from "./camera-controls";

interface CameraSelectButtonProps {
	title: string;
	isSelected: boolean;
	selection: CameraSelection;
	onSelect: (selection: CameraSelection) => void;
}

export const CameraSelectButton = ({
	title,
	isSelected,
	selection,
	onSelect,
}: CameraSelectButtonProps) => {
	const handleCameraSelectPress = () => onSelect(selection);

	return (
		<Button
			title={title}
			disabled={isSelected}
			onPress={handleCameraSelectPress}
		/>
	);
};
