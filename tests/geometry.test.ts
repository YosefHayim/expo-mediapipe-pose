import { strict as assert } from "node:assert";
import { it } from "node:test";
import {
	evaluatePoseRule,
	getImageDistance,
	getImageJointAngle,
	getWorldDistance,
	getWorldJointAngle,
	LANDMARK_NAMES,
	type Landmark,
	type PoseMeasurement,
} from "../src/core";
import { poseFrame } from "./fixtures";

const measurementValue = (measurement: PoseMeasurement) => {
	assert.equal(measurement.status, "available");
	return measurement.value;
};
const geometry = () => {
	const landmarks = poseFrame().landmarks;
	landmarks[11] = { x: 0, y: 1, z: 0, visibility: 0.9 };
	landmarks[13] = { x: 0, y: 0, z: 0, visibility: 0.9 };
	landmarks[15] = { x: 1, y: 1, z: 0, visibility: 0.9 };
	return { landmarks, imageSize: { width: 200, height: 100 } };
};
const elbow = ["leftShoulder", "leftElbow", "leftWrist"] as const;

it("uses image aspect ratio, pixel units and anatomical names without mutating input", () => {
	const input = geometry();
	const before = structuredClone(input);
	assert.ok(
		Math.abs(
			measurementValue(getImageJointAngle(input, ...elbow)) - 63.43494882292201,
		) < 1e-10,
	);
	assert.equal(
		measurementValue(
			getImageJointAngle(
				{ ...input, imageSize: { width: 100, height: 100 } },
				...elbow,
			),
		),
		45,
	);
	assert.deepEqual(getImageDistance(input, "leftShoulder", "leftWrist"), {
		status: "available",
		value: 200,
		unit: "pixels",
	});
	const mirrored = {
		...input,
		landmarks: input.landmarks.map((joint) => ({ ...joint, x: 1 - joint.x })),
	};
	assert.equal(
		measurementValue(getImageJointAngle(mirrored, ...elbow)),
		measurementValue(getImageJointAngle(input, ...elbow)),
	);
	assert.deepEqual(input, before);
});

it("uses all world axes and reports model distances in meters", () => {
	const worldLandmarks = geometry().landmarks;
	worldLandmarks[11] = { x: 0, y: 0, z: 1, visibility: 0.9 };
	worldLandmarks[15] = { x: 3, y: 4, z: 0, visibility: 0.9 };
	assert.equal(
		measurementValue(getWorldJointAngle({ worldLandmarks }, ...elbow)),
		90,
	);
	worldLandmarks[15] = { x: 3, y: 4, z: 12, visibility: 0.9 };
	assert.deepEqual(
		getWorldDistance({ worldLandmarks }, "leftElbow", "leftWrist"),
		{ status: "available", value: 13, unit: "meters" },
	);
	assert.deepEqual(
		getWorldDistance({ worldLandmarks: [] }, "leftElbow", "leftWrist"),
		{ status: "unavailable", reason: "missing-landmark" },
	);
});

it("keeps missing confidence, low presence and invalid coordinates unavailable", () => {
	for (const confidence of [
		{},
		{ visibility: 0.5 },
		{ visibility: NaN },
		{ visibility: 1.1 },
		{ visibility: 0.9, presence: 0.2 },
	]) {
		const input = geometry();
		input.landmarks[15] = { x: 1, y: 1, z: 0, ...confidence };
		assert.deepEqual(getImageJointAngle(input, ...elbow), {
			status: "unavailable",
			reason: "uncertain-landmark",
		});
	}
	const input = geometry();
	input.landmarks[15] = { x: NaN, y: 1, z: 0, visibility: 1 };
	assert.deepEqual(getImageJointAngle(input, ...elbow), {
		status: "unavailable",
		reason: "invalid-coordinates",
	});
	assert.deepEqual(getImageJointAngle({ ...input, landmarks: [] }, ...elbow), {
		status: "unavailable",
		reason: "missing-landmark",
	});
	input.landmarks[15] = { x: 1, y: 1, z: 0, visibility: 0.3 };
	assert.equal(
		getImageJointAngle(input, ...elbow, { minVisibility: 0.3 }).status,
		"available",
	);
});

it("handles straight, folded and degenerate limbs without fabricating an angle", () => {
	const input = geometry();
	input.landmarks[15] = { x: 0, y: -1, z: 0, visibility: 1 };
	assert.equal(measurementValue(getImageJointAngle(input, ...elbow)), 180);
	input.landmarks[15] = { x: 0, y: 1, z: 0, visibility: 1 };
	assert.equal(measurementValue(getImageJointAngle(input, ...elbow)), 0);
	input.landmarks[15] = { x: 0, y: 0, z: 0, visibility: 1 };
	assert.deepEqual(getImageJointAngle(input, ...elbow), {
		status: "unavailable",
		reason: "degenerate-angle",
	});
	assert.equal(
		measurementValue(getImageDistance(input, "leftElbow", "leftWrist")),
		0,
	);
	const worldLandmarks: Landmark[] = LANDMARK_NAMES.map(() => ({
		x: Number.MAX_VALUE,
		y: 0,
		z: 0,
		visibility: 1,
	}));
	worldLandmarks[15] = { x: -Number.MAX_VALUE, y: 0, z: 0, visibility: 1 };
	assert.equal(
		getWorldDistance({ worldLandmarks }, "leftElbow", "leftWrist").status,
		"unavailable",
	);
});

it("rejects invalid dimensions and confidence options", () => {
	for (const width of [0, -1, NaN, Infinity]) {
		assert.throws(
			() =>
				getImageJointAngle(
					{ ...geometry(), imageSize: { width, height: 100 } },
					...elbow,
				),
			RangeError,
		);
	}
	for (const minVisibility of [-1, 2, NaN, Infinity]) {
		assert.throws(
			() =>
				getWorldJointAngle({ worldLandmarks: [] }, ...elbow, { minVisibility }),
			RangeError,
		);
	}
});

it("feeds geometry into rules while retaining explicit unknown measurements", () => {
	const frame = { ...poseFrame(), landmarks: geometry().landmarks };
	const options = {
		landmarks: elbow,
		evaluate: (_pose: unknown, current: typeof frame): boolean | "unknown" => {
			assert.equal(current, frame);
			const angle = getImageJointAngle(
				{ landmarks: current.landmarks, imageSize: current.additionalData },
				...elbow,
			);
			if (angle.status === "unavailable") return "unknown";
			return angle.value < 90;
		},
	};
	assert.equal(evaluatePoseRule(frame, options), "pass");
	frame.landmarks[15] = { x: 0, y: -1, z: 0, visibility: 1 };
	assert.equal(evaluatePoseRule(frame, options), "fail");
	frame.landmarks[15] = { x: 0, y: 0, z: 0, visibility: 1 };
	assert.equal(evaluatePoseRule(frame, options), "unknown");
});
