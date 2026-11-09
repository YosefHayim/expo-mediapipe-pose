import { strict as assert } from "node:assert";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { it, vi } from "vitest";
import type { PoseRuleOptions, PoseRuleStatus } from "../core";
import { poseFrame } from "../testing/fixtures";
import { usePoseRule } from "./use-pose-rule";

type RuleHarnessProps = PoseRuleOptions<"leftWrist"> & {
	onRule: (rule: ReturnType<typeof usePoseRule>) => void;
};

const RuleHarness = ({ onRule, ...options }: RuleHarnessProps) => {
	onRule(usePoseRule(options));
	return null;
};

it("emits transitions once, uses current callbacks, expires stale feedback and resets on pause", async () => {
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
	const transitions: PoseRuleStatus[] = [];
	const updatedTransitions: PoseRuleStatus[] = [];
	let activeRule: ReturnType<typeof usePoseRule> | undefined;
	const getRule = () => {
		assert.ok(activeRule);
		return activeRule;
	};
	const captureRule = (captured: ReturnType<typeof usePoseRule>) => {
		activeRule = captured;
	};
	const options: PoseRuleOptions<"leftWrist"> = {
		landmarks: ["leftWrist"],
		evaluate: () => true,
		holdMs: 100,
		staleAfterMs: 500,
		onChange: (status) => transitions.push(status),
	};
	let frameNumber = 0;
	const advanceTime = async (elapsed: number) => {
		now += elapsed;
		await act(() => vi.advanceTimersByTime(elapsed));
	};
	const sendFrame = async (elapsed: number) => {
		await advanceTime(elapsed);
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
		await act(() =>
			root.render(
				createElement(RuleHarness, { onRule: captureRule, ...options }),
			),
		);
		await sendFrame(0);
		await sendFrame(100);
		await sendFrame(20);
		assert.equal(getRule().status, "pass");
		assert.deepEqual(transitions, ["pass"]);

		await act(() =>
			root.render(
				createElement(RuleHarness, {
					onRule: captureRule,
					...options,
					onChange: (status) => updatedTransitions.push(status),
				}),
			),
		);
		await advanceTime(500);
		assert.equal(getRule().status, "unknown");
		assert.deepEqual(updatedTransitions, ["unknown"]);

		await sendFrame(0);
		assert.equal(getRule().status, "unknown");
		await sendFrame(100);
		assert.equal(getRule().status, "pass");
		await act(() =>
			root.render(
				createElement(RuleHarness, {
					onRule: captureRule,
					...options,
					isActive: false,
				}),
			),
		);
		assert.equal(getRule().status, "unknown");
		await sendFrame(100);
		assert.equal(getRule().status, "unknown");
	} finally {
		await act(() => root.unmount());
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
