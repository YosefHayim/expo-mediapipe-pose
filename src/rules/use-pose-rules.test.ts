import { strict as assert } from "node:assert";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, test, vi } from "vitest";
import { createThresholdRule, type PoseRuleOptions } from "../core";
import { createPoseFrame } from "../testing/fixtures";
import { usePoseRules } from "./use-pose-rules";

interface RulesHarnessProps {
	rules: Record<string, PoseRuleOptions>;
	onResult: (ruleSet: ReturnType<typeof usePoseRules>) => void;
}

const RulesHarness = ({ rules, onResult: onReport }: RulesHarnessProps) => {
	const ruleSet = usePoseRules(rules);
	onReport(ruleSet);
	assert.deepEqual(
		Object.keys(ruleSet.statuses).sort(),
		Object.keys(rules).sort(),
	);
	assert.ok(Object.values(ruleSet.statuses).every((status) => status != null));
	return null;
};

describe("usePoseRules", () => {
	test("maintains independent named rules through changes, expiry, removal and reset", async () => {
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
		let report: ReturnType<typeof usePoseRules> | null = null;
		const readCurrentRules = () => {
			assert.ok(report);
			return report;
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
		const captureReport = (captured: ReturnType<typeof usePoseRules>) => {
			report = captured;
		};
		const mountRules = async (rules: Record<string, PoseRuleOptions>) => {
			await act(() =>
				root.render(
					createElement(RulesHarness, { onResult: captureReport, rules }),
				),
			);
		};
		let frameNumber = 0;
		const advanceTime = async (elapsed: number) => {
			now += elapsed;
			await act(() => vi.advanceTimersByTime(elapsed));
		};
		const send = async (elapsed = 0) => {
			await advanceTime(elapsed);
			frameNumber += 1;
			const frame = createPoseFrame();
			await act(() =>
				readCurrentRules().update({
					...frame,
					additionalData: { ...frame.additionalData, frameNumber },
				}),
			);
		};
		try {
			await mountRules({ wrist, elbow });
			await send();
			assert.deepEqual(readCurrentRules().statuses, {
				wrist: "unknown",
				elbow: "pass",
			});
			await send(100);
			assert.deepEqual(transitions, ["elbow:pass", "wrist:pass"]);
			const latestWrist = {
				...wrist,
				onChange: (status: string) => updatedTransitions.push(status),
			};
			const failingElbow = { ...elbow, evaluate: () => false };
			await mountRules({ wrist: latestWrist, elbow: failingElbow });
			await send(20);
			assert.deepEqual(readCurrentRules().statuses, {
				wrist: "pass",
				elbow: "fail",
			});
			const quick: PoseRuleOptions = {
				landmarks: ["rightWrist"],
				evaluate: () => true,
				staleAfterMs: 50,
			};
			await mountRules({ wrist: latestWrist, elbow: failingElbow, quick });
			assert.equal(readCurrentRules().statuses.wrist, "pass");
			await send();
			await advanceTime(50);
			assert.deepEqual(readCurrentRules().statuses, {
				wrist: "pass",
				elbow: "fail",
				quick: "unknown",
			});
			await mountRules({ wrist: { ...latestWrist, isActive: false }, quick });
			assert.equal(Object.hasOwn(readCurrentRules().statuses, "elbow"), false);
			assert.deepEqual(updatedTransitions, ["unknown"]);
			await send();
			assert.equal(readCurrentRules().statuses.wrist, "unknown");
			await mountRules({ wrist: latestWrist, quick });
			await send();
			await send(100);
			assert.equal(readCurrentRules().statuses.wrist, "pass");
			await act(() => readCurrentRules().reset("wrist"));
			assert.equal(readCurrentRules().statuses.wrist, "unknown");
			assert.equal(readCurrentRules().statuses.quick, "pass");
			await send();
			await send(100);
			await advanceTime(500);
			assert.equal(readCurrentRules().statuses.wrist, "unknown");
			assert.equal(
				transitions.filter(
					(transitionName) => transitionName === "elbow:unknown",
				).length,
				0,
			);
			let measuredAngle = 80;
			const createElbowRule = (
				enterThreshold = 85,
				exitThreshold = 95,
				holdMs = 0,
			) =>
				createThresholdRule({
					landmarks: ["leftElbow"],
					direction: "below",
					enterThreshold,
					exitThreshold,
					holdMs,
					measure: () => measuredAngle,
				});
			await mountRules({ elbow: createElbowRule() });
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "pass");
			measuredAngle = 90;
			await mountRules({ elbow: createElbowRule() });
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "pass");
			await mountRules({ elbow: createElbowRule(70, 75) });
			assert.equal(readCurrentRules().statuses.elbow, "unknown");
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "fail");
			measuredAngle = 72;
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "fail");
			measuredAngle = 69;
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "pass");
			await mountRules({ elbow: createElbowRule(85, 95, 100) });
			measuredAngle = 80;
			await send();
			assert.equal(readCurrentRules().statuses.elbow, "unknown");
			measuredAngle = 90;
			await send(50);
			await send(50);
			assert.equal(readCurrentRules().statuses.elbow, "pass");
			measuredAngle = 95;
			await send();
			measuredAngle = 90;
			await send(50);
			await send(50);
			assert.equal(readCurrentRules().statuses.elbow, "fail");
			await mountRules({});
			assert.deepEqual(readCurrentRules().statuses, {});
			let followingEvaluations = 0;
			await mountRules({
				resetter: {
					...quick,
					onChange: (status) => {
						const isStatusPass = status === "pass";
						if (isStatusPass) readCurrentRules().reset();
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
			assert.deepEqual(readCurrentRules().statuses, {
				resetter: "unknown",
				following: "unknown",
			});
			assert.equal(followingEvaluations, 0);
			await advanceTime(1000);
			assert.deepEqual(readCurrentRules().statuses, {
				resetter: "unknown",
				following: "unknown",
			});
			await mountRules({ wrist: latestWrist });
			await send();
			await send(100);
		} finally {
			const notifications = updatedTransitions.length;
			await act(() => root.unmount());
			await act(() => readCurrentRules().update(createPoseFrame()));
			await advanceTime(1000);
			assert.equal(updatedTransitions.length, notifications);
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
