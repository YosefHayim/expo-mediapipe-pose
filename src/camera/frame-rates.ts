export interface FrameRates {
	frameLimit: number;
	previewFps: number;
	callbackFps: number;
}

export const validateFrameRates = (rates: FrameRates) => {
	for (const [name, frameRate] of Object.entries(rates)) {
		const withinRange = frameRate >= 1 && frameRate <= 60;

		const isInvalidFrameRate = !Number.isInteger(frameRate) || !withinRange;
		if (isInvalidFrameRate) {
			throw new RangeError(`${name} must be an integer between 1 and 60`);
		}
	}
};

export const getOverlayStaleAfterMs = (rates: FrameRates) => {
	validateFrameRates(rates);
	const slowestRate = Math.min(
		rates.previewFps,
		rates.frameLimit,
		rates.callbackFps,
	);
	return Math.max(500, 2000 / slowestRate);
};
