import { strict as assert } from "node:assert";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createThresholdRule, type PoseRuleOptions } from "../src/core";
import { usePoseRules } from "../src/hooks/usePoseRules";
import { poseFrame } from "./fixtures";

it("maintains independent named rules through changes, expiry, removal and reset", async (test) => {
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
	let result: ReturnType<typeof usePoseRules> | undefined;
	const current = () => {
		assert.ok(result);
		return result;
	};
	const transitions: string[] = [];
	const updatedTransitions: string[] = [];
	const wrist: PoseRuleOptions = {
		landmarks: ["leftWrist"],
		evaluate: () => true,
		holdMs: 100,
		staleAfterMs: 500,
		onChange: (status) => transitions.push(`wrist:${status}`),
	};
	const elbow: PoseRuleOptions = {
		landmarks: ["leftElbow"],
		evaluate: () => true,
		staleAfterMs: 1000,
		onChange: (status) => transitions.push(`elbow:${status}`),
	};
	const Harness = ({ rules }: { rules: Record<string, PoseRuleOptions> }) => {
		result = usePoseRules(rules);
		return null;
	};
	const render = async (rules: Record<string, PoseRuleOptions>) => {
		await act(() => root.render(createElement(Harness, { rules })));
	};
	let frameNumber = 0;
	const advanceTime = async (elapsed: number) => {
		now += elapsed;
		await act(() => test.mock.timers.tick(elapsed));
	};
	const send = async (elapsed = 0) => {
		await advanceTime(elapsed);
		frameNumber += 1;
		const frame = poseFrame();
		await act(() =>
			current().update({
				...frame,
				additionalData: { ...frame.additionalData, frameNumber },
			}),
		);
	};
	try {
		await render({ wrist, elbow });
		await send();
		assert.deepEqual(current().statuses, { wrist: "unknown", elbow: "pass" });
		await send(100);
		assert.deepEqual(transitions, ["elbow:pass", "wrist:pass"]);
		const latestWrist = {
			...wrist,
			onChange: (status: string) => updatedTransitions.push(status),
		};
		const failingElbow = { ...elbow, evaluate: () => false };
		await render({ wrist: latestWrist, elbow: failingElbow });
		await send(20);
		assert.deepEqual(current().statuses, { wrist: "pass", elbow: "fail" });
		const quick: PoseRuleOptions = {
			landmarks: ["rightWrist"],
			evaluate: () => true,
			staleAfterMs: 50,
		};
		await render({ wrist: latestWrist, elbow: failingElbow, quick });
		assert.equal(current().statuses.wrist, "pass");
		await send();
		await advanceTime(50);
		assert.deepEqual(current().statuses, {
			wrist: "pass",
			elbow: "fail",
			quick: "unknown",
		});
		await render({ wrist: { ...latestWrist, isActive: false }, quick });
		assert.equal(Object.hasOwn(current().statuses, "elbow"), false);
		assert.deepEqual(updatedTransitions, ["unknown"]);
		await send();
		assert.equal(current().statuses.wrist, "unknown");
		await render({ wrist: latestWrist, quick });
		await send();
		await send(100);
		assert.equal(current().statuses.wrist, "pass");
		await act(() => current().reset("wrist"));
		assert.equal(current().statuses.wrist, "unknown");
		assert.equal(current().statuses.quick, "pass");
		await send();
		await send(100);
		await advanceTime(500);
		assert.equal(current().statuses.wrist, "unknown");
		assert.equal(
			transitions.filter((value) => value === "elbow:unknown").length,
			0,
		);
		let measuredAngle = 80;
		const thresholdRule = (enterThreshold = 85, exitThreshold = 95) =>
			createThresholdRule({
				landmarks: ["leftElbow"],
				direction: "below",
				enterThreshold,
				exitThreshold,
				measure: () => measuredAngle,
			});
		await render({ elbow: thresholdRule() });
		await send();
		assert.equal(current().statuses.elbow, "pass");
		measuredAngle = 90;
		await render({ elbow: thresholdRule() });
		await send();
		assert.equal(current().statuses.elbow, "pass");
		await render({ elbow: thresholdRule(70, 75) });
		assert.equal(current().statuses.elbow, "unknown");
		await send();
		assert.equal(current().statuses.elbow, "fail");
		measuredAngle = 72;
		await send();
		assert.equal(current().statuses.elbow, "fail");
		measuredAngle = 69;
		await send();
		assert.equal(current().statuses.elbow, "pass");
		await render({});
		assert.deepEqual(current().statuses, {});
		let followingEvaluations = 0;
		await render({
			resetter: {
				...quick,
				onChange: (status) => {
					if (status === "pass") current().reset();
				},
			},
			following: {
				...quick,
				evaluate: () => {
					followingEvaluations += 1;
					return true;
				},
			},
		});
		await send();
		assert.deepEqual(current().statuses, {
			resetter: "unknown",
			following: "unknown",
		});
		assert.equal(followingEvaluations, 0);
		await advanceTime(1000);
		assert.deepEqual(current().statuses, {
			resetter: "unknown",
			following: "unknown",
		});
		await render({ wrist: latestWrist });
		await send();
		await send(100);
	} finally {
		const notifications = updatedTransitions.length;
		await act(() => root.unmount());
		await advanceTime(1000);
		assert.equal(updatedTransitions.length, notifications);
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
