import * as React from "react";
import type { LandmarkName } from "../pose/landmarks";
import type { PoseRuleOptions } from "../pose/poseRule";
import { usePoseRules } from "./usePoseRules";

export const usePoseRule = <Name extends LandmarkName>(
	options: PoseRuleOptions<Name>,
) => {
	const rules = usePoseRules({ rule: options });
	const reset = React.useCallback(() => rules.reset(), [rules.reset]);
	return {
		status: rules.statuses.rule,
		update: rules.update,
		reset,
	};
};
