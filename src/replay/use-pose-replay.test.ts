import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { describe, test, vi } from "vitest";
import { createPoseRecorder, type PoseRecording } from "../core";
import { usePoseRule } from "../rules/use-pose-rule";
import { poseFrame } from "../testing/fixtures";
import { usePoseReplay } from "./use-pose-replay";

interface ReplayHarnessReports {
	setStatus: (status: string) => void;
	setReplay: (replay: ReturnType<typeof usePoseReplay>) => void;
	onDelivered: (label: string) => void;
	playCurrent: () => void;
}

interface ReplayHarnessProps {
	session: PoseRecording;
	label: string;
	reports: ReplayHarnessReports;
}

const ReplayHarness = ({ session, label, reports }: ReplayHarnessProps) => {
	const rule = usePoseRule({ landmarks: ["nose"], evaluate: () => true });
	reports.setStatus(rule.status);
	reports.setReplay(
		usePoseReplay(session, {
			onFrame: (frame) => {
				reports.onDelivered(label);
				rule.update(frame);
			},
			onReset: () => {
				if (label !== "reset failure") {
					rule.reset();
					return;
				}
				reports.playCurrent();
				throw new Error("reset failed");
			},
		}),
	);
	return null;
};

describe("usePoseReplay", () => {
	test("replay hook uses current callbacks, resets replaced sessions, and cancels on unmount", async () => {
		const dom = new JSDOM("<!doctype html><div id='root'></div>");
		const names = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"];
		const savedGlobals = names.map((name) => ({
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
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
		const recorder = createPoseRecorder();
		recorder.start();
		recorder.append(poseFrame(), 0);
		recorder.append(poseFrame(), 100);
		const recording = recorder.stop();
		let replay: ReturnType<typeof usePoseReplay> | undefined;
		let status: string = "unknown";
		const delivered: string[] = [];
		const current = () => {
			assert.ok(replay);
			return replay;
		};
		const reports: ReplayHarnessReports = {
			setStatus: (value) => {
				status = value;
			},
			setReplay: (value) => {
				replay = value;
			},
			onDelivered: (label) => {
				delivered.push(label);
			},
			playCurrent: () => {
				current().play();
			},
		};
		const render = async (session: PoseRecording, label: string) => {
			await act(() =>
				root.render(
					createElement(
						StrictMode,
						{},
						createElement(ReplayHarness, { session, label, reports }),
					),
				),
			);
		};

		try {
			await render(recording, "first");
			await act(() => {
				current().play();
				vi.advanceTimersByTime(0);
			});
			assert.deepEqual(delivered, ["first"]);
			assert.equal(status, "pass");

			await render(recording, "latest");
			now = 100;
			await act(() => vi.advanceTimersByTime(100));
			assert.deepEqual(delivered, ["first", "latest"]);

			await render({ version: 1, frames: [] }, "empty");
			assert.equal(current().status, "paused");
			assert.equal(status, "unknown");

			await act(() => current().play());
			assert.equal(current().status, "ended");

			await assert.rejects(render(recording, "reset failure"), /reset failed/);
			vi.advanceTimersByTime(500);
			assert.deepEqual(delivered, ["first", "latest"]);
			assert.throws(() => current().play(), /mounted/);

			await render(recording, "unmount");
			await act(() => current().play());
			await act(() => root.unmount());
			now = 1000;
			vi.advanceTimersByTime(1000);
			assert.deepEqual(delivered, ["first", "latest"]);
			assert.throws(() => current().play(), /mounted/);
		} finally {
			await act(() => root.unmount());
			dom.window.close();
			for (const { name, descriptor } of savedGlobals) {
				if (descriptor) Object.defineProperty(globalThis, name, descriptor);
				else Reflect.deleteProperty(globalThis, name);
			}
		}
	});
});
