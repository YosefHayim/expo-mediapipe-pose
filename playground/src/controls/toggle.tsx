import type { ChangeEvent } from "react";

interface ToggleProps {
	label: string;
	value: boolean;
	onChange: (isOn: boolean) => void;
}

export const Toggle = ({ label, value, onChange }: ToggleProps) => {
	const handleToggleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
		onChange(event.target.checked);

	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={value}
				onChange={handleToggleInputChange}
			/>
			{label}
		</label>
	);
};
