import * as React from "react";
import type { PoseFrame } from "../contracts";
import {
	advancePoseRule,
	initialPoseRuleState,
	validatePoseRuleOptions,
} from "../pose/poseRule";
import {
	inspectPoseTracking,
	type PoseTrackingOptions,
	type PoseTrackingState,
	trackingState,
} from "../pose/tracking";

export const usePoseTracking = (options: PoseTrackingOptions) => {
	validatePoseRuleOptions(options);
	const latest = React.useRef(options);
	const [state, setState] = React.useState(() =>
		trackingState(options.isActive === false ? "inactive" : "searching"),
	);
	const current = React.useRef(state);
	const stability = React.useRef(initialPoseRuleState());
	const lastFrame = React.useRef(0);
	const timeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	React.useLayoutEffect(() => {
		latest.current = options;
	});
	const commit = React.useCallback((next: PoseTrackingState) => {
		if (JSON.stringify(next) === JSON.stringify(current.current)) return;
		current.current = next;
		setState(next);
		latest.current.onChange?.(next);
	}, []);
	const reset = React.useCallback(() => {
		clearTimeout(timeout.current);
		lastFrame.current = 0;
		stability.current = initialPoseRuleState();
		commit(
			trackingState(
				latest.current.isActive === false ? "inactive" : "searching",
			),
		);
	}, [commit]);
	const update = React.useCallback(
		(frame: PoseFrame) => {
			const settings = latest.current;
			if (settings.isActive === false) {
				reset();
				return;
			}
			const now = performance.now();
			const staleAfterMs = settings.staleAfterMs ?? 500;
			const restarted = frame.additionalData.frameNumber <= lastFrame.current;
			const expired = now - stability.current.updatedAt >= staleAfterMs;
			if (restarted || expired) stability.current = initialPoseRuleState();
			lastFrame.current = frame.additionalData.frameNumber;
			const inspection = inspectPoseTracking(frame, settings);
			stability.current = advancePoseRule(
				stability.current,
				inspection.status === "found" ? "pass" : "unknown",
				now,
				settings.holdMs ?? 0,
			);
			const confirming =
				inspection.status === "found" && stability.current.status !== "pass";
			commit(confirming ? trackingState("acquiring") : inspection);
			clearTimeout(timeout.current);
			timeout.current = setTimeout(() => {
				stability.current = initialPoseRuleState();
				commit(trackingState("stale"));
			}, staleAfterMs);
		},
		[commit, reset],
	);
	const identity = JSON.stringify({
		landmarks: options.landmarks,
		minVisibility: options.minVisibility,
		holdMs: options.holdMs,
		staleAfterMs: options.staleAfterMs,
		isActive: options.isActive,
	});
	const previousIdentity = React.useRef(identity);
	React.useLayoutEffect(() => {
		if (previousIdentity.current !== identity) {
			previousIdentity.current = identity;
			reset();
		}
		return () => clearTimeout(timeout.current);
	}, [identity, reset]);
	return { ...state, update, reset };
};
