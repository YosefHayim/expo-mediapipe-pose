import { describe, expect, test } from "vitest";
import {
	isPointInsideFrame,
	mapLandmarkToCanvas,
	measureJointArc,
	pickDrawInProgress,
	pickFrameIndex,
	placeReadoutLabel,
	readLandmark,
} from "./hero-skeleton-logic";

const videoSize = { width: 1280, height: 720 };

describe("pickFrameIndex", () => {
	test("floors the time to a frame", () => {
		const index = pickFrameIndex(1.05, 30, 360);

		expect(index).toBe(31);
	});

	test("wraps around when the clip loops", () => {
		const index = pickFrameIndex(12.1, 30, 360);

		expect(index).toBe(3);
	});
});

describe("readLandmark", () => {
	const frame = [0.1, 0.2, 0.9, 0.3, 0.4, 0.2];

	test("reads a visible landmark", () => {
		const point = readLandmark(frame, 0);

		expect(point).toEqual({ x: 0.1, y: 0.2 });
	});

	test("skips a landmark under half visibility", () => {
		const point = readLandmark(frame, 1);

		expect(point).toBeNull();
	});

	test("returns null for an empty frame", () => {
		const point = readLandmark([], 0);

		expect(point).toBeNull();
	});
});

describe("mapLandmarkToCanvas", () => {
	test("maps one to one when the canvas has the video shape", () => {
		const point = mapLandmarkToCanvas({ x: 0.5, y: 0.25 }, videoSize, {
			width: 640,
			height: 360,
		});

		expect(point).toEqual({ x: 320, y: 90 });
	});

	test("crops the sides on a tall canvas", () => {
		const point = mapLandmarkToCanvas({ x: 0.5, y: 0.5 }, videoSize, {
			width: 360,
			height: 720,
		});

		expect(point).toEqual({ x: 180, y: 360 });
	});

	test("crops the top and bottom on a wide canvas", () => {
		const point = mapLandmarkToCanvas({ x: 0, y: 0.5 }, videoSize, {
			width: 1280,
			height: 360,
		});

		expect(point).toEqual({ x: 0, y: 180 });
	});

	test("shifts a landmark by the crop on a tall canvas", () => {
		const point = mapLandmarkToCanvas({ x: 0, y: 0 }, videoSize, {
			width: 360,
			height: 720,
		});

		expect(point.x).toBeCloseTo(-(1280 - 360) / 2, 5);
		expect(point.y).toBe(0);
	});
});

describe("measureJointArc", () => {
	test("measures a right angle", () => {
		const arc = measureJointArc(
			{ x: 0, y: -1 },
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
		);

		expect(arc.degrees).toBe(90);
		expect(arc.sweepRadians).toBeCloseTo(Math.PI / 2, 5);
	});

	test("measures a straight limb as 180 degrees", () => {
		const arc = measureJointArc(
			{ x: -1, y: 0 },
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
		);

		expect(arc.degrees).toBe(180);
	});

	test("sweeps the short way when the raw turn is over half a circle", () => {
		const arc = measureJointArc(
			{ x: 1, y: 0.1 },
			{ x: 0, y: 0 },
			{ x: 1, y: -0.1 },
		);

		expect(arc.degrees).toBeLessThan(20);
		expect(arc.sweepRadians).toBeLessThan(0);
	});

	test("sweeps forward the short way across the wrap point", () => {
		const arc = measureJointArc(
			{ x: 1, y: -0.1 },
			{ x: 0, y: 0 },
			{ x: 1, y: 0.1 },
		);

		expect(arc.degrees).toBeLessThan(20);
		expect(arc.sweepRadians).toBeGreaterThan(0);
	});

	test("reports the angle between a start and an end that need no wrap", () => {
		const arc = measureJointArc(
			{ x: 1, y: 0 },
			{ x: 0, y: 0 },
			{ x: 0, y: -1 },
		);

		expect(arc.degrees).toBe(90);
		expect(arc.sweepRadians).toBeLessThan(0);
	});
});

describe("pickDrawInProgress", () => {
	test("starts with nothing drawn", () => {
		const progress = pickDrawInProgress(0);

		expect(progress).toEqual({ bones: 0, joints: 0, arc: 0 });
	});

	test("draws half the bones at 600 milliseconds", () => {
		const progress = pickDrawInProgress(600);

		expect(progress).toEqual({ bones: 0.5, joints: 0, arc: 0 });
	});

	test("pops the joints after the bones", () => {
		const progress = pickDrawInProgress(1350);

		expect(progress.bones).toBe(1);
		expect(progress.joints).toBe(0.5);
		expect(progress.arc).toBe(0);
	});

	test("finishes everything after the choreography", () => {
		const progress = pickDrawInProgress(5000);

		expect(progress).toEqual({ bones: 1, joints: 1, arc: 1 });
	});
});

describe("isPointInsideFrame", () => {
	const frameSize = { width: 400, height: 300 };

	test("accepts a point inside", () => {
		expect(isPointInsideFrame({ x: 10, y: 10 }, frameSize)).toBe(true);
	});

	test("rejects a point past the right edge", () => {
		expect(isPointInsideFrame({ x: 401, y: 10 }, frameSize)).toBe(false);
	});

	test("rejects a point above the top edge", () => {
		expect(isPointInsideFrame({ x: 10, y: -1 }, frameSize)).toBe(false);
	});
});

describe("placeReadoutLabel", () => {
	const frameSize = { width: 800, height: 600 };
	const labelSize = { width: 150, height: 26 };

	test("puts the label to the right of a joint on the right half", () => {
		const placement = placeReadoutLabel(
			{ x: 500, y: 300 },
			frameSize,
			labelSize,
		);

		expect(placement.labelLeft).toBe(556);
		expect(placement.leaderEnd.x).toBe(556);
	});

	test("puts the label to the left of a joint on the left half", () => {
		const placement = placeReadoutLabel(
			{ x: 300, y: 300 },
			frameSize,
			labelSize,
		);

		expect(placement.labelLeft).toBe(94);
		expect(placement.leaderEnd.x).toBe(244);
	});

	test("keeps the label inside the right edge", () => {
		const placement = placeReadoutLabel(
			{ x: 790, y: 300 },
			frameSize,
			labelSize,
		);

		expect(placement.labelLeft).toBe(642);
	});

	test("keeps the label inside the top and left edges", () => {
		const placement = placeReadoutLabel({ x: 10, y: 5 }, frameSize, labelSize);

		expect(placement.labelLeft).toBe(8);
		expect(placement.labelTop).toBe(8);
	});

	test("keeps the label inside the bottom edge", () => {
		const placement = placeReadoutLabel(
			{ x: 600, y: 700 },
			frameSize,
			labelSize,
		);

		expect(placement.labelTop).toBe(566);
	});
});
