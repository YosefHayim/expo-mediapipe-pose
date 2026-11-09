import * as React from "react";
import type { PoseFrame } from "../contracts";
import {
	advancePoseRule,
	initialPoseRuleState,
	validatePoseRuleOptions,
} from "../rules/rule";
import {
	inspectPoseTracking,
	type PoseTrackingOptions,
	type PoseTrackingState,
	trackingState,
} from "./logic";

export const usePoseTracking = (options: PoseTrackingOptions) => {
	validatePoseRuleOptions(options);
	const latest = React.useRef(options);
	const [state, setState] = React.useState(() => {
		const isIsActiveFalse = options.isActive === false;
		return trackingState(isIsActiveFalse ? "inactive" : "searching");
	});
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
		const isSameAsCurrent =
			JSON.stringify(next) === JSON.stringify(current.current);
		if (isSameAsCurrent) return;

		current.current = next;
		setState(next);
		latest.current.onChange?.(next);
	}, []);
	const reset = React.useCallback(() => {
		clearTimeout(timeout.current);
		lastFrame.current = 0;
		stability.current = initialPoseRuleState();
		const isCurrentIsActiveFalse = latest.current.isActive === false;
		commit(trackingState(isCurrentIsActiveFalse ? "inactive" : "searching"));
	}, [commit]);
	const update = React.useCallback(
		(frame: PoseFrame) => {
			const settings = latest.current;

			const isSettingsIsActiveFalse = settings.isActive === false;
			if (isSettingsIsActiveFalse) {
				reset();
				return;
			}

			const now = performance.now();
			const staleAfterMs = settings.staleAfterMs ?? 500;
			const restarted = frame.additionalData.frameNumber <= lastFrame.current;

			const expired = now - stability.current.updatedAt >= staleAfterMs;

			const isRestartedOrExpired = restarted || expired;
			if (isRestartedOrExpired) stability.current = initialPoseRuleState();

			lastFrame.current = frame.additionalData.frameNumber;
			const inspection = inspectPoseTracking(frame, settings);
			const isInspectionStatusFound = inspection.status === "found";
			stability.current = advancePoseRule(
				stability.current,
				isInspectionStatusFound ? "pass" : "unknown",
				now,
				settings.holdMs ?? 0,
			);
			const isConfirming =
				inspection.status === "found" && stability.current.status !== "pass";
			clearTimeout(timeout.current);
			timeout.current = setTimeout(() => {
				stability.current = initialPoseRuleState();
				commit(trackingState("stale"));
			}, staleAfterMs);
			commit(isConfirming ? trackingState("acquiring") : inspection);
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
		const isIdentityChanged = previousIdentity.current !== identity;
		if (isIdentityChanged) {
			previousIdentity.current = identity;
			reset();
		}

		return () => clearTimeout(timeout.current);
	}, [identity, reset]);
	return { ...state, update, reset };
};
