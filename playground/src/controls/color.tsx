interface ColorProps {
	label: string;
	value: string;
	onChange: (color: string) => void;
}

export const Color = ({ label, value, onChange }: ColorProps) => {
	return (
		<label className="color-field">
			<span>{label}</span>
			<input
				aria-label={label}
				type="color"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			<code>{value}</code>
		</label>
	);
};
