import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createPoseRecorder,
	parsePoseRecording,
	serializePoseRecording,
} from "../src/core";
import { poseFrame } from "./fixtures";

test("recording is opt-in, bounded, and copies camera results", () => {
	const recorder = createPoseRecorder({ maxFrames: 2 });
	const frame = poseFrame();
	assert.equal(recorder.append(frame, 100), false);
	recorder.start();
	assert.equal(recorder.append(frame, 100), true);
	const nose = frame.landmarks[0];
	assert.ok(nose);
	nose.x = 0.1;
	recorder.append(frame, 150);
	assert.equal(recorder.status, "full");
	assert.equal(recorder.append(frame, 200), false);
	const session = recorder.stop();
	assert.deepEqual(
		session.frames.map((entry) => entry.timestampMs),
		[0, 50],
	);
	assert.equal(session.frames[0]?.frame.landmarks[0]?.x, 0.5);
	const recordedNose = session.frames[0]?.frame.landmarks[0];
	assert.ok(recordedNose);
	recordedNose.x = 0.9;
	assert.equal(recorder.stop().frames[0]?.frame.landmarks[0]?.x, 0.5);
	assert.deepEqual(
		parsePoseRecording(serializePoseRecording(session)),
		session,
	);
	recorder.start();
	assert.equal(recorder.frameCount, 0);
	recorder.append(frame, 500);
	assert.equal(recorder.stop().frames[0]?.timestampMs, 0);
	assert.equal(recorder.status, "stopped");
});
test("recording rejects invalid chronology, excess fields, invalid landmarks and unsupported versions", () => {
	const recorder = createPoseRecorder();
	recorder.start();
	recorder.append(poseFrame(), 100);
	for (const now of [100, 99, NaN, Infinity, 86_400_101])
		assert.throws(() => recorder.append(poseFrame(), now));
	assert.equal(recorder.frameCount, 1);
	const session = recorder.stop();
	for (const invalid of [
		{ ...session, version: 2 },
		{ ...session, images: ["private.jpg"] },
		{ ...session, frames: [{ ...session.frames[0], timestampMs: 1 }] },
		{ ...session, frames: [...session.frames, ...session.frames] },
		{
			...session,
			frames: [
				{
					timestampMs: 0,
					frame: {
						...poseFrame(),
						landmarks: Array(34).fill(poseFrame().landmarks[0]),
					},
				},
			],
		},
	])
		assert.throws(() => parsePoseRecording(JSON.stringify(invalid)));
	assert.equal(recorder.append(poseFrame(), 0), false);
	for (const maxFrames of [0, 10001, 1.5, NaN])
		assert.throws(() => createPoseRecorder({ maxFrames }));
});
