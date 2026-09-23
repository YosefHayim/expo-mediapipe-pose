export interface FrameRates {
	frameLimit: number;
	previewFps: number;
	callbackFps: number;
}

export const validateFrameRates = (rates: FrameRates) => {
	for (const [name, value] of Object.entries(rates)) {
		const withinRange = value >= 1 && value <= 60;
		if (!Number.isInteger(value) || !withinRange) {
			throw new RangeError(`${name} must be an integer between 1 and 60`);
		}
	}
};
