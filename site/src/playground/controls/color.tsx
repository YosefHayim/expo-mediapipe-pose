import type { ChangeEvent } from "react";

interface ColorProps {
	label: string;
	value: string;
	onChange: (color: string) => void;
}

export const Color = ({ label, value, onChange }: ColorProps) => {
	const handleColorInputChange = (event: ChangeEvent<HTMLInputElement>) =>
		onChange(event.target.value);

	return (
		<label className="color-field">
			<span>{label}</span>
			<input
				aria-label={label}
				type="color"
				value={value}
				onChange={handleColorInputChange}
			/>
			<code>{value}</code>
		</label>
	);
};
