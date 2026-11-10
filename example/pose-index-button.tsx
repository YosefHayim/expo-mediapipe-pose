import { Button } from "react-native";

interface PoseIndexButtonProps {
	index: number;
	isSelected: boolean;
	onSelect: (index: number) => void;
}

export const PoseIndexButton = ({
	index,
	isSelected,
	onSelect,
}: PoseIndexButtonProps) => {
	const handlePoseIndexPress = () => onSelect(index);

	return (
		<Button
			title={`Show pose ${index + 1}`}
			onPress={handlePoseIndexPress}
			disabled={isSelected}
		/>
	);
};
