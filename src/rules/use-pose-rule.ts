import * as React from "react";
import type { LandmarkName } from "../landmarks/names";
import type { PoseRuleOptions } from "./rule";
import { usePoseRules } from "./use-pose-rules";

export const usePoseRule = <Name extends LandmarkName>(
	settings: PoseRuleOptions<Name>,
) => {
	const rules = usePoseRules({ rule: settings });
	const reset = React.useCallback(() => rules.reset(), [rules.reset]);
	return {
		status: rules.statuses.rule,
		update: rules.update,
		reset,
	};
};
