interface ToggleProps {
	label: string;
	value: boolean;
	onChange: (isOn: boolean) => void;
}

export const Toggle = ({ label, value, onChange }: ToggleProps) => {
	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={value}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{label}
		</label>
	);
};
