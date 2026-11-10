import { strict as assert } from "node:assert";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, test, vi } from "vitest";
import type { PoseTrackingOptions, PoseTrackingStatus } from "../core";
import { createPoseFrame } from "../testing/fixtures";
import { usePoseTracking } from "./use-pose-tracking";

type TrackingHarnessProps = PoseTrackingOptions & {
	onTracking: (tracking: ReturnType<typeof usePoseTracking>) => void;
};

const TrackingHarness = ({ onTracking, ...settings }: TrackingHarnessProps) => {
	onTracking(usePoseTracking(settings));
	return null;
};

describe("usePoseTracking", () => {
	test("stabilizes tracking, emits transitions once, expires stale input and resets on pause", async () => {
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
		vi.spyOn(performance, "now").mockImplementation(() => now);
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		let tracking: ReturnType<typeof usePoseTracking> | null = null;
		const readCurrentTracking = () => {
			assert.ok(tracking);
			return tracking;
		};
		const transitions: PoseTrackingStatus[] = [];
		const latestTransitions: PoseTrackingStatus[] = [];
		const settings: PoseTrackingOptions = {
			landmarks: ["leftWrist"],
			holdMs: 100,
			staleAfterMs: 500,
			onChange: (snapshot) => transitions.push(snapshot.status),
		};
		const captureTracking = (captured: ReturnType<typeof usePoseTracking>) => {
			tracking = captured;
		};
		let frameNumber = 0;
		const advanceTime = async (elapsed: number) => {
			now += elapsed;
			await act(() => vi.advanceTimersByTime(elapsed));
		};
		const send = async (elapsed: number, visible = true) => {
			await advanceTime(elapsed);
			frameNumber += 1;
			const frame = createPoseFrame();
			await act(() =>
				readCurrentTracking().update({
					...frame,
					landmarks: visible ? frame.landmarks : [],
					additionalData: { ...frame.additionalData, frameNumber },
				}),
			);
		};
		try {
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
					}),
				),
			);
			assert.equal(readCurrentTracking().status, "searching");
			await send(0);
			assert.equal(readCurrentTracking().status, "acquiring");
			await send(100);
			await send(20);
			assert.deepEqual(transitions, ["acquiring", "found"]);
			await send(0, false);
			assert.equal(readCurrentTracking().status, "lost");
			await send(0);
			assert.equal(readCurrentTracking().status, "acquiring");
			await send(100);
			assert.equal(readCurrentTracking().status, "found");
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
						onChange: (snapshot) => latestTransitions.push(snapshot.status),
					}),
				),
			);
			await advanceTime(500);
			assert.equal(readCurrentTracking().status, "stale");
			assert.deepEqual(latestTransitions, ["stale"]);
			await send(0);
			assert.equal(readCurrentTracking().status, "acquiring");
			await send(100);
			frameNumber = 0;
			await send(0);
			assert.equal(readCurrentTracking().status, "acquiring");
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
						isActive: false,
					}),
				),
			);
			await send(100);
			assert.equal(readCurrentTracking().status, "inactive");
			await advanceTime(1000);
			assert.equal(readCurrentTracking().status, "inactive");
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
					}),
				),
			);
			assert.equal(readCurrentTracking().status, "searching");
			await send(0);
			await act(() => readCurrentTracking().reset());
			assert.equal(readCurrentTracking().status, "searching");
			await send(0);
			await send(100);
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
						landmarks: ["rightWrist"],
					}),
				),
			);
			assert.equal(readCurrentTracking().status, "searching");
			await send(0);
			await send(100);
			assert.equal(readCurrentTracking().status, "found");
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
						minVisibility: 1,
					}),
				),
			);
			await send(0);
			assert.equal(readCurrentTracking().status, "incomplete");
			assert.deepEqual(readCurrentTracking().uncertainLandmarks, ["leftWrist"]);
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
						holdMs: 0,
						onChange: (snapshot) => {
							const isStatusFound = snapshot.status === "found";
							if (isStatusFound) readCurrentTracking().reset();
						},
					}),
				),
			);
			await send(0);
			assert.equal(readCurrentTracking().status, "searching");
			await advanceTime(1000);
			assert.equal(readCurrentTracking().status, "searching");
			await act(() =>
				root.render(
					createElement(TrackingHarness, {
						onTracking: captureTracking,
						...settings,
					}),
				),
			);
			await send(0);
		} finally {
			const callbackCount = transitions.length + latestTransitions.length;
			await act(() => root.unmount());
			await advanceTime(1000);
			assert.equal(
				transitions.length + latestTransitions.length,
				callbackCount,
			);
			vi.useRealTimers();
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
});
