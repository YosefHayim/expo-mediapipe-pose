interface TabButtonProps<Tab extends string> {
	tab: Tab;
	label: string;
	isSelected: boolean;
	onSelect: (tab: Tab) => void;
}

export const TabButton = <Tab extends string>({
	tab,
	label,
	isSelected,
	onSelect,
}: TabButtonProps<Tab>) => {
	const handleTabClick = () => onSelect(tab);

	return (
		<button type="button" aria-pressed={isSelected} onClick={handleTabClick}>
			{label}
		</button>
	);
};
