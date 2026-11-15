export const createReadableLabel = (name: string) =>
	name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
