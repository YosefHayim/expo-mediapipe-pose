import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPoseRecorder, type PoseRecording } from "../src/core";
import { usePoseReplay } from "../src/replay/use-pose-replay";
import { usePoseRule } from "../src/rules/use-pose-rule";
import { poseFrame } from "./fixtures";

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

test("replay hook uses current callbacks, resets replaced sessions, and cancels on unmount", async (context) => {
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
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	context.mock.method(performance, "now", () => now);
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
			context.mock.timers.tick(0);
		});
		assert.deepEqual(delivered, ["first"]);
		assert.equal(status, "pass");
		await render(recording, "latest");
		now = 100;
		await act(() => context.mock.timers.tick(100));
		assert.deepEqual(delivered, ["first", "latest"]);
		await render({ version: 1, frames: [] }, "empty");
		assert.equal(current().status, "paused");
		assert.equal(status, "unknown");
		await act(() => current().play());
		assert.equal(current().status, "ended");
		await assert.rejects(render(recording, "reset failure"), /reset failed/);
		context.mock.timers.tick(500);
		assert.deepEqual(delivered, ["first", "latest"]);
		assert.throws(() => current().play(), /mounted/);
		await render(recording, "unmount");
		await act(() => current().play());
		await act(() => root.unmount());
		now = 1000;
		context.mock.timers.tick(1000);
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
