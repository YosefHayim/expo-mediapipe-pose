import { strict as assert } from "node:assert";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { PoseTrackingOptions, PoseTrackingStatus } from "../src/core";
import { usePoseTracking } from "../src/hooks/usePoseTracking";
import { poseFrame } from "./fixtures";

it("stabilizes tracking, emits transitions once, expires stale input and resets on pause", async (test) => {
	const dom = new JSDOM("<!doctype html><div id='root'></div>");
	const globalNames = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"];
	const originalGlobals = globalNames.map((name) => ({
		name,
		descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
	}));
	Object.defineProperty(globalThis, "window", {
		value: dom.window,
		configurable: true,
	});
	Object.defineProperty(globalThis, "document", {
		value: dom.window.document,
		configurable: true,
	});
	Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
		value: true,
		configurable: true,
	});
	const container = dom.window.document.getElementById("root");
	assert.ok(container);
	const root = createRoot(container);
	let now = 1000;
	test.mock.method(performance, "now", () => now);
	test.mock.timers.enable({ apis: ["setTimeout"] });
	let tracking: ReturnType<typeof usePoseTracking> | undefined;
	const currentTracking = () => {
		assert.ok(tracking);
		return tracking;
	};
	const transitions: PoseTrackingStatus[] = [];
	const latestTransitions: PoseTrackingStatus[] = [];
	const options: PoseTrackingOptions = {
		landmarks: ["leftWrist"],
		holdMs: 100,
		staleAfterMs: 500,
		onChange: (state) => transitions.push(state.status),
	};
	const Harness = (settings: PoseTrackingOptions) => {
		tracking = usePoseTracking(settings);
		return null;
	};
	let frameNumber = 0;
	const send = async (elapsed: number, visible = true) => {
		now += elapsed;
		frameNumber += 1;
		const frame = poseFrame();
		await act(() =>
			currentTracking().update({
				...frame,
				landmarks: visible ? frame.landmarks : [],
				additionalData: { ...frame.additionalData, frameNumber },
			}),
		);
	};
	try {
		await act(() => root.render(createElement(Harness, options)));
		assert.equal(currentTracking().status, "searching");
		await send(0);
		assert.equal(currentTracking().status, "acquiring");
		await send(100);
		await send(20);
		assert.deepEqual(transitions, ["acquiring", "found"]);
		await send(0, false);
		assert.equal(currentTracking().status, "lost");
		await send(0);
		assert.equal(currentTracking().status, "acquiring");
		await send(100);
		assert.equal(currentTracking().status, "found");
		await act(() =>
			root.render(
				createElement(Harness, {
					...options,
					onChange: (state) => latestTransitions.push(state.status),
				}),
			),
		);
		now += 500;
		await act(() => test.mock.timers.tick(500));
		assert.equal(currentTracking().status, "stale");
		assert.deepEqual(latestTransitions, ["stale"]);
		await send(0);
		assert.equal(currentTracking().status, "acquiring");
		await send(100);
		frameNumber = 0;
		await send(0);
		assert.equal(currentTracking().status, "acquiring");
		await act(() =>
			root.render(createElement(Harness, { ...options, isActive: false })),
		);
		await send(100);
		assert.equal(currentTracking().status, "inactive");
		await act(() => test.mock.timers.tick(1000));
		assert.equal(currentTracking().status, "inactive");
		await act(() => root.render(createElement(Harness, options)));
		assert.equal(currentTracking().status, "searching");
		await send(0);
		await act(() => currentTracking().reset());
		assert.equal(currentTracking().status, "searching");
		await send(0);
		await send(100);
		await act(() =>
			root.render(
				createElement(Harness, { ...options, landmarks: ["rightWrist"] }),
			),
		);
		assert.equal(currentTracking().status, "searching");
		await send(0);
		await send(100);
		assert.equal(currentTracking().status, "found");
		await act(() =>
			root.render(createElement(Harness, { ...options, minVisibility: 1 })),
		);
		await send(0);
		assert.equal(currentTracking().status, "incomplete");
		assert.deepEqual(currentTracking().uncertainLandmarks, ["leftWrist"]);
	} finally {
		const callbackCount = transitions.length + latestTransitions.length;
		await act(() => root.unmount());
		await act(() => test.mock.timers.tick(1000));
		assert.equal(transitions.length + latestTransitions.length, callbackCount);
		test.mock.timers.reset();
		dom.window.close();
		for (const { name, descriptor } of originalGlobals) {
			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
				continue;
			}
			Reflect.deleteProperty(globalThis, name);
		}
	}
});
