import { type ChangeEvent, type ReactNode, useId } from "react";

interface SelectProps<Choice extends string> {
	label: string;
	value: Choice;
	onChange: (choice: Choice) => void;
	children: ReactNode;
}

export const Select = <Choice extends string>({
	label,
	value,
	onChange,
	children,
}: SelectProps<Choice>) => {
	const id = useId();
	const handleSelectInputChange = (event: ChangeEvent<HTMLSelectElement>) =>
		onChange(event.target.value as Choice);

	return (
		<label className="field" htmlFor={id}>
			{label}
			<select id={id} value={value} onChange={handleSelectInputChange}>
				{children}
			</select>
		</label>
	);
};
