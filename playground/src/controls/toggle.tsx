interface ToggleProps {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}

export const Toggle = ({ label, value, onChange }: ToggleProps) => {
	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
			/>
			{label}
		</label>
	);
};
