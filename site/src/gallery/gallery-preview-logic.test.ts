import { describe, expect, test } from "vitest";
import {
	judgeWristsAboveShoulders,
	pickCameraFacing,
	pickContainedRegion,
	pickCyclingStyle,
	pickMaskStrokeWidths,
	pickRuleStatusText,
	pickStillFrameIndex,
	pickTimelineProgress,
	pickViewfinderCornerMarks,
} from "./gallery-preview-logic";

const writePose = (
	landmarks: Record<number, [number, number, number]>,
): number[] => {
	const frame = new Array<number>(99).fill(0);
	for (const [landmarkIndex, [x, y, visibility]] of Object.entries(landmarks)) {
		const start = Number(landmarkIndex) * 3;
		frame[start] = x;
		frame[start + 1] = y;
		frame[start + 2] = visibility;
	}
	return frame;
};

const shouldersAtHalf: Record<number, [number, number, number]> = {
	11: [0.4, 0.5, 0.9],
	12: [0.6, 0.5, 0.9],
};

describe("pickStillFrameIndex", () => {
	test("picks the first frame that holds a pose", () => {
		const frames = [[], [], new Array<number>(99).fill(0.5)];

		const index = pickStillFrameIndex(frames);

		expect(index).toBe(2);
	});

	test("falls back to the first frame when no frame holds a pose", () => {
		const frames = [[], []];

		const index = pickStillFrameIndex(frames);

		expect(index).toBe(0);
	});
});

describe("judgeWristsAboveShoulders", () => {
	test("passes when both wrists are above both shoulders", () => {
		const frame = writePose({
			...shouldersAtHalf,
			15: [0.3, 0.2, 0.9],
			16: [0.7, 0.2, 0.9],
		});

		const status = judgeWristsAboveShoulders(frame);

		expect(status).toBe("pass");
	});

	test("fails when only one wrist is above its shoulder", () => {
		const frame = writePose({
			...shouldersAtHalf,
			15: [0.3, 0.2, 0.9],
			16: [0.7, 0.8, 0.9],
		});

		const status = judgeWristsAboveShoulders(frame);

		expect(status).toBe("fail");
	});

	test("fails when the left wrist is below its shoulder", () => {
		const frame = writePose({
			...shouldersAtHalf,
			15: [0.3, 0.8, 0.9],
			16: [0.7, 0.2, 0.9],
		});

		const status = judgeWristsAboveShoulders(frame);

		expect(status).toBe("fail");
	});

	test("is unknown when a wrist is hard to see", () => {
		const frame = writePose({
			...shouldersAtHalf,
			15: [0.3, 0.2, 0.9],
			16: [0.7, 0.2, 0.1],
		});

		const status = judgeWristsAboveShoulders(frame);

		expect(status).toBe("unknown");
	});

	test("is unknown when the frame holds no pose", () => {
		const status = judgeWristsAboveShoulders([]);

		expect(status).toBe("unknown");
	});
});

describe("pickRuleStatusText", () => {
	test("names each status in plain capitals", () => {
		const texts = [
			pickRuleStatusText("pass"),
			pickRuleStatusText("fail"),
			pickRuleStatusText("unknown"),
		];

		expect(texts).toEqual(["MET", "NOT MET", "UNKNOWN"]);
	});
});

describe("pickTimelineProgress", () => {
	test("reports the share of the clip played so far", () => {
		const progress = pickTimelineProgress(3000, 12000);

		expect(progress).toBe(0.25);
	});

	test("starts over when the clip loops", () => {
		const progress = pickTimelineProgress(15000, 12000);

		expect(progress).toBe(0.25);
	});
});

describe("pickCyclingStyle", () => {
	test("starts with the thin signal look", () => {
		const style = pickCyclingStyle(0);

		expect(style).toEqual({
			colorName: "signal",
			lineWidth: 2,
			jointRadius: 3.5,
		});
	});

	test("moves to the next look after each step", () => {
		const style = pickCyclingStyle(1900);

		expect(style.colorName).toBe("joint");
		expect(style.lineWidth).toBe(4);
	});

	test("wraps back to the first look after the last", () => {
		const style = pickCyclingStyle(5400);

		expect(style.colorName).toBe("signal");
	});
});

describe("pickCameraFacing", () => {
	test("starts on the front camera", () => {
		expect(pickCameraFacing(0)).toBe("front");
	});

	test("switches to the back camera on the next step", () => {
		expect(pickCameraFacing(2500)).toBe("back");
	});

	test("switches back to the front camera after that", () => {
		expect(pickCameraFacing(5000)).toBe("front");
	});
});

describe("pickMaskStrokeWidths", () => {
	test("makes the torso stroke thicker than the limb stroke", () => {
		const widths = pickMaskStrokeWidths(100);

		expect(widths.limb).toBeCloseTo(7);
		expect(widths.torso).toBeCloseTo(16);
	});
});

describe("pickContainedRegion", () => {
	const videoSize = { width: 1280, height: 720 };

	test("fits a wide video inside a tall slot and centers it down", () => {
		const slot = { left: 0, top: 0, width: 160, height: 180 };

		const region = pickContainedRegion(slot, videoSize);

		expect(region).toEqual({ left: 0, top: 45, width: 160, height: 90 });
	});

	test("fits a video inside a wider slot and centers it across", () => {
		const slot = { left: 10, top: 0, width: 400, height: 90 };

		const region = pickContainedRegion(slot, videoSize);

		expect(region).toEqual({ left: 130, top: 0, width: 160, height: 90 });
	});
});

describe("pickViewfinderCornerMarks", () => {
	test("places four corners inset from the canvas edges with arms pointing inward", () => {
		const marks = pickViewfinderCornerMarks({ width: 200, height: 100 });

		expect(marks).toHaveLength(4);
		expect(marks[0]).toEqual({
			corner: { x: 10, y: 10 },
			horizontalEnd: { x: 24, y: 10 },
			verticalEnd: { x: 10, y: 24 },
		});
		expect(marks[3]).toEqual({
			corner: { x: 190, y: 90 },
			horizontalEnd: { x: 176, y: 90 },
			verticalEnd: { x: 190, y: 76 },
		});
	});
});
