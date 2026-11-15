import type { BODY_PARTS } from "expo-mediapipe-pose/core";
import { createReadableLabel } from "./humanize";

export type BodyPart = keyof typeof BODY_PARTS;

interface BodyPartChipProps {
	part: BodyPart;
	isSelected: boolean;
	onToggle: (part: BodyPart) => void;
}

export const BodyPartChip = ({
	part,
	isSelected,
	onToggle,
}: BodyPartChipProps) => {
	const handleChipClick = () => onToggle(part);

	return (
		<button type="button" aria-pressed={isSelected} onClick={handleChipClick}>
			{createReadableLabel(part)}
		</button>
	);
};
