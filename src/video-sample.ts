import { readFrameRate } from "./pose-settings";

export function listSampleTimestamps(
	durationMs: number,
	sampleFrameRate: number,
): number[] {
	const checkedRate = readFrameRate(sampleFrameRate);
	const isDurationNotFinite = !Number.isFinite(durationMs);

	if (isDurationNotFinite) {
		throw new Error(
			"Video duration must be a positive number of milliseconds.",
		);
	}

	const isDurationNotPositive = durationMs <= 0;

	if (isDurationNotPositive) {
		throw new Error(
			"Video duration must be a positive number of milliseconds.",
		);
	}

	const millisecondsPerSecond = 1000;
	const stepMs = Math.floor(millisecondsPerSecond / checkedRate);
	const timestamps: number[] = [];

	for (let index = 0; index < durationMs; index += 1) {
		const timestampMs = index * stepMs;
		const isPastEnd = timestampMs >= durationMs;

		if (isPastEnd) return timestamps;

		const maxSampleFrames = 1000;
		const isOverCap = timestamps.length == maxSampleFrames;

		if (isOverCap) {
			throw new Error(
				"This video would pose too many frames. Lower sampleFrameRate.",
			);
		}

		timestamps.push(timestampMs);
	}

	return timestamps;
}
