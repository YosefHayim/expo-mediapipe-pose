interface ColorProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
}

export const Color = ({ label, value, onChange }: ColorProps) => {
	return (
		<label className="color-field">
			<span>{label}</span>
			<input
				aria-label={label}
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<code>{value}</code>
		</label>
	);
};
