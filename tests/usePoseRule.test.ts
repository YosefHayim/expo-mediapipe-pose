import { strict as assert } from "node:assert";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { PoseRuleOptions, PoseRuleStatus } from "../src/core";
import { usePoseRule } from "../src/hooks/usePoseRule";
import { poseFrame } from "./fixtures";

it("emits transitions once, uses current callbacks, expires stale feedback and resets on pause", async (test) => {
	const dom = new JSDOM("<!doctype html><div id='root'></div>");
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
	const transitions: PoseRuleStatus[] = [];
	const updatedTransitions: PoseRuleStatus[] = [];
	let activeRule: ReturnType<typeof usePoseRule> | undefined;
	const getRule = () => {
		assert.ok(activeRule);
		return activeRule;
	};
	const Harness = (options: PoseRuleOptions<"leftWrist">) => {
		activeRule = usePoseRule(options);
		return null;
	};
	const options: PoseRuleOptions<"leftWrist"> = {
		landmarks: ["leftWrist"],
		evaluate: () => true,
		holdMs: 100,
		staleAfterMs: 500,
		onChange: (status) => transitions.push(status),
	};
	let frameNumber = 0;
	const sendFrame = async (elapsed: number) => {
		now += elapsed;
		frameNumber += 1;
		const frame = poseFrame();
		await act(() =>
			getRule().update({
				...frame,
				additionalData: { ...frame.additionalData, frameNumber },
			}),
		);
	};

	try {
		await act(() => root.render(createElement(Harness, options)));
		await sendFrame(0);
		await sendFrame(100);
		await sendFrame(20);
		assert.equal(getRule().status, "pass");
		assert.deepEqual(transitions, ["pass"]);

		await act(() =>
			root.render(
				createElement(Harness, {
					...options,
					onChange: (status) => updatedTransitions.push(status),
				}),
			),
		);
		now += 500;
		await act(() => test.mock.timers.tick(500));
		assert.equal(getRule().status, "unknown");
		assert.deepEqual(updatedTransitions, ["unknown"]);

		await sendFrame(0);
		assert.equal(getRule().status, "unknown");
		await sendFrame(100);
		assert.equal(getRule().status, "pass");
		await act(() =>
			root.render(createElement(Harness, { ...options, isActive: false })),
		);
		assert.equal(getRule().status, "unknown");
		await sendFrame(100);
		assert.equal(getRule().status, "unknown");
	} finally {
		await act(() => root.unmount());
		test.mock.timers.reset();
		dom.window.close();
	}
});
