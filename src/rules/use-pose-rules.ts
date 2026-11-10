import * as React from "react";
import type { PoseFrame } from "../contracts";
import type { LandmarkName } from "../landmarks/names";
import {
	advancePoseRule,
	evaluatePoseRule,
	initialPoseRuleState,
	type PoseRuleOptions,
	type PoseRuleState,
	type PoseRuleStatus,
	validatePoseRuleOptions,
} from "./rule";

interface RuleRuntime {
	identity: string;
	state: PoseRuleState;
	lastFrame: number;
	timer: ReturnType<typeof setTimeout> | undefined;
}
const readRuleIdentity = (settings: PoseRuleOptions) =>
	JSON.stringify({
		landmarks: settings.landmarks,
		minVisibility: settings.minVisibility,
		holdMs: settings.holdMs,
		staleAfterMs: settings.staleAfterMs,
		isActive: settings.isActive,
		resetKey: settings.resetKey,
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
	const configurations = React.useMemo(
		() =>
			Object.entries<PoseRuleOptions>(rules).map(([id, settings]) => {
				validatePoseRuleOptions(settings);
				return { id, identity: readRuleIdentity(settings) };
			}),
		[rules],
	);
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
			const isRuntimeReplaced = runtimes.current.get(id) !== runtime;
			if (isRuntimeReplaced) return;

			const changed = runtime.state.status !== next.status;
			runtime.state = next;

			const isUnchanged = !changed;
			if (isUnchanged) return;

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

			const hasId = id !== undefined;
			if (hasId) {
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
			const hasRuleForId = Object.hasOwn(rules, id);
			if (hasRuleForId) continue;

			clearTimeout(runtime.timer);
			runtimes.current.delete(id);
			configurationChanged = true;
		}
		for (const { id, identity } of configurations) {
			const runtime = runtimes.current.get(id);

			const isRuntimeMissing = runtime == null;
			if (isRuntimeMissing) {
				runtimes.current.set(id, {
					identity,
					state: initialPoseRuleState(),
					lastFrame: 0,
					timer: undefined,
				});
				configurationChanged = true;
				continue;
			}

			const hasSameRuntimeIdentity = runtime.identity === identity;
			if (hasSameRuntimeIdentity) continue;

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
	}, [rules, configurations, resetRuntime]);
	React.useLayoutEffect(
		() => () => {
			for (const runtime of runtimes.current.values())
				clearTimeout(runtime.timer);
			runtimes.current.clear();
			latest.current = {};
			revision.current += 1;
		},
		[],
	);
	const update = React.useCallback(
		(frame: PoseFrame) => {
			const now = performance.now();
			const updateRevision = revision.current;
			for (const [id, runtime] of runtimes.current) {
				const isRevisionSuperseded = revision.current !== updateRevision;
				if (isRevisionSuperseded) break;

				const ruleSettings = latest.current[id];

				const isRuleSettingsMissing = ruleSettings == null;
				if (isRuleSettingsMissing) continue;

				const isRuleInactive = ruleSettings.isActive === false;
				if (isRuleInactive) {
					resetRuntime(id, runtime);
					continue;
				}

				const staleAfterMs = ruleSettings.staleAfterMs ?? 500;
				const restarted = frame.additionalData.frameNumber <= runtime.lastFrame;

				const expired = now - runtime.state.updatedAt >= staleAfterMs;

				const isRestartedOrExpired = restarted || expired;
				if (isRestartedOrExpired) resetRuntime(id, runtime);

				const isRevisionSupersededAfterReset =
					revision.current !== updateRevision;
				if (isRevisionSupersededAfterReset) break;

				runtime.lastFrame = frame.additionalData.frameNumber;
				const verdict = evaluatePoseRule(
					frame,
					ruleSettings,
					runtime.state.candidate,
				);
				const next = advancePoseRule(
					runtime.state,
					verdict,
					now,
					ruleSettings.holdMs ?? 0,
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
			const hasNoStatusForId = !Object.hasOwn(statuses, id);
			if (hasNoStatusForId) return [id, "unknown"];

			return [id, statuses[id as Id]];
		}),
	) as Readonly<Record<Id, PoseRuleStatus>>;
	return { statuses: configuredStatuses, update, reset };
};
