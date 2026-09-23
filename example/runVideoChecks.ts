import { analyzePoseVideo, type PoseDetection } from "expo-mediapipe-pose";

function verify(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
export async function runVideoChecks(
	video: string,
	rotated: string,
	reference: PoseDetection,
	cases: string[],
) {
	for (const [label, location] of [
		["upright", video],
		["rotated", rotated],
	] as const) {
		const timestamps: number[] = [];
		for await (const frame of analyzePoseVideo(location, {
			samplingFps: 2,
			maxImageDimension: 1024,
		})) {
			timestamps.push(frame.timestampMs);
			verify(
				frame.detection.landmarks.length === 33,
				"Video must detect a pose",
			);
			verify(
				frame.detection.imageSize.width > frame.detection.imageSize.height,
				"Video orientation must produce upright dimensions",
			);
			for (const [index, landmark] of frame.detection.landmarks.entries()) {
				const joint = reference.landmarks[index];
				verify(joint !== undefined, "Reference landmark must exist");
				verify(
					Math.abs(landmark.x - joint.x) < 0.06,
					`${label} video x must align with reference`,
				);
				verify(
					Math.abs(landmark.y - joint.y) < 0.06,
					`${label} video y must align with reference`,
				);
			}
		}
		verify(
			JSON.stringify(timestamps) === "[0,500,1000,1500]",
			"Video samples must have monotonic media timestamps",
		);
		cases.push(`${label} video decode, timestamps and pose alignment`);
	}
	let fractionalSamples = 0;
	for await (const sample of analyzePoseVideo(video, {
		samplingFps: 30,
		endMs: 100,
	})) {
		verify(
			sample.detection.landmarks.length === 33,
			"Between-frame requests must decode a pose",
		);
		fractionalSamples += 1;
	}
	verify(
		fractionalSamples === 3,
		"Fractional frame intervals must remain bounded",
	);
	cases.push("sampling between encoded frames");
	const controller = new AbortController();
	const stream = analyzePoseVideo(video, { signal: controller.signal });
	await stream.next();
	controller.abort();
	let cancelled = false;
	try {
		await stream.next();
	} catch (error) {
		cancelled = error instanceof Error && error.name === "AbortError";
	}
	verify(cancelled, "Cancellation must reject with AbortError");
	cases.push("video cancellation");
	for await (const frame of analyzePoseVideo(video, {
		maxImageDimension: 256,
	})) {
		verify(
			Math.max(
				frame.detection.imageSize.width,
				frame.detection.imageSize.height,
			) <= 256,
			"Video decode must be bounded",
		);
		break;
	}
	for await (const frame of analyzePoseVideo(video)) {
		verify(
			frame.detection.landmarks.length === 33,
			"Video must reopen after early break",
		);
		break;
	}
	cases.push(
		"bounded video decode and resource reuse after break/cancellation",
	);
}
