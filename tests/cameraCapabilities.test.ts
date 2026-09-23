import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import { CameraCapabilities, findCameraCapability } from "../src/core";

const decode = Schema.decodeUnknownSync(CameraCapabilities);
test("discovery retains format relationships and only resolves selectable lenses", () => {
	const capabilities = decode({
		status: "available",
		platform: "ios",
		cameras: [
			{
				facing: "back",
				lens: "ultraWide",
				zoomRange: { min: 1, max: 2 },
				modes: [{ previewFps: 30, resolution: { width: 640, height: 480 } }],
			},
			{
				facing: "back",
				lens: "wide",
				zoomRange: { min: 1, max: 5 },
				modes: [
					{ previewFps: 30, resolution: { width: 1280, height: 720 } },
					{ previewFps: 60, resolution: { width: 1920, height: 1080 } },
				],
			},
		],
	});
	assert.deepEqual(
		findCameraCapability(capabilities, "back", "auto")?.modes.find(
			(mode) => mode.previewFps === 60,
		),
		{ previewFps: 60, resolution: { width: 1920, height: 1080 } },
	);
	assert.equal(findCameraCapability(capabilities, "front"), undefined);
	assert.equal(
		findCameraCapability(capabilities, "back", "ultraWide")?.zoomRange?.max,
		2,
	);
	assert.equal(
		findCameraCapability(decode({ status: "permissionRequired" }), "back"),
		undefined,
	);
	assert.equal(
		findCameraCapability(decode({ status: "unavailable" }), "back"),
		undefined,
	);
});
test("Android unknown resolution and zoom remain explicit; invalid native data fails", () => {
	const camera = {
		facing: "front",
		lens: "wide",
		zoomRange: null,
		modes: [{ previewFps: 30, resolution: null }],
	};
	const data = { status: "available", platform: "android", cameras: [camera] };
	assert.equal(
		findCameraCapability(decode(data), "front")?.modes[0].resolution,
		null,
	);
	assert.equal(findCameraCapability(decode(data), "front")?.zoomRange, null);
	for (const invalidCamera of [
		{ ...camera, zoomRange: { min: 4, max: 2 } },
		{ ...camera, modes: [] },
		{ ...camera, modes: [{ previewFps: 120, resolution: null }] },
		{
			...camera,
			modes: [{ previewFps: 30, resolution: { width: 0, height: 720 } }],
		},
	])
		assert.throws(() => decode({ ...data, cameras: [invalidCamera] }));
});
