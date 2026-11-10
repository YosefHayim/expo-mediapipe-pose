import { strict as assert } from "node:assert";
import { describe, test } from "vitest";
import {
	evaluatePoseRule,
	getImageDistance,
	getImageJointAngle,
	getWorldDistance,
	getWorldJointAngle,
	LANDMARK_NAMES,
	type Landmark,
	type PoseMeasurement,
} from "../core";
import { createPoseFrame } from "../testing/fixtures";

const readMeasuredNumber = (measurement: PoseMeasurement) => {
	assert.equal(measurement.status, "available");
	return measurement.value;
};
const readGeometry = () => {
	const landmarks = createPoseFrame().landmarks;
	landmarks[11] = { x: 0, y: 1, z: 0, visibility: 0.9 };
	landmarks[13] = { x: 0, y: 0, z: 0, visibility: 0.9 };
	landmarks[15] = { x: 1, y: 1, z: 0, visibility: 0.9 };
	return { landmarks, imageSize: { width: 200, height: 100 } };
};
const elbow = ["leftShoulder", "leftElbow", "leftWrist"] as const;

describe("getImageJointAngle", () => {
	test("uses image aspect ratio, pixel units and anatomical names without mutating input", () => {
		const details = readGeometry();
		const before = structuredClone(details);

		assert.ok(
			Math.abs(
				readMeasuredNumber(getImageJointAngle(details, ...elbow)) -
					63.43494882292201,
			) < 1e-10,
		);
		assert.equal(
			readMeasuredNumber(
				getImageJointAngle(
					{ ...details, imageSize: { width: 100, height: 100 } },
					...elbow,
				),
			),
			45,
		);
		assert.deepEqual(getImageDistance(details, "leftShoulder", "leftWrist"), {
			status: "available",
			value: 200,
			unit: "pixels",
		});

		const mirrored = {
			...details,
			landmarks: details.landmarks.map((joint) => ({
				...joint,
				x: 1 - joint.x,
			})),
		};
		assert.equal(
			readMeasuredNumber(getImageJointAngle(mirrored, ...elbow)),
			readMeasuredNumber(getImageJointAngle(details, ...elbow)),
		);
		assert.deepEqual(details, before);
	});

	test("keeps missing confidence, low presence and invalid coordinates unavailable", () => {
		for (const confidence of [
			{},
			{ visibility: 0.5 },
			{ visibility: NaN },
			{ visibility: 1.1 },
			{ visibility: 0.9, presence: 0.2 },
		]) {
			const geometry = readGeometry();
			geometry.landmarks[15] = { x: 1, y: 1, z: 0, ...confidence };

			assert.deepEqual(getImageJointAngle(geometry, ...elbow), {
				status: "unavailable",
				reason: "uncertain-landmark",
			});
		}

		const geometry = readGeometry();
		geometry.landmarks[15] = { x: NaN, y: 1, z: 0, visibility: 1 };
		assert.deepEqual(getImageJointAngle(geometry, ...elbow), {
			status: "unavailable",
			reason: "invalid-coordinates",
		});

		assert.deepEqual(
			getImageJointAngle({ ...geometry, landmarks: [] }, ...elbow),
			{
				status: "unavailable",
				reason: "missing-landmark",
			},
		);

		geometry.landmarks[15] = { x: 1, y: 1, z: 0, visibility: 0.3 };
		assert.equal(
			getImageJointAngle(geometry, ...elbow, { minVisibility: 0.3 }).status,
			"available",
		);
	});

	test("handles straight, folded and degenerate limbs without fabricating an angle", () => {
		const geometry = readGeometry();

		geometry.landmarks[15] = { x: 0, y: -1, z: 0, visibility: 1 };
		assert.equal(
			readMeasuredNumber(getImageJointAngle(geometry, ...elbow)),
			180,
		);
		geometry.landmarks[15] = { x: 0, y: 1, z: 0, visibility: 1 };
		assert.equal(readMeasuredNumber(getImageJointAngle(geometry, ...elbow)), 0);

		geometry.landmarks[15] = { x: 0, y: 0, z: 0, visibility: 1 };
		assert.deepEqual(getImageJointAngle(geometry, ...elbow), {
			status: "unavailable",
			reason: "degenerate-angle",
		});
		assert.equal(
			readMeasuredNumber(getImageDistance(geometry, "leftElbow", "leftWrist")),
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

	test("rejects invalid dimensions and confidence options", () => {
		for (const width of [0, -1, NaN, Infinity]) {
			assert.throws(
				() =>
					getImageJointAngle(
						{ ...readGeometry(), imageSize: { width, height: 100 } },
						...elbow,
					),
				RangeError,
			);
		}

		for (const minVisibility of [-1, 2, NaN, Infinity]) {
			assert.throws(
				() =>
					getWorldJointAngle({ worldLandmarks: [] }, ...elbow, {
						minVisibility,
					}),
				RangeError,
			);
		}
	});
});

describe("getWorldJointAngle", () => {
	test("uses all world axes and reports model distances in meters", () => {
		const worldLandmarks = readGeometry().landmarks;
		worldLandmarks[11] = { x: 0, y: 0, z: 1, visibility: 0.9 };
		worldLandmarks[15] = { x: 3, y: 4, z: 0, visibility: 0.9 };

		assert.equal(
			readMeasuredNumber(getWorldJointAngle({ worldLandmarks }, ...elbow)),
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
});

describe("evaluatePoseRule", () => {
	test("feeds geometry into rules while retaining explicit unknown measurements", () => {
		const frame = { ...createPoseFrame(), landmarks: readGeometry().landmarks };
		const settings = {
			landmarks: elbow,
			evaluate: (
				_pose: unknown,
				current: typeof frame,
			): boolean | "unknown" => {
				assert.equal(current, frame);
				const angle = getImageJointAngle(
					{ landmarks: current.landmarks, imageSize: current.additionalData },
					...elbow,
				);

				const isAngleStatusUnavailable = angle.status === "unavailable";
				if (isAngleStatusUnavailable) return "unknown";

				return angle.value < 90;
			},
		};

		assert.equal(evaluatePoseRule(frame, settings), "pass");
		frame.landmarks[15] = { x: 0, y: -1, z: 0, visibility: 1 };
		assert.equal(evaluatePoseRule(frame, settings), "fail");
		frame.landmarks[15] = { x: 0, y: 0, z: 0, visibility: 1 };
		assert.equal(evaluatePoseRule(frame, settings), "unknown");
	});

	test("shares confidence policy between standalone measurements and rules", () => {
		for (const confidence of [
			{},
			{ visibility: 1.1 },
			{ visibility: 0.9, presence: 1.1 },
			{ visibility: 0.9, presence: NaN },
			{ visibility: 0.4 },
		]) {
			const frame = {
				...createPoseFrame(),
				landmarks: readGeometry().landmarks,
			};
			frame.landmarks[15] = { x: 1, y: 1, z: 0, ...confidence };

			assert.equal(
				evaluatePoseRule(frame, {
					landmarks: ["leftWrist"],
					evaluate: () => true,
				}),
				"unknown",
			);
			assert.equal(
				getImageDistance(
					{ landmarks: frame.landmarks, imageSize: frame.additionalData },
					"leftElbow",
					"leftWrist",
				).status,
				"unavailable",
			);
		}
	});
});
