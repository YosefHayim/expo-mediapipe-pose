import * as React from "react";
import type { PoseFrame } from "../contracts";
import type { LandmarkName } from "../pose/landmarks";
import {
	advancePoseRule,
	evaluatePoseRule,
	initialPoseRuleState,
	type PoseRuleOptions,
	type PoseRuleState,
	type PoseRuleStatus,
	validatePoseRuleOptions,
} from "../pose/poseRule";

interface RuleRuntime {
	identity: string;
	state: PoseRuleState;
	lastFrame: number;
	timer: ReturnType<typeof setTimeout> | undefined;
}
const ruleIdentity = (options: PoseRuleOptions) =>
	JSON.stringify({
		landmarks: options.landmarks,
		minVisibility: options.minVisibility,
		holdMs: options.holdMs,
		staleAfterMs: options.staleAfterMs,
		isActive: options.isActive,
		resetKey: options.resetKey,
	});

type RuleSelections = Record<string, readonly LandmarkName[]>;
type NamedPoseRules<Selection extends RuleSelections> = {
	readonly [Id in keyof Selection]: PoseRuleOptions<Selection[Id][number]> & {
		landmarks: Selection[Id];
	};
};
export const usePoseRules = <const Selection extends RuleSelections>(
	rules: NamedPoseRules<Selection>,
) => {
	type Id = Extract<keyof Selection, string>;
	for (const options of Object.values<PoseRuleOptions>(rules))
		validatePoseRuleOptions(options);
	const latest = React.useRef<Readonly<Record<string, PoseRuleOptions>>>(rules);
	const runtimes = React.useRef(new Map<string, RuleRuntime>());
	const revision = React.useRef(0);
	const [statuses, setStatuses] = React.useState<Record<Id, PoseRuleStatus>>(
		() =>
			Object.fromEntries(
				Object.keys(rules).map((id) => [id, "unknown"]),
			) as Record<Id, PoseRuleStatus>,
	);
	const commit = React.useCallback(
		(id: string, runtime: RuleRuntime, next: PoseRuleState) => {
			if (runtimes.current.get(id) !== runtime) return;
			const changed = runtime.state.status !== next.status;
			runtime.state = next;
			if (!changed) return;
			setStatuses((previous) => ({ ...previous, [id]: next.status }));
			latest.current[id]?.onChange?.(next.status);
		},
		[],
	);
	const resetRuntime = React.useCallback(
		(id: string, runtime: RuleRuntime) => {
			clearTimeout(runtime.timer);
			runtime.timer = undefined;
			runtime.lastFrame = 0;
			commit(id, runtime, initialPoseRuleState());
		},
		[commit],
	);
	const reset = React.useCallback(
		(id?: Id) => {
			revision.current += 1;
			if (id !== undefined) {
				const runtime = runtimes.current.get(id);
				if (runtime) resetRuntime(id, runtime);
				return;
			}
			for (const [key, runtime] of runtimes.current) resetRuntime(key, runtime);
		},
		[resetRuntime],
	);
	React.useLayoutEffect(() => {
		latest.current = rules;
		let configurationChanged = false;
		for (const [id, runtime] of runtimes.current) {
			if (Object.hasOwn(rules, id)) continue;
			clearTimeout(runtime.timer);
			runtimes.current.delete(id);
			configurationChanged = true;
		}
		for (const [id, options] of Object.entries<PoseRuleOptions>(rules)) {
			const identity = ruleIdentity(options);
			const runtime = runtimes.current.get(id);
			if (!runtime) {
				runtimes.current.set(id, {
					identity,
					state: initialPoseRuleState(),
					lastFrame: 0,
					timer: undefined,
				});
				configurationChanged = true;
				continue;
			}
			if (runtime.identity === identity) continue;
			runtime.identity = identity;
			resetRuntime(id, runtime);
			configurationChanged = true;
		}
		if (configurationChanged)
			setStatuses(
				Object.fromEntries(
					[...runtimes.current].map(([id, runtime]) => [
						id,
						runtime.state.status,
					]),
				) as Record<Id, PoseRuleStatus>,
			);
	});
	React.useLayoutEffect(
		() => () => {
			for (const runtime of runtimes.current.values())
				clearTimeout(runtime.timer);
		},
		[],
	);
	const update = React.useCallback(
		(frame: PoseFrame) => {
			const now = performance.now();
			const updateRevision = revision.current;
			for (const [id, runtime] of runtimes.current) {
				if (revision.current !== updateRevision) break;
				const options = latest.current[id];
				if (!options) continue;
				if (options.isActive === false) {
					resetRuntime(id, runtime);
					continue;
				}
				const staleAfterMs = options.staleAfterMs ?? 500;
				const restarted = frame.additionalData.frameNumber <= runtime.lastFrame;
				const expired = now - runtime.state.updatedAt >= staleAfterMs;
				if (restarted || expired) resetRuntime(id, runtime);
				if (revision.current !== updateRevision) break;
				runtime.lastFrame = frame.additionalData.frameNumber;
				const outcome = evaluatePoseRule(
					frame,
					options,
					runtime.state.candidate,
				);
				const next = advancePoseRule(
					runtime.state,
					outcome,
					now,
					options.holdMs ?? 0,
				);
				clearTimeout(runtime.timer);
				runtime.timer = setTimeout(
					() => resetRuntime(id, runtime),
					staleAfterMs,
				);
				commit(id, runtime, next);
			}
		},
		[commit, resetRuntime],
	);
	const configuredStatuses = Object.fromEntries(
		Object.keys(rules).map((id) => {
			if (!Object.hasOwn(statuses, id)) return [id, "unknown"];
			return [id, statuses[id as Id]];
		}),
	) as Readonly<Record<Id, PoseRuleStatus>>;
	return { statuses: configuredStatuses, update, reset };
};
