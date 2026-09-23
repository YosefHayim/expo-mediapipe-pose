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

export const usePoseRule = <Name extends LandmarkName>(
	options: PoseRuleOptions<Name>,
) => {
	validatePoseRuleOptions(options);
	const latest = React.useRef(options);
	const current = React.useRef(initialPoseRuleState());
	const lastFrame = React.useRef(0);
	const timeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const [status, setStatus] = React.useState<PoseRuleStatus>("unknown");
	React.useLayoutEffect(() => {
		latest.current = options;
	});

	const commit = React.useCallback((next: PoseRuleState) => {
		const changed = next.status !== current.current.status;
		current.current = next;
		if (changed) {
			setStatus(next.status);
			latest.current.onChange?.(next.status);
		}
	}, []);
	const reset = React.useCallback(() => {
		clearTimeout(timeout.current);
		lastFrame.current = 0;
		commit(initialPoseRuleState());
	}, [commit]);
	const update = React.useCallback(
		(frame: PoseFrame) => {
			const settings = latest.current;
			const now = performance.now();
			const staleAfterMs = settings.staleAfterMs ?? 500;
			const captureRestarted =
				frame.additionalData.frameNumber <= lastFrame.current;
			const previousFrameExpired =
				now - current.current.updatedAt >= staleAfterMs;
			if (captureRestarted || previousFrameExpired) {
				reset();
			}
			lastFrame.current = frame.additionalData.frameNumber;
			commit(
				advancePoseRule(
					current.current,
					evaluatePoseRule(frame, settings),
					now,
					settings.holdMs ?? 0,
				),
			);
			clearTimeout(timeout.current);
			timeout.current = setTimeout(reset, staleAfterMs);
		},
		[commit, reset],
	);

	const ruleIdentity = JSON.stringify({
		landmarks: options.landmarks,
		minVisibility: options.minVisibility,
		holdMs: options.holdMs,
		staleAfterMs: options.staleAfterMs,
		isActive: options.isActive,
	});
	const previousRuleIdentity = React.useRef(ruleIdentity);
	React.useLayoutEffect(() => {
		if (previousRuleIdentity.current !== ruleIdentity) {
			previousRuleIdentity.current = ruleIdentity;
			reset();
		}
		return () => {
			clearTimeout(timeout.current);
		};
	}, [ruleIdentity, reset]);

	return { status, update, reset };
};
