export const humanize = (value: string) =>
	value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
